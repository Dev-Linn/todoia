# Configurações da API Gemini
# IMPORTANTE: Substitua pela sua chave da API Gemini
# Obtenha em: https://aistudio.google.com/apikey

GEMINI_API_KEY = "AIzaSyAhg_nU6KscSErDU2KdeBVEbw5pTXgEHlE"

# URLs da API
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# Configurações do Flask
DEBUG = True
HOST = '0.0.0.0'
PORT = 5000

# Configurações de arquivo
UPLOAD_FOLDER = 'uploads'
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'}

# Configurações do banco de dados
DB_FILE = 'db.json'
MAX_CHAT_HISTORY = 50
MAX_TODOS = 100
MAX_EVENTS = 100 