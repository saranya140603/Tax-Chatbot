from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import os, httpx, asyncio
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

app = FastAPI(title="TaxWise AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# ── Prompts ──────────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = """You are TaxWise AI, a knowledgeable and professional Tax & Finance assistant.
You help users understand:
- Income tax concepts, tax brackets, deductions, and credits
- GST/VAT rules and compliance
- Corporate tax fundamentals
- Investment taxation (capital gains, dividends)
- General personal finance and budgeting concepts
- Tax filing basics and deadlines

Guidelines:
- Be accurate, concise, and professional
- Always clarify that your answers are for educational/informational purposes only and not formal tax advice
- When users ask highly jurisdiction-specific questions, note which country/region your answer applies to
- Use simple language and real-world examples when helpful
- Format answers with bullet points or numbered lists when explaining multi-step concepts
- If a question is outside tax/finance scope, politely redirect back to your area of expertise
"""

def build_webpage_system_prompt(url: str, content: str) -> str:
    return f"""{BASE_SYSTEM_PROMPT}

--- WEBPAGE CONTEXT ---
The user has asked you to read and analyze the following webpage: {url}

Below is the extracted content from that page and its internal links (up to depth 1).
Use this content as your PRIMARY knowledge source when answering the user's questions.
If the user asks something covered by this content, answer from it directly.
If the user asks something not in this content, answer from your general knowledge but clarify it's not from the webpage.

WEBPAGE CONTENT:
{content[:12000]}
--- END WEBPAGE CONTEXT ---
"""

# ── Web scraping helpers ──────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

def extract_text_and_links(html: str, base_url: str) -> tuple[str, list[str]]:
    """Extract clean text and internal links from HTML."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove noise tags
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "form", "noscript", "meta", "link"]):
        tag.decompose()

    # Extract clean text
    text = soup.get_text(separator="\n", strip=True)
    # Collapse blank lines
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    clean_text = "\n".join(lines)

    # Extract internal links (same domain)
    base_domain = urlparse(base_url).netloc
    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        # Only same-domain, http/https, no fragments/query dupes
        if (parsed.scheme in ("http", "https")
                and parsed.netloc == base_domain
                and full_url not in seen
                and full_url != base_url):
            # Skip obvious non-content links
            path = parsed.path.lower()
            if not any(path.endswith(ext) for ext in
                       [".pdf", ".jpg", ".png", ".gif", ".zip", ".css", ".js"]):
                links.append(full_url)
                seen.add(full_url)
        if len(links) >= 10:   # cap at 10 internal links for depth-1
            break

    return clean_text, links


async def fetch_url(client_http: httpx.AsyncClient, url: str) -> str:
    """Fetch a single URL and return its text content."""
    try:
        r = await client_http.get(url, headers=HEADERS, timeout=10, follow_redirects=True)
        r.raise_for_status()
        text, _ = extract_text_and_links(r.text, url)
        return f"\n\n=== {url} ===\n{text[:3000]}"   # cap per page
    except Exception as e:
        return f"\n\n=== {url} ===\n[Could not fetch: {e}]"


async def scrape_with_depth1(root_url: str) -> str:
    """
    Depth-0: fetch root page, extract text + internal links.
    Depth-1: fetch each internal link concurrently (max 10).
    Returns combined text.
    """
    async with httpx.AsyncClient(headers=HEADERS, timeout=15,
                                  follow_redirects=True) as hc:
        # Depth-0
        try:
            r = await hc.get(root_url)
            r.raise_for_status()
            root_text, internal_links = extract_text_and_links(r.text, root_url)
        except Exception as e:
            raise ValueError(f"Could not fetch the webpage: {e}")

        combined = f"=== {root_url} (main page) ===\n{root_text[:4000]}"

        if internal_links:
            # Depth-1: fetch all internal links concurrently
            tasks = [fetch_url(hc, link) for link in internal_links]
            depth1_results = await asyncio.gather(*tasks)
            combined += "\n" + "\n".join(depth1_results)

        return combined, internal_links


# ── Pydantic models ───────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list[dict]
    webpage_context: str | None = None    # injected by frontend per session
    webpage_url: str | None = None

class ChatResponse(BaseModel):
    reply: str

class WebpageRequest(BaseModel):
    url: str

class WebpageResponse(BaseModel):
    content: str
    url: str
    links_found: int
    char_count: int

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "TaxWise AI backend is running"}


@app.post("/read-webpage", response_model=WebpageResponse)
async def read_webpage(req: WebpageRequest):
    """Fetch a webpage + depth-1 internal links and return combined text."""
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        content, links = await scrape_with_depth1(url)
        return WebpageResponse(
            content=content,
            url=url,
            links_found=len(links),
            char_count=len(content)
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping error: {e}")


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Chat endpoint. If webpage_context is provided, it's injected into the system prompt."""
    if not req.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    # Build system prompt — with or without webpage context
    if req.webpage_context:
        system_prompt = build_webpage_system_prompt(
            req.webpage_url or "unknown", req.webpage_context
        )
    else:
        system_prompt = BASE_SYSTEM_PROMPT

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system_prompt}] + req.messages,
            max_tokens=1024,
            temperature=0.6,
        )
        reply = completion.choices[0].message.content
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")
