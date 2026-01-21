from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from API.models import (
    Igreja,
    Grupos,
    Profile,
    Events,
    Atividades,
    Comunicados,
    Avisos,
    PostagensGrupos,
    ComentariosPostagens,
    MensagensPrivadas,
    NotificacoesGrupos,
    RecursosEducacionais,
    ArquivosIgreja,
)


class Command(BaseCommand):
    help = "Seed mock data for local development."

    def handle(self, *args, **options):
        User = get_user_model()

        def ensure_user(username, name, password, email=None):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email or username, "first_name": name},
            )
            if created:
                user.set_password(password)
                user.save()
            return user

        admin_user = ensure_user("admin@iasd.local", "Admin", "Admin123!", "admin@iasd.local")
        elder_user = ensure_user("elder@iasd.local", "Elder", "Elder123!", "elder@iasd.local")
        member_user = ensure_user("membro@iasd.local", "Member", "Member123!", "membro@iasd.local")

        admin_profile, _ = Profile.objects.get_or_create(user=admin_user)
        elder_profile, _ = Profile.objects.get_or_create(user=elder_user)
        member_profile, _ = Profile.objects.get_or_create(user=member_user)

        admin_profile.is_admin = True
        elder_profile.is_elder = True
        admin_profile.save()
        elder_profile.save()

        igreja, _ = Igreja.objects.get_or_create(
            nome="IASD Central",
            defaults={
                "endereco": "Rua Esperanca, 120 - Centro",
                "telefone": "(11) 3456-7890",
                "email": "contato@iasd.local",
            },
        )

        grupos = [
            ("Musica", "Louvor, coral e escala de instrumentos."),
            ("Midia", "Transmissao e comunicacao."),
            ("Infantil", "Atividades para criancas e familias."),
        ]

        grupos_objs = []
        for nome, descricao in grupos:
            grupo, _ = Grupos.objects.get_or_create(
                nome=nome,
                igreja=igreja,
                defaults={"descricao": descricao},
            )
            grupos_objs.append(grupo)

        admin_profile.igrejas.add(igreja)
        elder_profile.igrejas.add(igreja)
        member_profile.igrejas.add(igreja)

        admin_profile.grupos.add(*grupos_objs)
        elder_profile.grupos.add(grupos_objs[0])
        member_profile.grupos.add(grupos_objs[-1])

        now = timezone.localtime(timezone.now())
        event = Events.objects.get_or_create(
            titulo="Culto de Celebracao",
            igreja=igreja,
            data_inicio=now + timedelta(days=1),
            defaults={
                "descricao": "Mensagem especial e louvor.",
                "data_fim": now + timedelta(days=1, hours=2),
            },
        )[0]

        Atividades.objects.get_or_create(
            nome="Ensaio do Coral",
            Grupo=grupos_objs[0],
            data=now + timedelta(days=2),
            defaults={"descricao": "Ensaios semanais."},
        )

        Comunicados.objects.get_or_create(
            titulo="Reuniao de Lideres",
            igreja=igreja,
            defaults={"mensagem": "Sexta-feira as 20h na sala 2."},
        )

        Avisos.objects.get_or_create(
            titulo="Mutirao de Saude",
            igreja=igreja,
            defaults={"mensagem": "Sabado as 9h na praca central."},
        )

        postagem = PostagensGrupos.objects.get_or_create(
            grupo=grupos_objs[0],
            autor=admin_profile,
            defaults={"conteudo": "Ensaio extra nesta semana!"},
        )[0]

        ComentariosPostagens.objects.get_or_create(
            postagem=postagem,
            autor=elder_profile,
            defaults={"conteudo": "Confirmado, estarei la."},
        )

        MensagensPrivadas.objects.get_or_create(
            remetente=admin_profile,
            destinatario=member_profile,
            defaults={"conteudo": "Bem-vindo ao grupo!"},
        )

        NotificacoesGrupos.objects.get_or_create(
            perfil=member_profile,
            grupo=grupos_objs[-1],
            defaults={"mensagem": "Nova atividade disponivel."},
        )

        RecursosEducacionais.objects.get_or_create(
            titulo="Guia de Estudos",
            igreja=igreja,
            defaults={
                "descricao": "Material para pequenos grupos.",
                "arquivo": ContentFile(b"Material de estudo", name="guia_estudos.txt"),
            },
        )

        ArquivosIgreja.objects.get_or_create(
            igreja=igreja,
            nome_arquivo="Calendario 2025",
            defaults={
                "arquivo": ContentFile(b"Calendario", name="calendario_2025.txt"),
            },
        )

        self.stdout.write(self.style.SUCCESS("Mock data seeded successfully."))
