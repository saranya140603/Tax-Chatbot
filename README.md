# 💼 TaxWise AI — Tax & Finance Chatbot

A production-ready Tax & Finance Q&A chatbot powered by **Llama 3.3 70B via Groq**,
with a professional dark-themed UI — deployed free on GitHub Pages + Render.

---

## 🏗️ Project Structure

```
taxbot/
├── frontend/
│   └── index.html        ← Full chatbot UI (GitHub Pages)
└── backend/
    ├── main.py           ← FastAPI app with Groq LLM
    ├── requirements.txt  ← Python dependencies
    └── render.yaml       ← Render deployment config
```

---

## 🚀 Deployment Guide (100% Free)

### STEP 1 — Get a Free Groq API Key

1. Go to **https://console.groq.com**
2. Sign up (free, no credit card needed)
3. Click **API Keys → Create API Key**
4. Copy the key (starts with `gsk_...`)

---

### STEP 2 — Deploy the Backend on Render

1. Create a free account at **https://render.com**

2. Push the `backend/` folder to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/taxwise-backend.git
   git push -u origin main
   ```

3. In Render dashboard → **New → Web Service**
4. Connect your GitHub repo
5. Set these fields:
   - **Name:** `taxwise-ai-backend`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free

6. Under **Environment Variables**, add:
   - Key: `GROQ_API_KEY`
   - Value: your key from Step 1

7. Click **Deploy**. Wait ~2 minutes.

8. Copy your backend URL — it looks like:
   `https://taxwise-ai-backend.onrender.com`

---

### STEP 3 — Connect Frontend to Backend

Open `frontend/index.html` and find this line near the top of the `<script>`:

```javascript
const BACKEND_URL = "https://YOUR-RENDER-APP.onrender.com";
```

Replace it with your actual Render URL from Step 2:

```javascript
const BACKEND_URL = "https://taxwise-ai-backend.onrender.com";
```

---

### STEP 4 — Deploy Frontend on GitHub Pages

1. Push the `frontend/` folder to a **separate** GitHub repo (or same repo under `/docs`):
   ```bash
   # Option A: Separate repo
   cd frontend
   git init
   git add .
   git commit -m "taxwise frontend"
   git remote add origin https://github.com/YOUR_USERNAME/taxwise-frontend.git
   git push -u origin main
   ```

2. In the repo → **Settings → Pages**
3. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
4. Click **Save**

5. Your live URL will be:
   `https://YOUR_USERNAME.github.io/taxwise-frontend`

---

## ✅ Test It

Open your GitHub Pages URL, type a question like:
> "What is the difference between LTCG and STCG in India?"

You should get a clear, detailed answer from Llama 3.3 70B.

---

## 📝 Add to Resume

```
TaxWise AI — Tax & Finance Chatbot         [Live] [GitHub]
• Built an end-to-end AI chatbot for Tax & Finance Q&A using Llama 3.3 70B (via Groq API),
  deployed with a FastAPI backend on Render and a professional dark-themed UI on GitHub Pages.
• Implemented multi-turn conversation memory, markdown response rendering, and a
  domain-specific system prompt for accurate tax query handling.
• Stack: Python, FastAPI, Groq API, HTML/CSS/JS — 100% free hosting, zero infrastructure cost.
```

---

## ⚠️ Notes

- **Render free tier sleeps** after 15 min of inactivity — first message after sleep takes ~30 sec.
  To avoid this, upgrade to Render's $7/month paid tier, or use a free uptime monitor like UptimeRobot.
- The chatbot provides **general information only**, not professional tax advice.
- Groq's free tier allows ~14,400 requests/day — more than enough for portfolio use.
