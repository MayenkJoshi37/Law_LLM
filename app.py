from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
import json
import fitz  # PyMuPDF for PDF extraction
from sentence_transformers import SentenceTransformer
import chromadb
from langchain_ollama import OllamaLLM
import markdown2  

# Initialize Flask app
app = Flask(__name__, static_folder='static')
app.config['UPLOAD_FOLDER'] = 'data/uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('data/chat_logs', exist_ok=True)

# Initialize models and database
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
vector_db = chromadb.PersistentClient(path="./chroma_db")
collection = vector_db.get_or_create_collection(name="document_chunks", metadata={"hnsw:space": "cosine"})
llm = OllamaLLM(model="llama3.1:latest")

# Session memory
session_memory = []

# Allowed file extensions
ALLOWED_EXTENSIONS = {'txt', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with fitz.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text("text") + "\n"
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def chunk_text_by_paragraph(text):
    return [paragraph.strip() for paragraph in text.split('\n\n') if paragraph.strip()]

def add_document_to_db(text_chunks, source_id):
    embeddings = embedding_model.encode(text_chunks).tolist()
    ids = [f"{source_id}_{i}" for i in range(len(text_chunks))]
    collection.add(embeddings=embeddings, documents=text_chunks, ids=ids)

def get_relevant_chunks(query, n_results=5):
    query_embedding = embedding_model.encode(query).tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=n_results)
    return [doc for sublist in results['documents'] for doc in sublist]

def summarize_session():
    if not session_memory:
        return ""
    summary_input = "\n\n".join(session_memory[-6:])
    summary_prompt = f"Summarize the following conversation concisely:\n{summary_input}"
    return llm.invoke(summary_prompt)

def generate_response(user_message, context_chunks):
    context = "\n\n".join(context_chunks)
    session_summary = summarize_session()
    prompt = f"""
    You are a professional yet user-friendly legal chatbot specializing in Indian laws and regulations.  
    While your primary expertise is in Indian legal matters, you can also engage in **general conversations** in a helpful and friendly manner.  

    - Provide clear, structured responses in a bullet-point format.  
    - Focus on Indian laws and regulations, but feel free to answer general questions or engage in casual conversations.  
    - Maintain a **polite, approachable, and professional tone**.  
    - If the user's question pertains to another country, politely inform them that you specialize in Indian laws.  

    **Session Summary:**  
    {session_summary}

    **Context (if any):**  
    {context}  

    **User's Message:**  
    {user_message}  

    **Your Response:**  
    """
    response = llm.invoke(prompt)
    response_final = markdown2.markdown(response, extras=["strip"])  
    return response_final

    #return Markdown(response)

def save_chat_log(user_message, retrieved_text, summary, final_prompt, response):
    log_data = {
        "user_message": user_message,
        "retrieved_text": retrieved_text,
        "session_summary": summary,
        "final_prompt": final_prompt,
        "response": response
    }
    with open(f'data/chat_logs/chat_{len(os.listdir("data/chat_logs"))}.json', 'w') as f:
        json.dump(log_data, f, indent=4)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    files = request.files.getlist('file')
    responses = []

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            try:
                text = extract_text_from_pdf(filepath) if filename.endswith('.pdf') else open(filepath, 'r', encoding='utf-8').read()
                chunks = chunk_text_by_paragraph(text)
                add_document_to_db(chunks, filename)
                responses.append({'filename': filename, 'status': 'success'})
            except Exception as e:
                responses.append({'filename': filename, 'status': 'error', 'message': str(e)})

    return jsonify(responses)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400

    user_message = data['message']
    session_memory.append(f"User: {user_message}")
    relevant_chunks = get_relevant_chunks(user_message)
    response = generate_response(user_message, relevant_chunks)
    session_memory.append(f"Bot: {response}")

    save_chat_log(user_message, relevant_chunks, summarize_session(), "final_prompt_text", response)
    return jsonify({'response': response})

@app.route('/clear_chat', methods=['POST'])
def clear_chat():
    global session_memory
    session_memory = []
    return jsonify({'message': 'Chat history cleared'})

if __name__ == '__main__':
    app.run(debug=True)
