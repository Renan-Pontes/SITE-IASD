"""
Garante que a igreja única (IASD Vila Formosa) exista — usada no modo
mono-igreja (MULTI_CHURCH_ENABLED=False).

    python manage.py seed_vila_formosa
"""

from django.core.management.base import BaseCommand

from API.utils import igreja_unica


class Command(BaseCommand):
    help = "Cria/garante a igreja única (IASD Vila Formosa)."

    def handle(self, *args, **options):
        igreja = igreja_unica()
        self.stdout.write(
            self.style.SUCCESS(
                f"Igreja única pronta: {igreja.nome} (#{igreja.id}, slug={igreja.slug})."
            )
        )
