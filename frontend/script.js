// Estado da aplicação
const AppState = {
    currentTab: 'todo',
    todos: [],
    events: [],
    currentMonth: 6, // Julho (0-based: janeiro=0, julho=6)
    currentYear: 2025,
    selectedFile: null,
    currentFilter: 'all',
    calendarView: 'month'
};

// Utilitários
const Utils = {
    showLoading: () => document.getElementById('loading').classList.add('active'),
    hideLoading: () => document.getElementById('loading').classList.remove('active'),
    
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },
    
    formatDateTime: (date) => {
        return new Date(date).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    formatDateForInput: (date) => {
        return new Date(date).toISOString().split('T')[0];
    },

    isOverdue: (dueDate) => {
        if (!dueDate) return false;
        const due = new Date(dueDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return due < now;
    },

    isUpcoming: (dueDate) => {
        if (!dueDate) return false;
        const due = new Date(dueDate);
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return due >= now && due <= tomorrow;
    },

    isUrgent: (dueDate) => {
        if (!dueDate) return false;
        const due = new Date(dueDate);
        const now = new Date();
        const diffTime = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7 && !Utils.isOverdue(dueDate);
    },

    showNotification: (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// API Service
const API = {
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`/api${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            Utils.showNotification('Erro na comunicação com o servidor', 'error');
            throw error;
        }
    },

    // TODO API
    async getTodos() {
        return this.request('/todos');
    },

    async addTodo(text, dueDate = null, notes = null, priority = 'normal') {
        const response = await this.request('/todos', {
            method: 'POST',
            body: JSON.stringify({ 
                text, 
                due_date: dueDate || null,
                notes: notes || null,
                priority: priority || 'normal'
            })
        });
        
        return response;
    },

    async updateTodo(id, updates) {
        return this.request(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteTodo(id) {
        return this.request(`/todos/${id}`, {
            method: 'DELETE'
        });
    },

    async suggestTodo() {
        return this.request('/todos/suggest');
    },

    async getOverdueTodos() {
        return this.request('/todos/overdue');
    },

    async getUpcomingTodos() {
        return this.request('/todos/upcoming');
    },

    // Chat API
    async sendMessage(message, file = null) {
        const formData = new FormData();
        formData.append('message', message);
        if (file) {
            formData.append('file', file);
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    },

    // Calendar API
    async getEvents() {
        return this.request('/events');
    },

    async addEvent(text, datetime) {
        return this.request('/events', {
            method: 'POST',
            body: JSON.stringify({ text, datetime })
        });
    },

    async deleteEvent(id) {
        return this.request(`/events/${id}`, {
            method: 'DELETE'
        });
    },

    async suggestEvent() {
        return this.request('/events/suggest');
    },

    async getCalendarData() {
        return this.request('/calendar/data');
    }
};

// Navegação entre abas
class TabManager {
    constructor() {
        this.initTabs();
    }

    initTabs() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                
                // Remove active class from all items
                navItems.forEach(nav => nav.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                document.getElementById(tabId).classList.add('active');
                
                AppState.currentTab = tabId;
                
                // Initialize tab specific functionality
                this.initTabContent(tabId);
            });
        });
    }

    initTabContent(tabId) {
        switch(tabId) {
            case 'todo':
                TodoManager.init();
                break;
            case 'chat':
                ChatManager.init();
                break;
            case 'calendar':
                CalendarManager.init();
                break;
        }
    }
}

// Gerenciador de To-Do
class TodoManager {
    static init() {
        this.loadTodos();
        this.bindEvents();
    }

    static bindEvents() {
        const todoInput = document.getElementById('todo-input');
        const addTodoBtn = document.getElementById('add-todo-btn');
        const todoList = document.getElementById('todo-list');
        const filterBtns = document.querySelectorAll('.filter-btn');
        
        // Permitir digitação no input
        if (todoInput) {
            // Remover readonly para permitir digitação
            todoInput.removeAttribute('readonly');
            
            // Remover event listeners existentes
            todoInput.removeEventListener('keypress', this.handleInputKeypress);
            
            // Abrir modal ao pressionar Enter
            this.handleInputKeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    TodoManager.openModalWithText(todoInput.value.trim());
                }
            };
            todoInput.addEventListener('keypress', this.handleInputKeypress);
        }
        
        // Abrir modal ao clicar no botão
        if (addTodoBtn) {
            // Remover event listeners existentes
            addTodoBtn.removeEventListener('click', this.handleAddBtnClick);
            
            this.handleAddBtnClick = () => {
                const text = todoInput ? todoInput.value.trim() : '';
                TodoManager.openModalWithText(text);
            };
            addTodoBtn.addEventListener('click', this.handleAddBtnClick);
        }
        
        // Fechar modal
        const closeBtn = document.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                Modal.close('todo-modal');
            });
        }
        
        // Botões de prioridade
        const priorityBtns = document.querySelectorAll('.priority-btn');
        priorityBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                priorityBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Cancelar modal
        const cancelBtn = document.getElementById('cancel-todo');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                Modal.close('todo-modal');
            });
        }
        
        // Submeter tarefa pelo modal
        const submitBtn = document.getElementById('submit-todo');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                TodoManager.addTodoFromModal();
            });
        }
        
        // Filtros
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.currentFilter = btn.dataset.filter;
                this.renderTodos();
            });
        });
        
        // Delegação de eventos para todos
        if (todoList) {
            todoList.addEventListener('click', (e) => {
                if (e.target.classList.contains('todo-toggle')) {
                    TodoManager.toggleTodo(e.target.dataset.id);
                } else if (e.target.classList.contains('todo-delete')) {
                    TodoManager.deleteTodo(e.target.dataset.id);
                }
            });
        }
    }

    static openModalWithText(text) {
        // Preencher o modal com o texto do input
        const descriptionField = document.getElementById('task-description');
        
        if (descriptionField) {
            descriptionField.value = text;
        }
        
        // Limpar o input principal
        const todoInput = document.getElementById('todo-input');
        if (todoInput) {
            todoInput.value = '';
        }
        
        // Abrir modal
        Modal.open('todo-modal');
        
        // Focar no campo de descrição
        setTimeout(() => {
            if (descriptionField) {
                descriptionField.focus();
            }
        }, 100);
    }

    static async loadTodos() {
        try {
            Utils.showLoading();
            AppState.todos = await API.getTodos();
            this.renderTodos();
            this.updateStats();
        } catch (error) {
            console.error('Error loading todos:', error);
        } finally {
            Utils.hideLoading();
        }
    }

    static async addTodoFromModal() {
        const description = document.getElementById('task-description').value.trim();
        const dueDate = document.getElementById('task-due-date').value;
        const notes = document.getElementById('task-notes').value.trim();
        const activePriorityBtn = document.querySelector('.priority-btn.active');
        const priority = activePriorityBtn ? activePriorityBtn.dataset.priority : 'normal';
        
        if (!description) {
            Utils.showNotification('Por favor, digite uma descrição para a tarefa', 'error');
            return;
        }
        
        try {
            const response = await API.addTodo(description, dueDate, notes, priority);
            
            if (response.success) {
                // Recarregar a lista completa ao invés de adicionar manualmente
                await this.loadTodos();
                Utils.showNotification('Tarefa adicionada com sucesso!', 'success');
                
                // Limpar formulário
                document.getElementById('task-description').value = '';
                document.getElementById('task-due-date').value = '';
                document.getElementById('task-notes').value = '';
                document.querySelectorAll('.priority-btn').forEach(btn => btn.classList.remove('active'));
                
                // Fechar modal
                Modal.close('todo-modal');
            } else {
                Utils.showNotification(response.message || 'Erro ao adicionar tarefa', 'error');
            }
        } catch (error) {
            console.error('Erro ao adicionar tarefa:', error);
            Utils.showNotification('Erro ao adicionar tarefa', 'error');
        }
    }

    static async toggleTodo(id) {
        try {
            const todo = AppState.todos.find(t => t.id === id);
            await API.updateTodo(id, { completed: !todo.completed });
            await this.loadTodos();
        } catch (error) {
            console.error('Error toggling todo:', error);
        }
    }

    static async deleteTodo(id) {
        try {
            await API.deleteTodo(id);
            await this.loadTodos();
            Utils.showNotification('Tarefa removida!');
        } catch (error) {
            console.error('Error deleting todo:', error);
        }
    }

    static async suggestTodo() {
        try {
            Utils.showLoading();
            const response = await API.suggestTodo();
            document.getElementById('todo-input').value = response.suggestion;
            Utils.showNotification('Sugestão da IA carregada!');
        } catch (error) {
            console.error('Error getting suggestion:', error);
        } finally {
            Utils.hideLoading();
        }
    }

    static getFilteredTodos() {
        let filteredTodos = AppState.todos;

        switch(AppState.currentFilter) {
            case 'pending':
                filteredTodos = AppState.todos.filter(t => !t.completed);
                break;
            case 'completed':
                filteredTodos = AppState.todos.filter(t => t.completed);
                break;
            case 'overdue':
                filteredTodos = AppState.todos.filter(t => 
                    !t.completed && Utils.isOverdue(t.due_date)
                );
                break;
            case 'upcoming':
                filteredTodos = AppState.todos.filter(t => 
                    !t.completed && Utils.isUpcoming(t.due_date)
                );
                break;
        }

        return filteredTodos;
    }

    static renderTodos() {
        const todoList = document.getElementById('todo-list');
        if (!todoList) return;
        
        let filteredTodos = AppState.todos || [];
        
        // Aplicar filtro
        switch (AppState.currentFilter) {
            case 'pending':
                filteredTodos = filteredTodos.filter(todo => !todo.completed);
                break;
            case 'completed':
                filteredTodos = filteredTodos.filter(todo => todo.completed);
                break;
            case 'overdue':
                filteredTodos = filteredTodos.filter(t => {
                    if (!t.due_date || t.completed) return false;
                    return new Date(t.due_date) < new Date();
                });
                break;
            case 'upcoming':
                filteredTodos = filteredTodos.filter(t => {
                    if (!t.due_date || t.completed) return false;
                    const dueDate = new Date(t.due_date);
                    const today = new Date();
                    const diffTime = dueDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 7;
                });
                break;
        }
        
        todoList.innerHTML = filteredTodos.map(todo => {
            const dueDate = todo.due_date ? new Date(todo.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && !todo.completed;
            const isUrgent = dueDate && !todo.completed && Utils.isUrgent(todo.due_date);
            
            let dueDateClass = '';
            let itemClass = '';
            
            if (isOverdue) {
                dueDateClass = 'overdue';
                itemClass = 'overdue';
            } else if (isUrgent) {
                dueDateClass = 'urgent';
                itemClass = 'urgent';
            }
            
            // Adicionar classe de prioridade
            if (todo.priority && todo.priority !== 'normal') {
                itemClass += ` ${todo.priority}-priority`;
            }
            
            return `
                <div class="todo-item ${todo.completed ? 'completed' : ''} ${itemClass}">
                    <div class="todo-content">
                        <div class="todo-main">
                            <span class="priority-indicator ${todo.priority || 'normal'}"></span>
                            <input type="checkbox" class="todo-toggle" data-id="${todo.id}" ${todo.completed ? 'checked' : ''}>
                <span class="todo-text">${todo.text}</span>
                        </div>
                        ${todo.notes ? `<div class="todo-notes">${todo.notes}</div>` : ''}
                        ${dueDate ? `<div class="todo-due-date ${dueDateClass}">${Utils.formatDate(dueDate)}</div>` : ''}
                    </div>
                    <button class="todo-delete" data-id="${todo.id}">×</button>
                </div>
            `;
        }).join('');
    }

    static updateStats() {
        const total = AppState.todos.length;
        const completed = AppState.todos.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = AppState.todos.filter(t => !t.completed && Utils.isOverdue(t.due_date)).length;

        document.getElementById('total-todos').textContent = total;
        document.getElementById('completed-todos').textContent = completed;
        document.getElementById('pending-todos').textContent = pending;
        document.getElementById('overdue-todos').textContent = overdue;
    }
}

// Gerenciador de Chat
class ChatManager {
    static init() {
        this.bindEvents();
    }

    static bindEvents() {
        const form = document.getElementById('chat-form');
        const fileBtn = document.getElementById('file-btn');
        const fileInput = document.getElementById('file-input');

        // Remover event listeners existentes para evitar duplicatas
        if (form) {
            form.replaceWith(form.cloneNode(true));
            const newForm = document.getElementById('chat-form');
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.sendMessage();
            });
        }

        if (fileBtn) {
            fileBtn.replaceWith(fileBtn.cloneNode(true));
            const newFileBtn = document.getElementById('file-btn');
            newFileBtn.addEventListener('click', () => {
                document.getElementById('file-input').click();
            });
        }

        if (fileInput) {
            fileInput.replaceWith(fileInput.cloneNode(true));
            const newFileInput = document.getElementById('file-input');
            newFileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
        }
    }

    static handleFileSelect(file) {
        AppState.selectedFile = file;
        const preview = document.getElementById('file-preview');
        
        if (file) {
            preview.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <i class="fas fa-file"></i>
                    <span>${file.name}</span>
                    <button onclick="ChatManager.removeFile()" style="background: #ff6b6b; color: white; border: none; border-radius: 4px; padding: 0.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            preview.classList.add('active');
        } else {
            preview.classList.remove('active');
        }
    }

    static removeFile() {
        AppState.selectedFile = null;
        document.getElementById('file-input').value = '';
        document.getElementById('file-preview').classList.remove('active');
    }

    static async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message && !AppState.selectedFile) return;

        try {
            Utils.showLoading();
            
            // Add user message to chat
            this.addMessage(message, 'user');
            
            // Send to API
            const response = await API.sendMessage(message, AppState.selectedFile);
            
            // Add bot response
            this.addMessage(response.reply, 'bot');
            
            // Clear inputs
            input.value = '';
            this.removeFile();
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('Desculpe, ocorreu um erro. Tente novamente.', 'bot');
        } finally {
            Utils.hideLoading();
        }
    }

    static addMessage(text, sender) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatar = sender === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-robot"></i>';
        
        // Remover apenas asteriscos de negrito
        let formattedText = text;
        if (sender === 'bot') {
            formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '$1');
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${formattedText.replace(/\n/g, '<br>')}</p>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Gerenciador de Calendário
class CalendarManager {
    static async init() {
        // Inicializar arrays vazios se não existirem
        if (!AppState.events) AppState.events = [];
        if (!AppState.calendarTodos) AppState.calendarTodos = [];
        
        this.bindEvents();
        this.renderCalendar(); // Renderizar imediatamente
        
        // Carregar dados em background
        try {
            await this.loadEvents();
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

    static bindEvents() {
        const form = document.getElementById('calendar-form');
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');

        if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addEvent();
        });
        }

        if (prevBtn) {
        // Remover event listeners existentes
        prevBtn.replaceWith(prevBtn.cloneNode(true));
        const newPrevBtn = document.getElementById('prev-month');
        newPrevBtn.addEventListener('click', () => {
            AppState.currentMonth--;
            if (AppState.currentMonth < 0) {
                AppState.currentMonth = 11;
                AppState.currentYear--;
            }
            this.renderCalendar();
        });
        }

        if (nextBtn) {
        // Remover event listeners existentes
        nextBtn.replaceWith(nextBtn.cloneNode(true));
        const newNextBtn = document.getElementById('next-month');
        newNextBtn.addEventListener('click', () => {
            AppState.currentMonth++;
            if (AppState.currentMonth > 11) {
                AppState.currentMonth = 0;
                AppState.currentYear++;
            }
            this.renderCalendar();
        });
        }
    }

    static async loadEvents() {
        try {
            const [events, calendarData] = await Promise.all([
                API.getEvents(),
                API.getCalendarData()
            ]);
            
            AppState.events = events || [];
            AppState.calendarTodos = calendarData.todos || [];
            
            this.renderEvents();
            this.renderUpcoming();
            this.renderCalendar(); // Re-renderizar com os dados carregados
        } catch (error) {
            console.error('Error loading events:', error);
            AppState.events = [];
            AppState.calendarTodos = [];
        }
    }

    static async addEvent() {
        const textInput = document.getElementById('event-input');
        const datetimeInput = document.getElementById('event-datetime');
        
        const text = textInput.value.trim();
        const datetime = datetimeInput.value;
        
        if (!text || !datetime) return;

        try {
            Utils.showLoading();
            await API.addEvent(text, datetime);
            textInput.value = '';
            datetimeInput.value = '';
            await this.loadEvents();
            this.renderCalendar();
            Utils.showNotification('Evento adicionado com sucesso!');
        } catch (error) {
            console.error('Error adding event:', error);
        } finally {
            Utils.hideLoading();
        }
    }

    static renderCalendar() {
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        const currentMonthElement = document.getElementById('current-month');
        const grid = document.getElementById('calendar-grid');
        
        if (!currentMonthElement || !grid) {
            console.error('Calendar elements not found');
            return;
        }

        currentMonthElement.textContent = `${monthNames[AppState.currentMonth]} ${AppState.currentYear}`;
        grid.innerHTML = '';

        const firstDay = new Date(AppState.currentYear, AppState.currentMonth, 1);
        const lastDay = new Date(AppState.currentYear, AppState.currentMonth + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Garantir que sempre mostramos 42 dias (6 semanas)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            // Marcar dias de outros meses
            if (date.getMonth() !== AppState.currentMonth) {
                dayElement.classList.add('other-month');
                dayElement.style.opacity = '0.3';
            }
            
            // Marcar o dia atual
            if (date.getTime() === today.getTime()) {
                dayElement.classList.add('today');
            }
            
            // Verificar eventos e tarefas para este dia
            const dateStr = date.toISOString().split('T')[0];
            const dayEvents = (AppState.events || []).filter(event => 
                event.datetime && event.datetime.split('T')[0] === dateStr
            );
            const dayTodos = (AppState.calendarTodos || []).filter(todo => 
                todo.due_date && todo.due_date.split('T')[0] === dateStr
            );

            if (dayEvents.length > 0 && dayTodos.length > 0) {
                dayElement.classList.add('has-both');
            } else if (dayEvents.length > 0) {
                dayElement.classList.add('has-event');
            } else if (dayTodos.length > 0) {
                dayElement.classList.add('has-todo');
            }

            dayElement.innerHTML = `
                <div class="calendar-day-number">${date.getDate()}</div>
                <div class="calendar-day-items">
                    ${dayTodos.map(todo => `<div class="calendar-item todo">${todo.text}</div>`).join('')}
                    ${dayEvents.map(event => `<div class="calendar-item event">${event.text}</div>`).join('')}
                </div>
            `;
            
            grid.appendChild(dayElement);
        }
    }

    static renderUpcoming() {
        const container = document.getElementById('upcoming-items');
        container.innerHTML = '';

        // Combinar todos e eventos próximos
        const now = new Date();
        const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const upcomingItems = [];

        // Adicionar tarefas próximas
        AppState.calendarTodos.forEach(todo => {
            if (!todo.completed && todo.due_date) {
                const dueDate = new Date(todo.due_date);
                if (dueDate >= now && dueDate <= weekAhead) {
                    upcomingItems.push({
                        type: 'todo',
                        text: todo.text,
                        date: dueDate,
                        isOverdue: Utils.isOverdue(todo.due_date),
                        isUrgent: Utils.isUpcoming(todo.due_date)
                    });
                }
            }
        });

        // Adicionar eventos próximos
        AppState.events.forEach(event => {
            if (event.datetime) {
                const eventDate = new Date(event.datetime);
                if (eventDate >= now && eventDate <= weekAhead) {
                    upcomingItems.push({
                        type: 'event',
                        text: event.text,
                        date: eventDate
                    });
                }
            }
        });

        // Ordenar por data
        upcomingItems.sort((a, b) => a.date - b.date);

        upcomingItems.forEach(item => {
            const div = document.createElement('div');
            let className = 'upcoming-item';
            
            if (item.type === 'todo') {
                if (item.isOverdue) className += ' overdue';
                else if (item.isUrgent) className += ' urgent';
            }

            div.className = className;
            div.innerHTML = `
                <div class="event-date">${Utils.formatDateTime(item.date)}</div>
                <div class="event-text">${item.text}</div>
            `;
            
            container.appendChild(div);
        });

        if (upcomingItems.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">Nenhum item próximo</p>';
        }
    }

    static renderEvents() {
        const container = document.getElementById('events-container');
        container.innerHTML = '';

        AppState.events.forEach(event => {
            const div = document.createElement('div');
            div.className = 'event-item';
            div.innerHTML = `
                <div class="event-date">${Utils.formatDateTime(event.datetime)}</div>
                <div class="event-text">${event.text}</div>
                <button class="btn-small btn-delete" onclick="CalendarManager.deleteEvent('${event.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            container.appendChild(div);
        });

        if (AppState.events.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">Nenhum evento cadastrado</p>';
        }
    }

    static async deleteEvent(id) {
        try {
            await API.deleteEvent(id);
            await this.loadEvents();
            this.renderCalendar();
            Utils.showNotification('Evento removido!');
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    }
}

// Adicionar no início do arquivo
const Modal = {
    open: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },
    
    close: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    },
    
    init: () => {
        // Fechar modal ao clicar fora
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                Modal.close(e.target.id);
            }
        });
        
        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    Modal.close(activeModal.id);
                }
            }
        });
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
    new TabManager(); // Criar instância da classe
    TodoManager.init();
    
    // Inicializar o calendário também para garantir que funcione
    setTimeout(() => {
        CalendarManager.init();
    }, 100);
});

// Adicionar estilos dinâmicos
    const style = document.createElement('style');
    style.textContent = `
    .empty-message {
        text-align: center;
        padding: 2rem;
        color: #666;
    }
    
    .calendar-day.other-month {
        opacity: 0.3;
    }
    
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);