"""
Encerra pautas abertas cujo prazo expirou ou que atingiram o quórum.

Rode periodicamente (ex.: tarefa agendada diária no PythonAnywhere):
    python manage.py fechar_pautas
"""

from django.core.management.base import BaseCommand

from API.models import EnqueteGrupo, Pauta, StatusPauta


class Command(BaseCommand):
    help = "Encerra pautas (prazo/quórum) e enquetes de grupo com prazo expirado."

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

        enquetes = 0
        for enq in EnqueteGrupo.objects.filter(encerrada=False, prazo__isnull=False):
            if enq.fechar_se_expirada():
                enquetes += 1
                self.stdout.write(f"  enquete encerrada: {enq.pergunta[:40]} (#{enq.id})")
        self.stdout.write(
            self.style.SUCCESS(f"{enquetes} enquete(s) encerrada(s).")
        )
