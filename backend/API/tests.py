"""
Testes dos fluxos críticos — IASD Gestão.

Cobre: autenticação JWT, aprovação de membro, workflow de aprovação de evento + RSVP,
votação de pauta (incluindo anonimato), entrada/aprovação em grupo + acesso ao chat,
e regras de visibilidade de eventos.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from API.models import (
    CargoGrupo,
    Evento,
    Grupo,
    GrupoMembro,
    Igreja,
    Inscricao,
    Membro,
    PapelIgreja,
    Pauta,
    StatusEvento,
    StatusInscricao,
    StatusVinculo,
    VisibilidadeEvento,
    Voto,
)

User = get_user_model()


def cria_user(email, nome="Fulano de Tal", senha="iasd1234"):
    partes = nome.split(" ", 1)
    return User.objects.create_user(
        username=email, email=email, password=senha,
        first_name=partes[0], last_name=partes[1] if len(partes) > 1 else "",
    )


def autentica(client, email, senha="iasd1234"):
    resp = client.post(
        "/api/auth/login/", {"username": email, "password": senha}, format="json"
    )
    assert resp.status_code == 200, resp.content
    client.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["access"])
    return resp.data


class AuthTests(TestCase):
    def test_registro_login_e_me(self):
        client = APIClient()
        resp = client.post(
            "/api/auth/register/",
            {"nome": "Ana Maria", "email": "ana@iasd.app", "password": "segredo123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertIn("access", resp.data)
        self.assertTrue(User.objects.filter(email="ana@iasd.app").exists())

        autentica(client, "ana@iasd.app", "segredo123")
        me = client.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["profile"]["email"], "ana@iasd.app")
        self.assertFalse(me.data["is_super_admin"])

    def test_email_duplicado_falha(self):
        cria_user("dup@iasd.app")
        client = APIClient()
        resp = client.post(
            "/api/auth/register/",
            {"nome": "Outro", "email": "dup@iasd.app", "password": "segredo123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class MembroWorkflowTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Teste", cidade="São Paulo", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(
            usuario=self.anciao, igreja=self.igreja,
            papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO,
        )
        self.user = cria_user("user@iasd.app", "Novo Usuario")

    def test_entrar_cria_pendente_e_anciao_aprova(self):
        client = APIClient()
        autentica(client, "user@iasd.app")
        resp = client.post(f"/api/igrejas/{self.igreja.id}/entrar/")
        self.assertEqual(resp.status_code, 201, resp.content)
        membro = Membro.objects.get(usuario=self.user, igreja=self.igreja)
        self.assertEqual(membro.status, StatusVinculo.PENDENTE)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.igreja_principal_id, self.igreja.id)

        lider = APIClient()
        autentica(lider, "anciao@iasd.app")
        resp = lider.post(f"/api/membros/{membro.id}/aprovar/")
        self.assertEqual(resp.status_code, 200, resp.content)
        membro.refresh_from_db()
        self.assertEqual(membro.status, StatusVinculo.ATIVO)

    def test_rejeitar_com_motivo_notifica_usuario(self):
        from API.models import Notificacao

        membro = Membro.objects.create(
            usuario=self.user, igreja=self.igreja, status=StatusVinculo.PENDENTE
        )
        lider = APIClient()
        autentica(lider, "anciao@iasd.app")
        resp = lider.post(
            f"/api/membros/{membro.id}/rejeitar/", {"motivo": "Sem vínculo"}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        membro.refresh_from_db()
        self.assertEqual(membro.status, StatusVinculo.REJEITADO)
        self.assertEqual(membro.motivo_rejeicao, "Sem vínculo")
        self.assertTrue(
            Notificacao.objects.filter(usuario=self.user, tipo="membro_rejeitado").exists()
        )

    def test_usuario_comum_nao_aprova_membro(self):
        membro = Membro.objects.create(
            usuario=self.user, igreja=self.igreja, status=StatusVinculo.PENDENTE
        )
        outro = cria_user("outro@iasd.app")
        Membro.objects.create(usuario=outro, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)
        client = APIClient()
        autentica(client, "outro@iasd.app")
        resp = client.post(f"/api/membros/{membro.id}/aprovar/")
        self.assertIn(resp.status_code, (403, 404))
        membro.refresh_from_db()
        self.assertEqual(membro.status, StatusVinculo.PENDENTE)


class EventoWorkflowTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Eventos", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.membro = cria_user("membro@iasd.app", "Maria Membro")
        Membro.objects.create(usuario=self.membro, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)
        self.inicio = (timezone.now() + timedelta(days=5)).isoformat()
        self.fim = (timezone.now() + timedelta(days=5, hours=2)).isoformat()

    def _payload(self, **kw):
        base = {
            "titulo": "Evento Teste", "descricao": "x",
            "igreja": self.igreja.id, "inicio": self.inicio, "fim": self.fim,
            "visibilidade": VisibilidadeEvento.PUBLICO,
        }
        base.update(kw)
        return base

    def test_membro_cria_pendente_e_anciao_aprova(self):
        client = APIClient()
        autentica(client, "membro@iasd.app")
        resp = client.post("/api/eventos/", self._payload(), format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["status"], StatusEvento.PENDENTE)
        evento_id = resp.data["id"]

        lider = APIClient()
        autentica(lider, "anciao@iasd.app")
        pend = lider.get("/api/eventos/pendentes/")
        self.assertEqual(pend.status_code, 200)
        self.assertTrue(any(e["id"] == evento_id for e in pend.data))

        resp = lider.post(f"/api/eventos/{evento_id}/aprovar/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["status"], StatusEvento.APROVADO)

    def test_anciao_cria_aprovado_direto(self):
        client = APIClient()
        autentica(client, "anciao@iasd.app")
        resp = client.post("/api/eventos/", self._payload(titulo="Culto"), format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["status"], StatusEvento.APROVADO)

    def test_membro_nao_aprova_evento(self):
        ev = Evento.objects.create(
            titulo="X", igreja=self.igreja, inicio=timezone.now(),
            fim=timezone.now() + timedelta(hours=1), status=StatusEvento.PENDENTE,
            criado_por=self.membro,
        )
        client = APIClient()
        autentica(client, "membro@iasd.app")
        resp = client.post(f"/api/eventos/{ev.id}/aprovar/")
        self.assertEqual(resp.status_code, 403)

    def test_rsvp(self):
        ev = Evento.objects.create(
            titulo="Culto", igreja=self.igreja, inicio=timezone.now(),
            fim=timezone.now() + timedelta(hours=1), status=StatusEvento.APROVADO,
            criado_por=self.anciao,
        )
        client = APIClient()
        autentica(client, "membro@iasd.app")
        resp = client.post(f"/api/eventos/{ev.id}/rsvp/", {"status": StatusInscricao.CONFIRMADO}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertTrue(Inscricao.objects.filter(usuario=self.membro, evento=ev, status=StatusInscricao.CONFIRMADO).exists())
        resp = client.post(f"/api/eventos/{ev.id}/rsvp/", {"status": StatusInscricao.TALVEZ}, format="json")
        self.assertEqual(Inscricao.objects.filter(usuario=self.membro, evento=ev).count(), 1)


class VisibilidadeEventoTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Vis", cidade="SP", estado="SP")
        self.criador = cria_user("criador@iasd.app")
        Membro.objects.create(usuario=self.criador, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)
        agora = timezone.now()
        Evento.objects.create(
            titulo="Publico", igreja=self.igreja, inicio=agora, fim=agora + timedelta(hours=1),
            status=StatusEvento.APROVADO, visibilidade=VisibilidadeEvento.PUBLICO, criado_por=self.criador,
        )
        Evento.objects.create(
            titulo="Pendente", igreja=self.igreja, inicio=agora, fim=agora + timedelta(hours=1),
            status=StatusEvento.PENDENTE, visibilidade=VisibilidadeEvento.PUBLICO, criado_por=self.criador,
        )

    def test_anonimo_ve_so_publico_aprovado(self):
        client = APIClient()
        resp = client.get("/api/eventos/")
        self.assertEqual(resp.status_code, 200)
        titulos = [e["titulo"] for e in resp.data["results"]]
        self.assertIn("Publico", titulos)
        self.assertNotIn("Pendente", titulos)


class PautaVotacaoTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Pauta", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.pastor = cria_user("pastor@iasd.app", "Paulo Pastor")
        Membro.objects.create(usuario=self.pastor, igreja=self.igreja, papel=PapelIgreja.PASTOR, status=StatusVinculo.ATIVO)
        self.membro = cria_user("membro@iasd.app", "Maria Membro")
        Membro.objects.create(usuario=self.membro, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)

    def test_anciao_cria_e_vota_membro_nao_vota(self):
        lider = APIClient()
        autentica(lider, "anciao@iasd.app")
        resp = lider.post("/api/pautas/", {
            "titulo": "Reforma", "descricao": "x", "igreja": self.igreja.id, "anonima": False,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        pauta_id = resp.data["id"]

        resp = lider.post(f"/api/pautas/{pauta_id}/votar/", {"opcao": "sim"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(Voto.objects.filter(pauta_id=pauta_id).count(), 1)

        comum = APIClient()
        autentica(comum, "membro@iasd.app")
        resp = comum.post(f"/api/pautas/{pauta_id}/votar/", {"opcao": "nao"}, format="json")
        self.assertIn(resp.status_code, (403, 404))

    def test_anonimato_oculta_autor(self):
        pauta = Pauta.objects.create(
            titulo="Secreta", igreja=self.igreja, criada_por=self.anciao, anonima=True,
        )
        Voto.objects.create(pauta=pauta, usuario=self.anciao, opcao="sim")
        lider = APIClient()
        autentica(lider, "pastor@iasd.app")
        resp = lider.get(f"/api/pautas/{pauta.id}/votos/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(len(resp.data), 1)
        self.assertIsNone(resp.data[0]["usuario_detalhe"])

    def test_pauta_nao_anonima_revela_autor(self):
        pauta = Pauta.objects.create(
            titulo="Aberta", igreja=self.igreja, criada_por=self.anciao, anonima=False,
        )
        Voto.objects.create(pauta=pauta, usuario=self.anciao, opcao="sim")
        lider = APIClient()
        autentica(lider, "anciao@iasd.app")
        resp = lider.get(f"/api/pautas/{pauta.id}/votos/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(resp.data[0]["usuario_detalhe"])


class QuorumTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Quorum", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.pastor = cria_user("pastor@iasd.app", "Paulo Pastor")
        Membro.objects.create(usuario=self.pastor, igreja=self.igreja, papel=PapelIgreja.PASTOR, status=StatusVinculo.ATIVO)

    def test_quorum_encerra_ao_atingir(self):
        pauta = Pauta.objects.create(
            titulo="Q", igreja=self.igreja, criada_por=self.anciao, quorum_minimo=2,
        )
        a = APIClient(); autentica(a, "anciao@iasd.app")
        p = APIClient(); autentica(p, "pastor@iasd.app")

        a.post(f"/api/pautas/{pauta.id}/votar/", {"opcao": "sim"}, format="json")
        pauta.refresh_from_db()
        self.assertEqual(pauta.status, "aberta")  # 1 voto, quórum 2

        p.post(f"/api/pautas/{pauta.id}/votar/", {"opcao": "nao"}, format="json")
        pauta.refresh_from_db()
        self.assertEqual(pauta.status, "encerrada")  # 2 votos -> fecha

        # Terceiro voto já é barrado.
        outro = cria_user("m@iasd.app")
        Membro.objects.create(usuario=outro, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        c = APIClient(); autentica(c, "m@iasd.app")
        resp = c.post(f"/api/pautas/{pauta.id}/votar/", {"opcao": "sim"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_command_fecha_pauta_expirada(self):
        passado = timezone.now() - timedelta(hours=1)
        pauta = Pauta.objects.create(
            titulo="Expirada", igreja=self.igreja, criada_por=self.anciao,
            prazo_votacao=passado,
        )
        call_command("fechar_pautas")
        pauta.refresh_from_db()
        self.assertEqual(pauta.status, "encerrada")


class IgrejaEdicaoDiretaTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Edit", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.admin = cria_user("admin@iasd.app", "Ada Admin")
        Membro.objects.create(usuario=self.admin, igreja=self.igreja, papel=PapelIgreja.ADMIN, status=StatusVinculo.ATIVO)

    def test_anciao_nao_edita_igreja_direto(self):
        c = APIClient(); autentica(c, "anciao@iasd.app")
        resp = c.patch(f"/api/igrejas/{self.igreja.id}/", {"nome": "Hack"}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.igreja.refresh_from_db()
        self.assertEqual(self.igreja.nome, "IASD Edit")

    def test_admin_edita_igreja_direto(self):
        c = APIClient(); autentica(c, "admin@iasd.app")
        resp = c.patch(f"/api/igrejas/{self.igreja.id}/", {"nome": "IASD Nova"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.igreja.refresh_from_db()
        self.assertEqual(self.igreja.nome, "IASD Nova")


class CanalAncioesTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Canal", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.pastor = cria_user("pastor@iasd.app", "Paulo Pastor")
        Membro.objects.create(usuario=self.pastor, igreja=self.igreja, papel=PapelIgreja.PASTOR, status=StatusVinculo.ATIVO)
        self.a = APIClient(); autentica(self.a, "anciao@iasd.app")
        self.p = APIClient(); autentica(self.p, "pastor@iasd.app")

    def _criar(self, **extra):
        payload = {"titulo": "Proposta", "igreja": self.igreja.id, "quorum_minimo": 2}
        payload.update(extra)
        resp = self.a.post("/api/pautas/", payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.data["id"]

    def _aprovar(self, pauta_id):
        self.a.post(f"/api/pautas/{pauta_id}/votar/", {"opcao": "sim"}, format="json")
        self.p.post(f"/api/pautas/{pauta_id}/votar/", {"opcao": "sim"}, format="json")

    def test_alteracao_igreja_aprovada_aplica(self):
        pid = self._criar(
            tipo="alteracao_igreja",
            payload={"antes": {"nome": "IASD Canal"}, "depois": {"nome": "IASD Renovada", "cidade": "Santos"}},
        )
        self._aprovar(pid)
        from API.models import Pauta
        pauta = Pauta.objects.get(pk=pid)
        self.assertEqual(pauta.status, "encerrada")
        self.assertEqual(pauta.decisao, "aprovado")
        self.assertIsNotNone(pauta.aplicada_em)
        self.igreja.refresh_from_db()
        self.assertEqual(self.igreja.nome, "IASD Renovada")
        self.assertEqual(self.igreja.cidade, "Santos")

    def test_criar_grupo_aprovado_cria(self):
        pid = self._criar(tipo="criar_grupo", payload={"nome": "Coral", "tipo": "musica"})
        self._aprovar(pid)
        self.assertTrue(Grupo.objects.filter(igreja=self.igreja, nome="Coral").exists())

    def test_rejeitada_nao_aplica(self):
        pid = self._criar(tipo="criar_grupo", payload={"nome": "NaoVai"})
        self.a.post(f"/api/pautas/{pid}/votar/", {"opcao": "nao"}, format="json")
        self.p.post(f"/api/pautas/{pid}/votar/", {"opcao": "nao"}, format="json")
        from API.models import Pauta
        pauta = Pauta.objects.get(pk=pid)
        self.assertEqual(pauta.decisao, "rejeitado")
        self.assertIsNone(pauta.aplicada_em)
        self.assertFalse(Grupo.objects.filter(nome="NaoVai").exists())

    def test_enquete_livre_opcoes_custom(self):
        pid = self._criar(
            tipo="enquete_livre", titulo="Qual dia?",
            opcoes=["Sábado", "Domingo"], quorum_minimo=2,
        )
        # opção fora da lista é rejeitada
        resp = self.a.post(f"/api/pautas/{pid}/votar/", {"opcao": "sim"}, format="json")
        self.assertEqual(resp.status_code, 400)
        # votos válidos
        self.a.post(f"/api/pautas/{pid}/votar/", {"opcao": "Sábado"}, format="json")
        self.p.post(f"/api/pautas/{pid}/votar/", {"opcao": "Sábado"}, format="json")
        from API.models import Pauta
        pauta = Pauta.objects.get(pk=pid)
        self.assertEqual(pauta.decisao, "Sábado")
        self.assertIsNone(pauta.aplicada_em)  # enquete não aplica nada
        resp = self.a.get(f"/api/pautas/{pid}/")
        self.assertEqual(resp.data["resultado"]["Sábado"], 2)


class GrupoChatTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Grupo", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.lider = cria_user("lider@iasd.app", "Lidia Lider")
        Membro.objects.create(usuario=self.lider, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)
        self.grupo = Grupo.objects.create(nome="Jovens", igreja=self.igreja)
        GrupoMembro.objects.create(usuario=self.lider, grupo=self.grupo, cargo=CargoGrupo.DIRETOR, status=StatusVinculo.ATIVO)
        self.user = cria_user("user@iasd.app", "Novo Usuario")

    def test_entrar_aprovar_e_chat(self):
        client = APIClient()
        autentica(client, "user@iasd.app")
        resp = client.post(f"/api/grupos/{self.grupo.id}/entrar/")
        self.assertEqual(resp.status_code, 201, resp.content)
        gm = GrupoMembro.objects.get(usuario=self.user, grupo=self.grupo)
        self.assertEqual(gm.status, StatusVinculo.PENDENTE)

        resp = client.get(f"/api/grupos/{self.grupo.id}/mensagens/")
        self.assertEqual(resp.status_code, 403)

        diretor = APIClient()
        autentica(diretor, "lider@iasd.app")
        resp = diretor.post(f"/api/grupo-membros/{gm.id}/aprovar/")
        self.assertEqual(resp.status_code, 200, resp.content)

        resp = client.get(f"/api/grupos/{self.grupo.id}/mensagens/")
        self.assertEqual(resp.status_code, 200)
        resp = client.post(f"/api/grupos/{self.grupo.id}/mensagens/", {"conteudo": "Olá grupo!"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)


class IcalTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Ical", cidade="SP", estado="SP")
        self.criador = cria_user("criador@iasd.app")
        Membro.objects.create(usuario=self.criador, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)
        agora = timezone.now()
        self.publico = Evento.objects.create(
            titulo="Culto", igreja=self.igreja, inicio=agora, fim=agora + timedelta(hours=1),
            status=StatusEvento.APROVADO, visibilidade=VisibilidadeEvento.PUBLICO, criado_por=self.criador,
        )
        self.privado = Evento.objects.create(
            titulo="Privado", igreja=self.igreja, inicio=agora, fim=agora + timedelta(hours=1),
            status=StatusEvento.APROVADO, visibilidade=VisibilidadeEvento.PRIVADO, criado_por=self.criador,
        )

    def test_ical_publico_sem_auth(self):
        resp = self.client.get(f"/api/eventos/{self.publico.id}/ical/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/calendar", resp["Content-Type"])
        corpo = resp.content.decode("utf-8")
        self.assertIn("BEGIN:VCALENDAR", corpo)
        self.assertIn("SUMMARY:Culto", corpo)

    def test_ical_privado_anon_nao_acessa(self):
        resp = self.client.get(f"/api/eventos/{self.privado.id}/ical/")
        self.assertEqual(resp.status_code, 404)


class AuditoriaRetencaoTests(TestCase):
    def test_purga_registros_antigos(self):
        from API.models import AuditLog

        antigo = AuditLog.objects.create(acao="teste_antigo")
        recente = AuditLog.objects.create(acao="teste_recente")
        # Backdate do registro antigo (criado_em é auto_now_add).
        AuditLog.objects.filter(pk=antigo.pk).update(
            criado_em=timezone.now() - timedelta(days=120)
        )
        call_command("purgar_auditoria", "--dias", "90")
        self.assertFalse(AuditLog.objects.filter(pk=antigo.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=recente.pk).exists())


class RecorrenciaMensalTests(TestCase):
    def test_proximo_mensal_mantem_nth_weekday(self):
        from datetime import datetime
        from API.utils import proximo_mensal

        # 9/jun/2026 é a 2ª terça-feira de junho.
        dt = timezone.make_aware(datetime(2026, 6, 9, 19, 30))
        prox = proximo_mensal(dt)
        # 2ª terça de julho/2026 é dia 14, mantendo a hora.
        self.assertEqual((prox.year, prox.month, prox.day), (2026, 7, 14))
        self.assertEqual((prox.hour, prox.minute), (19, 30))
        self.assertEqual(prox.weekday(), dt.weekday())

    def test_pula_mes_sem_5a_ocorrencia(self):
        from datetime import datetime
        from API.utils import proximo_mensal

        # 29/mai/2026 é a 5ª sexta de maio; junho não tem 5ª sexta -> pula.
        dt = timezone.make_aware(datetime(2026, 5, 29, 10, 0))
        prox = proximo_mensal(dt)
        self.assertEqual(prox.weekday(), 4)  # sexta
        self.assertGreater(prox.month, 6)  # pulou junho


class FotoEventoTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Foto", cidade="SP", estado="SP")
        self.anciao = cria_user("anciao@iasd.app", "Jose Anciao")
        Membro.objects.create(usuario=self.anciao, igreja=self.igreja, papel=PapelIgreja.ANCIAO, status=StatusVinculo.ATIVO)
        self.ev = Evento.objects.create(
            titulo="Com Foto", igreja=self.igreja, inicio=timezone.now(),
            fim=timezone.now() + timedelta(hours=1), status=StatusEvento.APROVADO,
            criado_por=self.anciao,
        )

    def _png(self):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buf = BytesIO()
        Image.new("RGB", (12, 12), "green").save(buf, "PNG")
        return SimpleUploadedFile("ev.png", buf.getvalue(), content_type="image/png")

    def test_upload_imagem_valida(self):
        import tempfile
        from django.test import override_settings
        from django.core.files.uploadedfile import SimpleUploadedFile

        client = APIClient()
        autentica(client, "anciao@iasd.app")
        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            resp = client.post(
                f"/api/eventos/{self.ev.id}/foto/", {"foto": self._png()}, format="multipart"
            )
            self.assertEqual(resp.status_code, 200, resp.content)
            self.assertTrue(resp.data["foto"])

            # Arquivo que não é imagem -> 400.
            ruim = SimpleUploadedFile("x.png", b"isto nao e imagem", content_type="image/png")
            resp = client.post(
                f"/api/eventos/{self.ev.id}/foto/", {"foto": ruim}, format="multipart"
            )
            self.assertEqual(resp.status_code, 400)

    def test_upload_sem_permissao(self):
        outro = cria_user("ze@iasd.app")
        Membro.objects.create(usuario=outro, igreja=self.igreja, papel=PapelIgreja.MEMBRO, status=StatusVinculo.ATIVO)
        client = APIClient()
        autentica(client, "ze@iasd.app")
        resp = client.post(f"/api/eventos/{self.ev.id}/foto/", {"foto": self._png()}, format="multipart")
        self.assertEqual(resp.status_code, 403)


class SearchTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(nome="IASD Esperança", cidade="Santos", estado="SP")
        Grupo.objects.create(nome="Ministério Jovem", igreja=self.igreja)
        agora = timezone.now()
        Evento.objects.create(
            titulo="Vigília de Oração", igreja=self.igreja, inicio=agora,
            fim=agora + timedelta(hours=2), status=StatusEvento.APROVADO,
            visibilidade=VisibilidadeEvento.PUBLICO,
        )

    def test_busca_agrupada(self):
        resp = self.client.get("/api/search/?q=esper")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(any(i["nome"] == "IASD Esperança" for i in resp.data["igrejas"]))

        resp = self.client.get("/api/search/?q=vigíl")
        self.assertTrue(any(e["titulo"] == "Vigília de Oração" for e in resp.data["eventos"]))

    def test_busca_curta_retorna_vazio(self):
        resp = self.client.get("/api/search/?q=a")
        self.assertEqual(resp.data, {"igrejas": [], "grupos": [], "eventos": [], "pessoas": []})

    def test_pessoas_so_autenticado(self):
        cria_user("joao@iasd.app", "Joao Silva")
        # anônimo não recebe pessoas
        resp = self.client.get("/api/search/?q=joao")
        self.assertEqual(resp.data["pessoas"], [])
        # autenticado recebe
        c = APIClient()
        cria_user("logado@iasd.app", "Logado User")
        autentica(c, "logado@iasd.app")
        resp = c.get("/api/search/?q=joao")
        self.assertTrue(any("Joao" in p["nome"] for p in resp.data["pessoas"]))


class DistanciaIgrejaTests(TestCase):
    def test_ordena_por_proximidade(self):
        Igreja.objects.create(nome="Perto", latitude=-23.55, longitude=-46.63, cidade="SP", estado="SP")
        Igreja.objects.create(nome="Longe", latitude=-22.85, longitude=-47.22, cidade="Hortolandia", estado="SP")
        client = APIClient()
        resp = client.get("/api/igrejas/?lat=-23.55&lng=-46.63")
        self.assertEqual(resp.status_code, 200)
        nomes = [i["nome"] for i in resp.data["results"]]
        self.assertEqual(nomes[0], "Perto")
        self.assertIsNotNone(resp.data["results"][0]["distancia_km"])
