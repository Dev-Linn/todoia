import os

# Configurações do servidor
bind = f"0.0.0.0:{os.environ.get('PORT', 5000)}"
workers = 1  # Railway tem recursos limitados
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 100

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Preload app
preload_app = True

# Configurações específicas para Flask
pythonpath = "/app/backend" 