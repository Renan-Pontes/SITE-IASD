"""
Remove registros de auditoria antigos (retenção).

Rode periodicamente (ex.: tarefa agendada mensal no PythonAnywhere):
    python manage.py purgar_auditoria            # remove > 90 dias
    python manage.py purgar_auditoria --dias 30  # remove > 30 dias
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from API.models import AuditLog


class Command(BaseCommand):
    help = "Remove registros de auditoria mais antigos que N dias (padrão 90)."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=90)

    def handle(self, *args, **options):
        dias = options["dias"]
        limite = timezone.now() - timedelta(days=dias)
        removidos, _ = AuditLog.objects.filter(criado_em__lt=limite).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"{removidos} registro(s) de auditoria com mais de {dias} dias removido(s)."
            )
        )
