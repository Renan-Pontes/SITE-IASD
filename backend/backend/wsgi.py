"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/

No PythonAnywhere, aponte o arquivo WSGI do Web tab para este módulo (ou copie
este conteúdo). O .env é carregado aqui e também em settings.py.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Carrega o backend/.env antes de inicializar o Django.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
