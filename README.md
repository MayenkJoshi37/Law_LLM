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
Access the interface at:

cpp
Copy
Edit
http://127.0.0.1:5000/
🗂️ Project Structure
graphql
Copy
Edit
.
├─ app.py
├─ requirements.txt
├─ data/
│  ├─ uploads/       # Storage for uploaded docs
│  └─ chat_logs/     # JSON logs of chat sessions
└─ chroma_db/        # Persistent ChromaDB database files
🚀 Core Endpoints
Endpoint	Method	Description
/	GET	Serve the frontend (index.html)
/upload	POST	Upload .txt or .pdf files and add to vector database
/chat	POST	Send message → retrieve context → generate response
/clear_chat	POST	Reset session memory

🧠 How It Works
Document Upload & Embedding

Upload files (.txt or .pdf)

Extract text (PyMuPDF), segment by paragraphs

Embed chunks and store them in ChromaDB with IDs

Chat & Retrieval Loop

Compute query embedding → retrieve top‑k relevant chunks

Build a prompt combining: session summary, retrieved context, system instructions

LLM generates response in bullet‑point style focused on Indian law

Session Summarization & Logging

Summarize last 6 messages to maintain context

Save chat history, retrieved chunks, and final prompt into JSON logs

💬 Response Style
Responses are delivered as bullet‑point summaries

Tone: Professional, clear, helpful, and polite

Emphasis on Indian laws; for non‑Indian queries the bot will clarify its jurisdiction

🛠️ Customization Suggestions
Swap or fine‑tune the embedding model (sentence-transformers)

Adjust chunk size or add overlap for better retrieval results

Modify the retrieval count (n_results)

Customize the summarization prompt or session memory logic

Upgrade markdown rendering or integrate rich UI frontend

Extend support for regional languages, e.g., Hindi

⚠️ Cautions & Limitations
❗ Not a substitute for legal advice – for information only

Accuracy depends on uploaded documents and LLM responses

Sensitive doc handling and local JSON logs require careful privacy practices

🧪 Why This Matters
Enables document-based question answering within the Indian legal domain

Combines retrieval, summarization, and an LLM into a coherent user‑friendly chatbot

Useful for legal literacy, education, and preliminary research

🏛️ License & Contributions
📝 License: (Specify your chosen license, e.g. MIT or Apache 2.0)

💡 Contributing Ideas:

Add curated Indian legal datasets (e.g. IPC sections, Supreme Court judgments)

Refine prompts for fairness and accuracy in legal contexts

Improve session memory and summarization strategy

Expand beyond text—allow scanned PDFs, multilingual input, or speech interfaces

✅ Quick Summary
Upload legal documents → index them via embedding + ChromaDB

Chat queries answered with context + LLM responses

Focuses on Indian legal knowledge, delivered in concise bullets

Logs interactions and provides summaries for continuity
