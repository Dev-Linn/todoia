# 🤖 AI Assistant Hub

Um MVP completo de assistente AI com To-Do List inteligente, Chatbot e Calendário integrados com Gemini 2.0 Flash.

## ✨ Funcionalidades

### 📋 To-Do List Inteligente
- ✅ Adicionar, editar e remover tarefas
- 🎯 Marcar tarefas como concluídas
- 🤖 Sugestões de tarefas geradas por IA
- 📊 Estatísticas em tempo real
- 🎨 Interface moderna e responsiva

### 💬 Chatbot com IA
- 🤖 Conversas naturais com Gemini 2.0 Flash
- 📎 Upload e análise de arquivos (PDF, DOC, TXT, imagens)
- 💾 Histórico de conversas persistente
- 🔄 Contexto mantido entre mensagens
- ⚡ Respostas em tempo real

### 📅 Calendário Smart
- 📆 Visualização de calendário interativo
- ➕ Adicionar eventos com data/hora
- 🤖 Sugestões de eventos por IA
- 📋 Lista de próximos eventos
- 🗑️ Gerenciamento completo de eventos

## 🚀 Instalação

### Pré-requisitos
- Python 3.8+
- Chave da API Gemini (gratuita)

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd ai-assistant-hub
```

### 2. Instale as dependências
```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure a API Gemini
1. Acesse [Google AI Studio](https://aistudio.google.com/apikey)
2. Crie uma chave de API gratuita
3. Edite o arquivo `backend/config.py` na linha 5:
```python
GEMINI_API_KEY = "SUA_CHAVE_AQUI"
```

### 4. Execute o servidor
```bash
cd backend
python app.py
```

### 5. Acesse a aplicação
Abra seu navegador em: `http://localhost:5000`

## 🛠️ Estrutura do Projeto

```
ai-assistant-hub/
├── frontend/
│   ├── index.html      # Interface principal
│   ├── style.css       # Estilos modernos
│   └── script.js       # Lógica do frontend
├── backend/
│   ├── app.py          # Servidor Flask principal
│   ├── requirements.txt # Dependências Python
│   ├── config.py       # Configurações
│   ├── db.json         # Banco de dados JSON
│   └── uploads/        # Arquivos enviados
└── README.md
```

## 🔧 Tecnologias Utilizadas

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Design moderno com gradientes e animações
- **JavaScript ES6+** - Lógica reativa e assíncrona
- **Font Awesome** - Ícones profissionais
- **Google Fonts** - Tipografia moderna

### Backend
- **Flask** - Framework web Python
- **Gemini 2.0 Flash** - IA generativa do Google
- **PyPDF2** - Processamento de PDFs
- **python-docx** - Processamento de documentos Word
- **Pillow** - Processamento de imagens
- **JSON** - Banco de dados simples

## 🎯 Como Usar

### To-Do List
1. Digite uma tarefa no campo de entrada
2. Clique em "Adicionar" ou pressione Enter
3. Use "Sugestão IA" para ideias automáticas
4. Marque tarefas como concluídas
5. Exclua tarefas desnecessárias

### Chatbot
1. Digite uma mensagem no campo de chat
2. Envie arquivos usando o botão de anexo
3. Receba respostas inteligentes da IA
4. Mantenha conversas contextuais

### Calendário
1. Adicione eventos com data e hora
2. Navegue entre meses
3. Use "Sugestão IA" para eventos automáticos
4. Visualize eventos no calendário
5. Gerencie sua agenda facilmente

## 🔐 Segurança

- ✅ Validação de tipos de arquivo
- ✅ Sanitização de nomes de arquivo
- ✅ Limitação de tamanho de upload
- ✅ Tratamento de erros robusto
- ✅ CORS configurado adequadamente

## 📈 Próximas Melhorias

- [ ] Autenticação de usuários
- [ ] Notificações push
- [ ] Sincronização em nuvem
- [ ] Temas personalizáveis
- [ ] Integração com Google Calendar
- [ ] Exportação de dados
- [ ] Aplicativo mobile

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Se encontrar problemas:

1. Verifique se a chave da API Gemini está configurada
2. Confirme que todas as dependências estão instaladas
3. Verifique os logs do servidor para erros
4. Abra uma issue no GitHub com detalhes do problema

---

**Desenvolvido com ❤️ e IA**

*Este é um MVP demonstrativo da integração entre frontend moderno e IA generativa.* 