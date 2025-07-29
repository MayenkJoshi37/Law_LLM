# 🇮🇳 Indian Legal Chatbot

A Flask‑based Retrieval‑Augmented Legal Chatbot built for the **Indian legal system**. Upload legal documents, retrieve relevant context using ChromaDB, and generate user‑friendly answers from an LLM via Ollama.

---

## 🔍 Purpose

This tool transforms legal documents into semantic vectors, enables context‑aware retrieval, and produces **structured bullet‑point responses** about Indian laws. It also supports general queries, with polite clarification that its expertise is India‑specific.

---

## 🧰 Tech Stack

- **Flask** backend for file upload and chat API  
- **SentenceTransformers** `all‑MiniLM‑L6‑v2` for embeddings  
- **ChromaDB** for vector store (`chromadb.PersistentClient`)  
- **Ollama LLM** (`llama3.1:latest`) via `langchain_ollama`  
- **PyMuPDF (`fitz`)** for extracting text from PDFs  
- **markdown2** for rendering chatbot responses  

---

## ⚙️ Setup & Run

```bash
git clone https://github.com/MayenkJoshi37/Law_LLM.git
cd Law_LLM
pip install -r requirements.txt
python app.py
```

## Access the interface at:
```
http://127.0.0.1:5000/
```

##🗂️ Project Structure
```
.
├─ app.py
├─ requirements.txt
├─ data/
│  ├─ uploads/       # Storage for uploaded docs
│  └─ chat_logs/     # JSON logs of chat sessions
└─ chroma_db/        # Persistent ChromaDB database files
```

---

## 🚀 Core Endpoints

| Endpoint       | Method | Description                                                  |
|----------------|--------|--------------------------------------------------------------|
| `/`            | GET    | Serve the frontend (`index.html`)                            |
| `/upload`      | POST   | Upload `.txt` or `.pdf` and add to vector database           |
| `/chat`        | POST   | Send message → retrieve context → generate response          |
| `/clear_chat`  | POST   | Reset session memory                                         |

---

## 🧠 How It Works

### Document Upload & Embedding
- Upload `.txt` or `.pdf` files  
- Extract text using PyMuPDF, segment by paragraphs  
- Embed text chunks and store in ChromaDB with unique IDs  

### Chat & Retrieval Loop
- Encode user query → retrieve top‑k relevant text chunks  
- Build a prompt using session summary, retrieved context, and Indian-law instructions  
- LLM generates structured bullet‑point responses focused on Indian legal context  

### Session Summarization & Logging
- Summarize the last 6 messages to maintain conversational coherence  
- Save full history, retrieved chunks, prompt, and response into JSON logs  

---

## 💬 Response Style

- Delivered as **bullet‑point summaries**  
- Tone: Professional, clear, helpful, and polite  
- Focuses on Indian laws; clarifies non‑Indian jurisdiction questions politely  

---

## 🛠️ Customization Suggestions

- Swap or fine‑tune the embedding model (`sentence‑transformers`)  
- Adjust paragraph chunk size or add overlap for better retrieval  
- Modify retrieval count via `n_results`  
- Refine summarization logic or modify prompts  
- Upgrade markdown rendering or integrate a richer UI frontend  
- Add support for regional languages (e.g. Hindi)  

---

## ⚠️ Cautions & Limitations

- ❗ **Not legal advice** — intended for informational purposes only  
- Accuracy depends on uploaded documents and LLM performance  
- Sensitive document handling and local logs must comply with privacy best practices  

---

## 🏛️ Contributions

- **Contributing Ideas:**
  - Add curated Indian legal datasets (e.g. IPC sections, Supreme Court judgments)  
  - Improve prompt engineering for fairness and accuracy  
  - Enhance session memory and summarization strategy  
  - Support scanned PDFs, multilingual input, or speech interfaces  

---

## ✅ Quick Summary

- Upload legal documents → index via embeddings + ChromaDB  
- User queries answered with retrieved context + LLM-generated responses  
- Focus on Indian legal knowledge, delivered concisely in bullet points  
- Conversations are logged and summarized for continuity  
