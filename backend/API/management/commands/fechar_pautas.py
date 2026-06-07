"""
Encerra pautas abertas cujo prazo expirou ou que atingiram o quórum.

Rode periodicamente (ex.: tarefa agendada diária no PythonAnywhere):
    python manage.py fechar_pautas
"""

from django.core.management.base import BaseCommand

from API.models import Pauta, StatusPauta


class Command(BaseCommand):
    help = "Encerra pautas com prazo expirado ou quórum atingido."

    def handle(self, *args, **options):
        abertas = Pauta.objects.filter(status=StatusPauta.ABERTA)
        fechadas = 0
        for pauta in abertas:
            if pauta.fechar_se_necessario():
                fechadas += 1
                self.stdout.write(f"  encerrada: {pauta.titulo} (#{pauta.id})")
        self.stdout.write(
            self.style.SUCCESS(f"{fechadas} pauta(s) encerrada(s).")
        )
