from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from ollama import ListResponse, list as ollama_list, chat as ollama_chat
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'alpaca-secure-key-2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Database initialization
def init_database():
    """Initialize the SQLite database with required tables"""
    os.makedirs('instance', exist_ok=True)
    conn = sqlite3.connect('instance/alpaca.db')
    cursor = conn.cursor()
    
    # Create chats table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )
    ''')
    
    # Create custom models table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS custom_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            base_model TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_database()

@app.route('/')
def index():
    """Render the main chat interface"""
    return render_template('index.html')

@app.route('/api/models', methods=['GET'])
def get_models():
    """Get available Ollama models and custom models"""
    try:
        # Get base models from Ollama
        response: ListResponse = ollama_list()
        base_models = []
        
        for model in response.models:
            model_info = {
                'name': model.model,
                'size': f'{(model.size.real / 1024 / 1024):.2f} MB',
                'type': 'base'
            }
            
            if model.details:
                model_info['format'] = model.details.format
                model_info['family'] = model.details.family
                model_info['parameter_size'] = model.details.parameter_size
                model_info['quantization_level'] = model.details.quantization_level
            
            base_models.append(model_info)
        
        # Get custom models
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT name, base_model, system_prompt 
            FROM custom_models 
            ORDER BY name
        ''')
        
        custom_models = []
        for row in cursor.fetchall():
            custom_models.append({
                'name': row[0],
                'base_model': row[1],
                'system_prompt': row[2],
                'type': 'custom'
            })
        
        conn.close()
        
        return jsonify({
            'success': True, 
            'models': base_models + custom_models
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/custom-models', methods=['GET'])
def get_custom_models():
    """Get all custom models"""
    try:
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, base_model, system_prompt, created_at, updated_at 
            FROM custom_models 
            ORDER BY name
        ''')
        
        models = []
        for row in cursor.fetchall():
            models.append({
                'id': row[0],
                'name': row[1],
                'base_model': row[2],
                'system_prompt': row[3],
                'created_at': row[4],
                'updated_at': row[5]
            })
        
        conn.close()
        return jsonify({'success': True, 'models': models})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/custom-model', methods=['POST'])
def create_custom_model():
    """Create a new custom model"""
    try:
        data = request.json
        name = data.get('name')
        base_model = data.get('base_model')
        system_prompt = data.get('system_prompt')
        
        if not all([name, base_model, system_prompt]):
            return jsonify({'success': False, 'error': 'All fields are required'}), 400
        
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO custom_models (name, base_model, system_prompt) 
            VALUES (?, ?, ?)
        ''', (name, base_model, system_prompt))
        
        model_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'model_id': model_id})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Model name already exists'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/custom-model/<int:model_id>', methods=['PUT'])
def update_custom_model(model_id):
    """Update a custom model"""
    try:
        data = request.json
        name = data.get('name')
        base_model = data.get('base_model')
        system_prompt = data.get('system_prompt')
        
        if not all([name, base_model, system_prompt]):
            return jsonify({'success': False, 'error': 'All fields are required'}), 400
        
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE custom_models 
            SET name = ?, base_model = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (name, base_model, system_prompt, model_id))
        
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'error': 'Model not found'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Model name already exists'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/custom-model/<int:model_id>', methods=['DELETE'])
def delete_custom_model(model_id):
    """Delete a custom model"""
    try:
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM custom_models WHERE id = ?', (model_id,))
        
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'error': 'Model not found'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chats', methods=['GET'])
def get_chats():
    """Get all chats sorted by most recent"""
    try:
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, title, model, created_at, updated_at 
            FROM chats 
            ORDER BY updated_at DESC
        ''')
        
        chats = []
        for row in cursor.fetchall():
            chats.append({
                'id': row[0],
                'title': row[1],
                'model': row[2],
                'created_at': row[3],
                'updated_at': row[4]
            })
        
        conn.close()
        return jsonify({'success': True, 'chats': chats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def create_chat():
    """Create a new chat"""
    try:
        data = request.json
        title = data.get('title', 'New Chat')
        model = data.get('model')
        
        if not model:
            return jsonify({'success': False, 'error': 'Model is required'}), 400
        
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO chats (title, model) 
            VALUES (?, ?)
        ''', (title, model))
        
        chat_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'chat_id': chat_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/<int:chat_id>', methods=['GET'])
def get_chat(chat_id):
    """Get a specific chat with its messages"""
    try:
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        # Get chat info
        cursor.execute('SELECT * FROM chats WHERE id = ?', (chat_id,))
        chat = cursor.fetchone()
        
        if not chat:
            return jsonify({'success': False, 'error': 'Chat not found'}), 404
        
        # Get messages
        cursor.execute('''
            SELECT role, content, created_at 
            FROM messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        ''', (chat_id,))
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                'role': row[0],
                'content': row[1],
                'created_at': row[2]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'chat': {
                'id': chat[0],
                'title': chat[1],
                'model': chat[2],
                'created_at': chat[3],
                'updated_at': chat[4]
            },
            'messages': messages
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat/<int:chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    """Delete a chat and all its messages"""
    try:
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        # Delete chat (messages will be deleted by CASCADE)
        cursor.execute('DELETE FROM chats WHERE id = ?', (chat_id,))
        
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'error': 'Chat not found'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    emit('connected', {'status': 'Connected to Alpaca AI'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

@socketio.on('send_message')
def handle_message(data):
    """Handle incoming message and generate response"""
    try:
        chat_id = data.get('chat_id')
        message = data.get('message')
        model = data.get('model')
        
        if not all([chat_id, message, model]):
            emit('error', {'error': 'Missing required fields'})
            return
        
        conn = sqlite3.connect('instance/alpaca.db')
        cursor = conn.cursor()
        
        # Check if model is custom
        cursor.execute('SELECT base_model, system_prompt FROM custom_models WHERE name = ?', (model,))
        custom_model = cursor.fetchone()
        
        # Save user message
        cursor.execute('''
            INSERT INTO messages (chat_id, role, content) 
            VALUES (?, ?, ?)
        ''', (chat_id, 'user', message))
        
        # Get conversation history
        cursor.execute('''
            SELECT role, content 
            FROM messages 
            WHERE chat_id = ? 
            ORDER BY created_at
        ''', (chat_id,))
        
        messages = []
        
        # Add system prompt if using custom model
        if custom_model:
            base_model = custom_model[0]
            system_prompt = custom_model[1]
            messages.append({
                'role': 'system',
                'content': system_prompt
            })
        else:
            base_model = model
        
        # Add conversation history
        for row in cursor.fetchall():
            messages.append({
                'role': row[0],
                'content': row[1]
            })
        
        # Update chat timestamp
        cursor.execute('''
            UPDATE chats 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', (chat_id,))
        
        conn.commit()
        
        # Generate response
        emit('response_start', {'chat_id': chat_id})
        
        response_content = ""
        stream = ollama_chat(model=base_model, messages=messages, stream=True)
        
        for chunk in stream:
            if 'message' in chunk and 'content' in chunk['message']:
                chunk_content = chunk['message']['content']
                response_content += chunk_content
                emit('response_chunk', {
                    'chat_id': chat_id,
                    'content': chunk_content
                })
        
        # Save assistant response
        cursor.execute('''
            INSERT INTO messages (chat_id, role, content) 
            VALUES (?, ?, ?)
        ''', (chat_id, 'assistant', response_content))
        
        # Update chat title if it's the first message
        cursor.execute('SELECT COUNT(*) FROM messages WHERE chat_id = ?', (chat_id,))
        message_count = cursor.fetchone()[0]
        
        if message_count == 2:  # First exchange (user + assistant)
            title = message[:50] + '...' if len(message) > 50 else message
            cursor.execute('UPDATE chats SET title = ? WHERE id = ?', (title, chat_id))
        
        conn.commit()
        conn.close()
        
        emit('response_complete', {'chat_id': chat_id})
        
    except Exception as e:
        emit('error', {'error': str(e)})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)