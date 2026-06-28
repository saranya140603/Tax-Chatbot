from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import os

app = FastAPI(title="TaxWise AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are TaxWise AI, a knowledgeable and professional Tax & Finance assistant. 
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

class ChatRequest(BaseModel):
    messages: list[dict]

class ChatResponse(BaseModel):
    reply: str

@app.get("/")
def health():
    return {"status": "TaxWise AI backend is running"}

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + req.messages,
            max_tokens=1024,
            temperature=0.6,
        )
        reply = completion.choices[0].message.content
        return ChatResponse(reply=reply)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")
