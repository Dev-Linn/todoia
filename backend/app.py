from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime, timedelta
import requests
from werkzeug.utils import secure_filename
import PyPDF2
import docx
from PIL import Image
import io
import base64
from config import GEMINI_API_KEY, GEMINI_API_URL, UPLOAD_FOLDER, ALLOWED_EXTENSIONS, DB_FILE

app = Flask(__name__)
CORS(app, 
     origins=["*"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

# Configurar logs de erro mais detalhados
import logging
logging.basicConfig(level=logging.DEBUG)

# Middleware para capturar erros de parsing JSON
@app.before_request
def log_request_info():
    print(f"🌐 {request.method} {request.path}")
    if request.method == 'POST' and request.content_type:
        print(f"📋 Content-Type: {request.content_type}")
        if 'application/json' in request.content_type:
            try:
                data = request.get_json()
                print(f"📥 JSON Data: {data}")
            except Exception as e:
                print(f"❌ Erro ao parsear JSON: {e}")

# Handler de erro global
@app.errorhandler(Exception)
def handle_exception(e):
    print(f"❌ Erro não tratado: {e}")
    import traceback
    traceback.print_exc()
    return jsonify({'success': False, 'message': f'Erro interno: {str(e)}'}), 500

def load_db():
    try:
        if not os.path.exists(DB_FILE):
            print(f"🔧 Arquivo {DB_FILE} não encontrado. Criando novo...")
            default_data = {
                'todos': [],
                'events': [],
                'chat_history': []
            }
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(default_data, f, ensure_ascii=False, indent=2)
            return default_data
        
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                print(f"🔧 Arquivo {DB_FILE} vazio. Inicializando com dados padrão...")
                default_data = {
                    'todos': [],
                    'events': [],
                    'chat_history': []
                }
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(default_data, f, ensure_ascii=False, indent=2)
                return default_data
            
            data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"⚠️ Erro ao decodificar JSON: {e}")
        print("🔧 Recriando arquivo com dados padrão...")
        default_data = {
            'todos': [],
            'events': [],
            'chat_history': []
        }
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, ensure_ascii=False, indent=2)
        return default_data
    except Exception as e:
        print(f"⚠️ Erro ao carregar banco: {e}")
        return {
            'todos': [],
            'events': [],
            'chat_history': []
        }
    
    # Garantir que todas as chaves necessárias existam
    if 'todos' not in data:
        data['todos'] = []
    if 'events' not in data:
        data['events'] = []
    if 'chat_history' not in data:
        data['chat_history'] = []
    
    # Limpar dados inconsistentes - remover todos sem ID
    original_todos_count = len(data['todos'])
    data['todos'] = [todo for todo in data['todos'] if 'id' in todo and todo.get('id')]
    
    # Garantir que todos os todos tenham IDs únicos
    for todo in data['todos']:
        if not todo.get('id'):
            todo['id'] = str(uuid.uuid4())
    
    # Garantir que todos os events tenham IDs únicos
    for event in data['events']:
        if not event.get('id'):
            event['id'] = str(uuid.uuid4())
    
    if len(data['todos']) != original_todos_count:
        print(f"🔧 Removidos {original_todos_count - len(data['todos'])} todos inconsistentes")
        save_db(data)
    
    print(f"✅ Banco carregado: {len(data['todos'])} todos, {len(data['events'])} eventos, {len(data['chat_history'])} mensagens")
    return data

def save_db(data):
    try:
        # Criar backup antes de salvar
        if os.path.exists(DB_FILE):
            backup_file = f"{DB_FILE}.backup"
            import shutil
            shutil.copy2(DB_FILE, backup_file)
        
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Banco salvo: {len(data.get('todos', []))} todos, {len(data.get('events', []))} eventos")
        
    except Exception as e:
        print(f"⚠️ Erro ao salvar banco: {e}")
        # Tentar restaurar backup se existir
        backup_file = f"{DB_FILE}.backup"
        if os.path.exists(backup_file):
            import shutil
            shutil.copy2(backup_file, DB_FILE)
            print("🔄 Backup restaurado")
        raise e

# Inicialização
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
    print(f"📁 Pasta de uploads criada: {UPLOAD_FOLDER}")

# Inicializar banco de dados
print("🔧 Inicializando banco de dados...")
try:
    # Testar se o banco funciona
    test_db = load_db()
    print(f"✅ Banco inicializado com sucesso!")
    print(f"📊 Dados atuais: {len(test_db['todos'])} todos, {len(test_db['events'])} eventos, {len(test_db['chat_history'])} mensagens")
except Exception as e:
    print(f"⚠️ Erro na inicialização do banco: {e}")
    print("🔧 Criando novo banco...")
    default_data = {
        'todos': [],
        'events': [],
        'chat_history': []
    }
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(default_data, f, ensure_ascii=False, indent=2)
    print("✅ Novo banco criado!")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def call_gemini_api(prompt, context=""):
    """Chama a API do Gemini com o prompt fornecido"""
    try:
        headers = {
            'Content-Type': 'application/json',
        }
        
        full_prompt = f"{context}\n\n{prompt}" if context else prompt
        
        data = {
            "contents": [{
                "parts": [{
                    "text": full_prompt
                }]
            }]
        }
        
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['candidates'][0]['content']['parts'][0]['text']
        else:
            print(f"Erro na API Gemini: {response.status_code} - {response.text}")
            return "Desculpe, não consegui processar sua solicitação no momento."
            
    except Exception as e:
        print(f"Erro ao chamar API Gemini: {str(e)}")
        return "Desculpe, ocorreu um erro ao processar sua solicitação."

def get_user_context():
    """Gera contexto completo do usuário com todos os dados"""
    db = load_db()
    
    # Tarefas com informações mais detalhadas
    todos_context = "=== TAREFAS DO USUÁRIO ===\n"
    if db['todos']:
        for todo in db['todos']:
            status = "✅ CONCLUÍDA" if todo.get('completed', False) else "⏳ PENDENTE"
            created = todo.get('created_at', 'Data não informada')
            due_date = todo.get('due_date', 'Sem prazo')
            
            # Verificar se a tarefa está vencida
            if due_date != 'Sem prazo':
                try:
                    due_datetime = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                    if due_datetime < datetime.now() and not todo.get('completed', False):
                        status += " ⚠️ VENCIDA"
                    elif due_datetime <= datetime.now() + timedelta(days=1) and not todo.get('completed', False):
                        status += " 🔥 URGENTE"
                except:
                    pass
            
            todos_context += f"- {todo['text']} ({status}) - Criada: {created} - Prazo: {due_date}\n"
    else:
        todos_context += "Nenhuma tarefa cadastrada.\n"
    
    # Eventos
    events_context = "\n=== EVENTOS E COMPROMISSOS ===\n"
    if db['events']:
        for event in db['events']:
            event_date = event.get('datetime', 'Data não informada')
            created = event.get('created_at', 'Data não informada')
            events_context += f"- {event['text']} - Data: {event_date} - Criado: {created}\n"
    else:
        events_context += "Nenhum evento cadastrado.\n"
    
    # Histórico de chat recente
    chat_context = "\n=== CONTEXTO DE CONVERSAS RECENTES ===\n"
    if db['chat_history']:
        recent_chats = db['chat_history'][-3:]  # Últimas 3 conversas
        for chat in recent_chats:
            chat_context += f"Usuário: {chat['user']}\nAssistente: {chat['bot']}\n---\n"
    else:
        chat_context += "Primeira conversa.\n"
    
    # Data atual
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M')
    date_context = f"\n=== DATA ATUAL ===\n{current_date}\n"
    
    return todos_context + events_context + chat_context + date_context

def extract_text_from_file(file_path):
    """Extrai texto de diferentes tipos de arquivo"""
    try:
        file_extension = file_path.split('.')[-1].lower()
        
        if file_extension == 'txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        elif file_extension == 'pdf':
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                return text
        
        elif file_extension == 'docx':
            doc = docx.Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        
        elif file_extension in ['jpg', 'jpeg', 'png', 'gif']:
            # Para imagens, retorna uma descrição básica
            return f"Imagem enviada: {os.path.basename(file_path)}"
        
        else:
            return f"Arquivo enviado: {os.path.basename(file_path)}"
            
    except Exception as e:
        print(f"Erro ao extrair texto do arquivo: {str(e)}")
        return f"Erro ao processar arquivo: {os.path.basename(file_path)}"

# Rotas para servir arquivos estáticos
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('../frontend', filename)

# API Routes - TODOs
@app.route('/api/todos', methods=['GET'])
def get_todos():
    db = load_db()
    return jsonify(db['todos'])

@app.route('/api/todos', methods=['POST'])
def add_todo():
    try:
        print("🔧 Iniciando add_todo...")
        
        # Verificar se há dados JSON
        data = request.json
        print(f"📥 Dados recebidos: {data}")
        
        if not data:
            print("⚠️ Nenhum dado JSON fornecido")
            return jsonify({'success': False, 'message': 'Dados não fornecidos'}), 400
            
        text = data.get('text', '').strip()
        due_date = data.get('due_date')
        notes = data.get('notes', '').strip()
        priority = data.get('priority', 'normal')
        
        print(f"📝 Texto: '{text}', Data: '{due_date}', Notas: '{notes}', Prioridade: '{priority}'")
        
        if not text:
            print("⚠️ Texto da tarefa vazio")
            return jsonify({'success': False, 'message': 'Texto da tarefa é obrigatório'}), 400
        
        # Validar prioridade
        valid_priorities = ['low', 'normal', 'high', 'urgent']
        if priority not in valid_priorities:
            priority = 'normal'
        
        print("📂 Carregando banco de dados...")
        # Carregar dados usando a função robusta
        db_data = load_db()
        print(f"✅ Banco carregado: {len(db_data.get('todos', []))} todos existentes")
        
        # Gerar ID único
        todo_id = str(uuid.uuid4())
        print(f"🆔 ID gerado: {todo_id}")
        
        # Criar nova tarefa
        new_todo = {
            'id': todo_id,
            'text': text,
            'completed': False,
            'created_at': datetime.now().isoformat(),
            'due_date': due_date if due_date else None,
            'notes': notes if notes else None,
            'priority': priority
        }
        
        print(f"📋 Nova tarefa criada: {new_todo}")
        
        # Adicionar à lista
        db_data['todos'].append(new_todo)
        print(f"➕ Tarefa adicionada. Total: {len(db_data['todos'])}")
        
        # Salvar usando a função robusta
        print("💾 Salvando no banco...")
        save_db(db_data)
        print("✅ Banco salvo com sucesso")
        
        return jsonify({'success': True, 'todo': new_todo})
        
    except Exception as e:
        print(f"❌ Erro ao adicionar todo: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Erro interno do servidor: {str(e)}'}), 500

@app.route('/api/todos/<todo_id>', methods=['PUT'])
def update_todo(todo_id):
    try:
        db = load_db()
        data = request.json
        
        # Encontrar o todo
        todo_found = False
        for todo in db['todos']:
            if todo.get('id') == todo_id:
                # Atualizar os campos fornecidos
                for key, value in data.items():
                    if key in ['completed', 'text', 'due_date', 'notes', 'priority']:
                        todo[key] = value
                
                # Atualizar timestamp de modificação
                todo['updated_at'] = datetime.now().isoformat()
                
                save_db(db)
                todo_found = True
                return jsonify({'success': True, 'todo': todo})
        
        if not todo_found:
            return jsonify({'success': False, 'error': 'Todo not found'}), 404
            
    except Exception as e:
        print(f"Erro ao atualizar todo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/todos/<todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    db = load_db()
    
    db['todos'] = [todo for todo in db['todos'] if todo['id'] != todo_id]
    save_db(db)
    
    return jsonify({'success': True})

@app.route('/api/todos/suggest', methods=['GET'])
def suggest_todo():
    user_context = get_user_context()
    
    prompt = """
    Você é um assistente pessoal inteligente. Baseado no contexto completo do usuário, 
    sugira UMA tarefa específica e útil que faça sentido para a situação atual.
    
    Considere:
    - Tarefas já existentes (evite duplicatas)
    - Eventos próximos (prepare o usuário)
    - Padrões de atividade
    - Data atual e prazos
    - Produtividade pessoal
    
    Responda APENAS com o texto da tarefa, sem explicações.
    Seja específico e prático.
    """
    
    suggestion = call_gemini_api(prompt, user_context)
    return jsonify({'suggestion': suggestion.strip()})

@app.route('/api/todos/overdue', methods=['GET'])
def get_overdue_todos():
    """Retorna tarefas vencidas"""
    db = load_db()
    overdue_todos = []
    current_time = datetime.now()
    
    for todo in db['todos']:
        if not todo.get('completed', False) and todo.get('due_date'):
            try:
                due_datetime = datetime.fromisoformat(todo['due_date'].replace('Z', '+00:00'))
                if due_datetime < current_time:
                    overdue_todos.append(todo)
            except:
                continue
    
    return jsonify(overdue_todos)

@app.route('/api/todos/upcoming', methods=['GET'])
def get_upcoming_todos():
    """Retorna tarefas próximas do vencimento (próximas 7 dias)"""
    db = load_db()
    upcoming_todos = []
    current_time = datetime.now()
    week_ahead = current_time + timedelta(days=7)
    
    for todo in db['todos']:
        if not todo.get('completed', False) and todo.get('due_date'):
            try:
                due_datetime = datetime.fromisoformat(todo['due_date'].replace('Z', '+00:00'))
                if current_time <= due_datetime <= week_ahead:
                    upcoming_todos.append(todo)
            except:
                continue
    
    return jsonify(upcoming_todos)

@app.route('/api/calendar/data', methods=['GET'])
def get_calendar_data():
    """Retorna dados combinados de tarefas e eventos para o calendário"""
    db = load_db()
    calendar_data = {
        'todos': [],
        'events': db['events']
    }
    
    # Incluir apenas tarefas com data limite
    for todo in db['todos']:
        if todo.get('due_date'):
            calendar_data['todos'].append(todo)
    
    return jsonify(calendar_data)

# API Routes - Events
@app.route('/api/events', methods=['GET'])
def get_events():
    db = load_db()
    return jsonify(db['events'])

@app.route('/api/events', methods=['POST'])
def add_event():
    db = load_db()
    data = request.json
    
    event = {
        'id': str(uuid.uuid4()),
        'text': data['text'],
        'datetime': data['datetime'],
        'created_at': datetime.now().isoformat()
    }
    
    db['events'].append(event)
    save_db(db)
    
    return jsonify({'success': True, 'event': event})

@app.route('/api/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    db = load_db()
    
    db['events'] = [event for event in db['events'] if event['id'] != event_id]
    save_db(db)
    
    return jsonify({'success': True})

@app.route('/api/events/suggest', methods=['GET'])
def suggest_event():
    user_context = get_user_context()
    
    prompt = """
    Você é um assistente pessoal inteligente. Baseado no contexto completo do usuário,
    sugira UM evento útil e relevante que faça sentido para a agenda atual.
    
    Considere:
    - Eventos já agendados (evite conflitos)
    - Tarefas pendentes (que precisam de tempo dedicado)
    - Padrões de atividade
    - Data atual e disponibilidade
    - Produtividade e bem-estar
    
    Responda no formato JSON EXATO:
    {
        "text": "nome específico do evento",
        "datetime": "YYYY-MM-DDTHH:MM"
    }
    
    Use uma data/hora realista nos próximos 7 dias.
    """
    
    suggestion = call_gemini_api(prompt, user_context)
    
    try:
        # Tenta fazer parse do JSON
        import re
        json_match = re.search(r'\{.*\}', suggestion, re.DOTALL)
        if json_match:
            suggestion_data = json.loads(json_match.group())
        else:
            # Fallback inteligente baseado no contexto
            suggestion_data = {
                "text": suggestion.strip().replace('"', ''),
                "datetime": (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%dT09:00')
            }
    except:
        # Fallback inteligente
        suggestion_data = {
            "text": "Revisar tarefas pendentes",
            "datetime": (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%dT09:00')
        }
    
    return jsonify({'suggestion': suggestion_data})

# API Routes - Chat
@app.route('/api/chat', methods=['POST'])
def chat():
    db = load_db()
    
    message = request.form.get('message', '')
    file = request.files.get('file')
    
    file_content = ""
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{filename}")
        file.save(filepath)
        
        # Extrai texto do arquivo
        file_content = extract_text_from_file(filepath)
        
        # Remove o arquivo após processar (opcional)
        # os.remove(filepath)
    
    # Contexto completo do usuário
    user_context = get_user_context()
    
    # Monta o prompt inteligente
    prompt = f"""
    Você é um assistente pessoal inteligente e prestativo. Você tem acesso completo aos dados do usuário.
    
    INSTRUÇÕES:
    - Responda de forma natural, útil e personalizada
    - Use os dados do usuário para dar respostas contextualizadas
    - Sugira ações baseadas nas tarefas e eventos
    - Alerte sobre prazos próximos
    - Seja proativo em sugestões de produtividade
    - Mantenha um tom amigável e profissional
    - IMPORTANTE: Seja CONCISO. Máximo 300 caracteres na resposta.
    - Vá direto ao ponto, sem enrolação.
    
    {f"ARQUIVO ENVIADO: {file_content}" if file_content else ""}
    
    MENSAGEM DO USUÁRIO: {message}
    """
    
    # Chama a API Gemini com contexto completo
    response = call_gemini_api(prompt, user_context)
    
    # Salva no histórico
    chat_entry = {
        'id': str(uuid.uuid4()),
        'user': message,
        'bot': response,
        'timestamp': datetime.now().isoformat(),
        'has_file': bool(file_content)
    }
    
    db['chat_history'].append(chat_entry)
    
    # Limita o histórico a 50 mensagens
    if len(db['chat_history']) > 50:
        db['chat_history'] = db['chat_history'][-50:]
    
    save_db(db)
    
    return jsonify({'reply': response})

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    db = load_db()
    return jsonify(db['chat_history'])

# Rota de health check
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

if __name__ == '__main__':
    print("🚀 Iniciando AI Assistant Hub...")
    
    # Configurações para produção no Railway
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"📱 Frontend: http://0.0.0.0:{port}")
    print(f"🔧 API: http://0.0.0.0:{port}/api/")
    print("🤖 Gemini API: Configurada")
    print(f"🌐 Modo: {'Debug' if debug else 'Produção'}")
    
    app.run(debug=debug, host='0.0.0.0', port=port) 