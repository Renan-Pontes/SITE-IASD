"""
Popula o banco com dados de demonstração.

Cria:
- Super admin (Mestre): renan@iasd.app
- 2 igrejas com geolocalização (São Paulo e Hortolândia)
- Anciões, membros e visitantes
- Grupos com líderes e membros
- Salas, eventos (aprovados/pendentes/recorrentes) e inscrições
- Pautas (aberta e anônima) com votos

Idempotente: rode quantas vezes quiser (usa get_or_create por chaves naturais).

Uso:
    python manage.py seed_demo
    python manage.py seed_demo --reset   # apaga os dados de domínio antes
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from API.models import (
    CargoGrupo,
    Evento,
    Grupo,
    GrupoMembro,
    Igreja,
    Inscricao,
    Membro,
    OpcaoVoto,
    PapelIgreja,
    Pauta,
    Recorrencia,
    Sala,
    StatusEvento,
    StatusInscricao,
    StatusPauta,
    StatusVinculo,
    VisibilidadeEvento,
    Voto,
)

User = get_user_model()

MESTRE_EMAIL = "renan@iasd.app"
MESTRE_SENHA = "MestreIASD@2026"
SENHA_DEMO = "iasd1234"


class Command(BaseCommand):
    help = "Popula o banco com dados de demonstração."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Apaga os dados de domínio antes de semear.",
        )

    def _user(self, email, nome):
        partes = nome.split(" ", 1)
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                "email": email,
                "first_name": partes[0],
                "last_name": partes[1] if len(partes) > 1 else "",
            },
        )
        if created:
            user.set_password(SENHA_DEMO)
            user.save()
        return user

    def handle(self, *args, **options):
        if options["reset"]:
            self.stdout.write("Apagando dados de domínio...")
            for model in (
                Voto, Pauta, Inscricao, Evento, GrupoMembro, Grupo,
                Sala, Membro, Igreja,
            ):
                model.objects.all().delete()
            User.objects.exclude(is_superuser=True).delete()

        agora = timezone.now()

        # --- Mestre (super admin) ---
        mestre, criado = User.objects.get_or_create(
            username=MESTRE_EMAIL,
            defaults={
                "email": MESTRE_EMAIL,
                "first_name": "Renan",
                "last_name": "Pontes",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if criado:
            mestre.set_password(MESTRE_SENHA)
            mestre.save()
        mestre.profile.is_super_admin = True
        mestre.profile.save(update_fields=["is_super_admin"])
        self.stdout.write(self.style.SUCCESS(f"Mestre: {MESTRE_EMAIL} / {MESTRE_SENHA}"))

        # --- Igrejas ---
        central, _ = Igreja.objects.get_or_create(
            nome="IASD Central São Paulo",
            defaults={
                "descricao": "Igreja Adventista Central de São Paulo.",
                "endereco": "Rua da Consolação, 1000",
                "cidade": "São Paulo",
                "estado": "SP",
                "cep": "01301-000",
                "latitude": -23.5505,
                "longitude": -46.6333,
                "telefone": "(11) 3256-7890",
                "email": "central@iasd.app",
            },
        )
        horto, _ = Igreja.objects.get_or_create(
            nome="IASD Hortolândia",
            defaults={
                "descricao": "Igreja Adventista de Hortolândia.",
                "endereco": "Av. Adventista, 500",
                "cidade": "Hortolândia",
                "estado": "SP",
                "cep": "13184-010",
                "latitude": -22.8583,
                "longitude": -47.2200,
                "telefone": "(19) 3865-1234",
                "email": "hortolandia@iasd.app",
            },
        )

        # --- Pessoas ---
        anciao = self._user("anciao@iasd.app", "José Ancião")
        pastor = self._user("pastor@iasd.app", "Paulo Pastor")
        lider = self._user("lider@iasd.app", "Lídia Líder")
        membro = self._user("membro@iasd.app", "Maria Membro")
        visitante = self._user("visitante@iasd.app", "Vitor Visitante")

        def vincular(user, igreja, papel, status=StatusVinculo.ATIVO):
            Membro.objects.get_or_create(
                usuario=user,
                igreja=igreja,
                defaults={"papel": papel, "status": status},
            )

        vincular(mestre, central, PapelIgreja.ADMIN)
        vincular(anciao, central, PapelIgreja.ANCIAO)
        vincular(pastor, central, PapelIgreja.PASTOR)
        vincular(lider, central, PapelIgreja.MEMBRO)
        vincular(membro, central, PapelIgreja.MEMBRO)
        vincular(visitante, central, PapelIgreja.VISITANTE, StatusVinculo.PENDENTE)
        vincular(anciao, horto, PapelIgreja.ANCIAO)

        mestre.profile.igreja_principal = central
        mestre.profile.latitude = -23.55
        mestre.profile.longitude = -46.63
        mestre.profile.save()
        membro.profile.igreja_principal = central
        membro.profile.latitude = -23.55
        membro.profile.longitude = -46.63
        membro.profile.save()

        # --- Salas ---
        templo, _ = Sala.objects.get_or_create(
            nome="Templo Principal", igreja=central,
            defaults={"capacidade": 400, "equipamentos": "Som, projetor, palco"},
        )
        sala_jovens, _ = Sala.objects.get_or_create(
            nome="Sala dos Jovens", igreja=central,
            defaults={"capacidade": 60, "equipamentos": "TV, ar-condicionado"},
        )
        Sala.objects.get_or_create(
            nome="Salão Social", igreja=horto,
            defaults={"capacidade": 150, "equipamentos": "Cozinha, mesas"},
        )

        # --- Grupos ---
        jovens, _ = Grupo.objects.get_or_create(
            nome="Ministério Jovem", igreja=central,
            defaults={"tipo": "jovens", "descricao": "Jovens adventistas da Central."},
        )
        louvor, _ = Grupo.objects.get_or_create(
            nome="Ministério de Música", igreja=central,
            defaults={"tipo": "musica", "descricao": "Coral e banda da igreja."},
        )
        desbravadores, _ = Grupo.objects.get_or_create(
            nome="Clube de Desbravadores Águias", igreja=central,
            defaults={"tipo": "desbravadores", "descricao": "Clube de desbravadores."},
        )

        def gm(user, grupo, cargo, status=StatusVinculo.ATIVO):
            GrupoMembro.objects.get_or_create(
                usuario=user, grupo=grupo,
                defaults={"cargo": cargo, "status": status},
            )

        gm(lider, jovens, CargoGrupo.DIRETOR)
        gm(membro, jovens, CargoGrupo.MEMBRO)
        gm(visitante, jovens, CargoGrupo.MEMBRO, StatusVinculo.PENDENTE)
        gm(lider, louvor, CargoGrupo.LIDER)
        gm(membro, desbravadores, CargoGrupo.SECRETARIO)

        # --- Eventos ---
        def evento(titulo, igreja, inicio, dur_horas, **kw):
            defaults = {
                "descricao": kw.get("descricao", ""),
                "fim": inicio + timedelta(hours=dur_horas),
                "grupo": kw.get("grupo"),
                "sala": kw.get("sala"),
                "visibilidade": kw.get("visibilidade", VisibilidadeEvento.PUBLICO),
                "status": kw.get("status", StatusEvento.APROVADO),
                "recorrencia": kw.get("recorrencia", Recorrencia.NENHUMA),
                "recorrencia_ate": kw.get("recorrencia_ate"),
                "criado_por": kw.get("criado_por", anciao),
                "aprovado_por": anciao if kw.get("status", StatusEvento.APROVADO) == StatusEvento.APROVADO else None,
            }
            ev, _ = Evento.objects.get_or_create(
                titulo=titulo, igreja=igreja, inicio=inicio, defaults=defaults
            )
            return ev

        prox_sab = agora + timedelta(days=(5 - agora.weekday()) % 7)
        culto = evento(
            "Culto de Sábado", central,
            prox_sab.replace(hour=9, minute=0, second=0, microsecond=0),
            2, sala=templo, recorrencia=Recorrencia.SEMANAL,
            descricao="Escola Sabatina e culto divino.",
        )
        evento(
            "Reunião de Jovens", central,
            (agora + timedelta(days=2)).replace(hour=19, minute=30, second=0, microsecond=0),
            2, grupo=jovens, sala=sala_jovens, recorrencia=Recorrencia.SEMANAL,
            criado_por=lider, descricao="Programação dos jovens toda terça.",
        )
        evento(
            "Ensaio do Coral", central,
            (agora + timedelta(days=3)).replace(hour=20, minute=0, second=0, microsecond=0),
            1, grupo=louvor, sala=templo, visibilidade=VisibilidadeEvento.PRIVADO,
            criado_por=lider, descricao="Ensaio fechado do ministério de música.",
        )
        pendente = evento(
            "Acampamento dos Desbravadores", central,
            (agora + timedelta(days=20)).replace(hour=8, minute=0, second=0, microsecond=0),
            48, grupo=desbravadores, status=StatusEvento.PENDENTE,
            criado_por=membro, descricao="Acampamento — aguardando aprovação dos anciões.",
        )
        evento(
            "Vigília de Oração", horto,
            (agora + timedelta(days=6)).replace(hour=19, minute=0, second=0, microsecond=0),
            4, descricao="Vigília de oração em Hortolândia.",
        )

        # --- Inscrições (RSVP) ---
        Inscricao.objects.get_or_create(
            usuario=membro, evento=culto,
            defaults={"status": StatusInscricao.CONFIRMADO},
        )
        Inscricao.objects.get_or_create(
            usuario=lider, evento=culto,
            defaults={"status": StatusInscricao.CONFIRMADO},
        )

        # --- Pautas + votos ---
        pauta_aberta, _ = Pauta.objects.get_or_create(
            titulo="Reforma do telhado do templo", igreja=central,
            defaults={
                "descricao": "Aprovar verba para a reforma do telhado.",
                "criada_por": anciao,
                "anonima": False,
                "status": StatusPauta.ABERTA,
                "prazo_votacao": agora + timedelta(days=7),
            },
        )
        Voto.objects.get_or_create(
            pauta=pauta_aberta, usuario=anciao,
            defaults={"opcao": OpcaoVoto.SIM, "comentario": "Urgente."},
        )
        Voto.objects.get_or_create(
            pauta=pauta_aberta, usuario=pastor,
            defaults={"opcao": OpcaoVoto.SIM},
        )

        pauta_anon, _ = Pauta.objects.get_or_create(
            titulo="Indicação de novo diácono", igreja=central,
            defaults={
                "descricao": "Votação secreta para a indicação.",
                "criada_por": pastor,
                "anonima": True,
                "status": StatusPauta.ABERTA,
                "prazo_votacao": agora + timedelta(days=3),
            },
        )
        Voto.objects.get_or_create(
            pauta=pauta_anon, usuario=anciao, defaults={"opcao": OpcaoVoto.SIM}
        )

        self.stdout.write(self.style.SUCCESS("Seed concluído!"))
        self.stdout.write("")
        self.stdout.write("Contas de demonstração (senha: %s):" % SENHA_DEMO)
        for email, papel in [
            ("anciao@iasd.app", "Ancião (Central + Hortolândia)"),
            ("pastor@iasd.app", "Pastor (Central)"),
            ("lider@iasd.app", "Líder de grupo (Central)"),
            ("membro@iasd.app", "Membro (Central)"),
            ("visitante@iasd.app", "Visitante (pendente)"),
        ]:
            self.stdout.write(f"  - {email:24s} {papel}")
