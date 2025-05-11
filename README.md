# Alpaca AI

A modern chat interface for Ollama with custom model management and persistent conversation history.

## Features

- Real-time chat with Ollama models
- Custom model creation with system prompts
- Persistent chat history
- Responsive design
- WebSocket-based streaming responses

## Screenshots

### Main Chat Interface
<kbd><img width="800" alt="Main chat interface" src="https://github.com/user-attachments/assets/3cc6434d-a984-4a68-903e-81486735ddcd" /></kbd>

### Custom Model Creation
<kbd><img width="800" alt="Creating custom model with system prompt" src="https://github.com/user-attachments/assets/9b274327-f010-40e2-babd-938878d1b07b" /></kbd>

### Mr. Kitty Model Example
<kbd><img width="800" alt="Chat with Mr. Kitty custom model" src="https://github.com/user-attachments/assets/ea906b85-2998-406f-a8e3-cfa143596d2c" /></kbd>

### MathMentor Model Example
<kbd><img width="800" alt="Chat with MathMentor custom model" src="https://github.com/user-attachments/assets/9ca49fe0-da2c-481b-ac9a-0c9bea26e790" /></kbd>

## Requirements

- Python 3.8+
- Ollama installed and running
- Dependencies: `flask`, `flask-socketio`, `ollama`

## Installation

```bash
# Clone repository
git clone https://github.com/muyeed15/alpaca-ai.git
cd alpaca-ai

# Install dependencies
pip install flask flask-socketio ollama

# Run application
python app.py
```

Visit `http://localhost:5000` in your browser.

## Usage

1. Select a model from the dropdown
2. Click "New Chat" to start
3. Type messages and press Enter to send
4. Create custom models via "Manage Models"

## Project Structure

```
alpaca-ai/
├── app.py                # Flask application
├── static/
│   ├── css/style.css    # Styles
│   └── js/main.js       # Client JavaScript
└── templates/
    └── index.html       # Main template
```

## License

MIT License
