"""
Desativa contas inativas há muito tempo (padrão: 180 dias sem login).

    python manage.py desativar_inativos                 # desativa de fato
    python manage.py desativar_inativos --dry-run        # só lista, não altera
    python manage.py desativar_inativos --dias 365       # outro limite

Agende em produção (ex.: tarefa diária/semanal no PythonAnywhere). Contas com
super admin / staff nunca são desativadas. Quem nunca logou usa a data de
cadastro como referência. Usuários reativam via solicitação à liderança.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from API.models import AuditLog, Notificacao

User = get_user_model()


class Command(BaseCommand):
    help = "Desativa contas sem login há N dias (padrão 180)."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=180)
        parser.add_argument("--dry-run", action="store_true", default=False)

    def handle(self, *args, **options):
        dias = options["dias"]
        dry = options["dry_run"]
        corte = timezone.now() - timedelta(days=dias)

        # Inativos: sem login desde o corte, OU nunca logaram e se cadastraram
        # antes do corte. Preserva super admins, staff e quem já está inativo.
        candidatos = (
            User.objects.filter(is_active=True, is_superuser=False, is_staff=False)
            .filter(
                Q(last_login__lt=corte)
                | Q(last_login__isnull=True, date_joined__lt=corte)
            )
            .exclude(profile__is_super_admin=True)
        )

        total = 0
        for u in candidatos:
            ref = u.last_login or u.date_joined
            self.stdout.write(
                f"  {'(dry) ' if dry else ''}{u.email or u.username} — último acesso {ref:%d/%m/%Y}"
            )
            if dry:
                total += 1
                continue
            u.is_active = False
            u.save(update_fields=["is_active"])
            AuditLog.objects.create(
                acao="desativar_inativo_auto", entidade="User", entidade_id=u.id,
                detalhes={"dias": dias},
            )
            Notificacao.objects.create(
                usuario=u, tipo="conta_desativada",
                titulo="Conta desativada por inatividade",
                mensagem=(
                    f"Sua conta foi desativada após {dias} dias sem acesso. "
                    "Para reativá-la, solicite à liderança da sua igreja."
                ),
            )
            total += 1

        verbo = "seriam desativadas" if dry else "desativadas"
        self.stdout.write(self.style.SUCCESS(f"{total} conta(s) {verbo}."))
