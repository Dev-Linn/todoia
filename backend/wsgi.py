#!/usr/bin/env python3
"""
WSGI entry point for Gunicorn
"""
import os
import sys

# Adicionar o diretório backend ao Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import app
    
    # Configurar logging para produção
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(name)s %(message)s'
    )
    
    # Verificar se todas as configurações estão corretas
    print("🚀 Iniciando aplicação via WSGI...")
    print(f"📍 Diretório de trabalho: {os.getcwd()}")
    print(f"🐍 Python path: {sys.path}")
    
    if __name__ == "__main__":
        app.run()
    
except Exception as e:
    print(f"❌ Erro ao inicializar aplicação: {e}")
    import traceback
    traceback.print_exc()
    raise 