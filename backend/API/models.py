"""
Modelos de domínio — IASD Gestão.

Visão geral do domínio:
- Igreja é a entidade central. Usuários se vinculam a igrejas via `Membro`
  (com papel e status de aprovação) e a grupos via `GrupoMembro`.
- Eventos passam por um fluxo de aprovação (rascunho -> pendente -> aprovado/rejeitado)
  e usuários confirmam presença via `Inscricao`.
- Anciões deliberam por `Pauta`/`Voto` (com suporte a voto anônimo).
- Grupos têm um chat (`Mensagem`).

Decisões de modelagem (SQLite, padrão do Django):
- Índices compostos em Meta.indexes para as consultas quentes (agenda por igreja+data,
  membros por igreja+status, etc.) — válidos em SQLite e em qualquer engine.
- Slugs únicos e indexados para URLs amigáveis.
- Soft-delete leve via flag `ativo` onde faz sentido (igreja, grupo, sala).
- Coordenadas em DecimalField (precisão estável entre engines).
"""

from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.text import slugify


# --------------------------------------------------------------------------- #
# Choices (centralizados para reuso em serializers/admin)
# --------------------------------------------------------------------------- #
class PapelIgreja(models.TextChoices):
    VISITANTE = "visitante", "Visitante"
    MEMBRO = "membro", "Membro"
    ANCIAO = "anciao", "Ancião"
    PASTOR = "pastor", "Pastor"
    ADMIN = "admin_igreja", "Administrador da igreja"


class StatusVinculo(models.TextChoices):
    PENDENTE = "pendente", "Pendente"
    ATIVO = "ativo", "Ativo"
    REJEITADO = "rejeitado", "Rejeitado"
    INATIVO = "inativo", "Inativo"


class TipoGrupo(models.TextChoices):
    MINISTERIO = "ministerio", "Ministério"
    CLASSE = "classe", "Classe / Escola Sabatina"
    DESBRAVADORES = "desbravadores", "Desbravadores"
    AVENTUREIROS = "aventureiros", "Aventureiros"
    MUSICA = "musica", "Música / Louvor"
    JOVENS = "jovens", "Jovens"
    OUTRO = "outro", "Outro"


class CargoGrupo(models.TextChoices):
    MEMBRO = "membro", "Membro"
    SECRETARIO = "secretario", "Secretário"
    LIDER = "lider", "Líder"
    DIRETOR = "diretor", "Diretor"


class VisibilidadeEvento(models.TextChoices):
    PUBLICO = "publico", "Público"
    PRIVADO = "privado", "Privado (somente o grupo)"


class StatusEvento(models.TextChoices):
    RASCUNHO = "rascunho", "Rascunho"
    PENDENTE = "pendente", "Pendente de aprovação"
    APROVADO = "aprovado", "Aprovado"
    REJEITADO = "rejeitado", "Rejeitado"
    CANCELADO = "cancelado", "Cancelado"


class Recorrencia(models.TextChoices):
    NENHUMA = "nenhuma", "Não se repete"
    DIARIA = "diaria", "Diariamente"
    SEMANAL = "semanal", "Semanalmente"
    MENSAL = "mensal", "Mensalmente"


class StatusInscricao(models.TextChoices):
    CONFIRMADO = "confirmado", "Confirmado"
    TALVEZ = "talvez", "Talvez"
    CANCELADO = "cancelado", "Cancelado"


class StatusPauta(models.TextChoices):
    ABERTA = "aberta", "Aberta"
    ENCERRADA = "encerrada", "Encerrada"


class TipoPauta(models.TextChoices):
    ALTERACAO_IGREJA = "alteracao_igreja", "Alteração de dados da igreja"
    CRIAR_GRUPO = "criar_grupo", "Criar grupo"
    CRIAR_SALA = "criar_sala", "Criar sala/local"
    AGENDAR_EVENTO = "agendar_evento", "Agendar evento"
    ENQUETE_LIVRE = "enquete_livre", "Enquete livre"
    OUTRA = "outra", "Outra deliberação"


class OpcaoVoto(models.TextChoices):
    SIM = "sim", "Sim"
    NAO = "nao", "Não"
    ABSTENCAO = "abstencao", "Abstenção"


# --------------------------------------------------------------------------- #
# Igreja
# --------------------------------------------------------------------------- #
class Igreja(models.Model):
    nome = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    descricao = models.TextField(blank=True)

    endereco = models.CharField(max_length=255, blank=True)
    cidade = models.CharField(max_length=120, blank=True, db_index=True)
    estado = models.CharField(max_length=2, blank=True)
    cep = models.CharField(max_length=12, blank=True)

    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    telefone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    foto = models.ImageField(upload_to="igrejas/", null=True, blank=True)

    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Igreja"
        verbose_name_plural = "Igrejas"
        ordering = ["nome"]
        indexes = [
            models.Index(fields=["cidade", "estado"]),
            models.Index(fields=["ativo"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.nome)[:260] or "igreja"
            slug, i = base, 2
            while Igreja.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome


# --------------------------------------------------------------------------- #
# Profile (estende o User padrão do Django)
# --------------------------------------------------------------------------- #
class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    telefone = models.CharField(max_length=20, blank=True)
    foto = models.ImageField(upload_to="perfis/", null=True, blank=True)
    bio = models.TextField(blank=True)

    igreja_principal = models.ForeignKey(
        Igreja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="membros_principais",
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    # Governança
    is_super_admin = models.BooleanField(default=False, db_index=True)

    # Acessibilidade
    fonte_grande = models.BooleanField(default=False)
    notificacoes_email = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Perfil"
        verbose_name_plural = "Perfis"

    @property
    def nome(self):
        return self.user.get_full_name() or self.user.username

    def __str__(self):
        return self.nome


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)


# --------------------------------------------------------------------------- #
# Membro: vínculo Usuário <-> Igreja (com papel local e aprovação)
# --------------------------------------------------------------------------- #
class Membro(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vinculos"
    )
    igreja = models.ForeignKey(
        Igreja, on_delete=models.CASCADE, related_name="membros"
    )
    papel = models.CharField(
        max_length=20, choices=PapelIgreja.choices, default=PapelIgreja.VISITANTE
    )
    status = models.CharField(
        max_length=12, choices=StatusVinculo.choices, default=StatusVinculo.PENDENTE
    )
    data_entrada = models.DateTimeField(auto_now_add=True)
    aprovado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="membros_aprovados",
    )
    motivo_rejeicao = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Membro da igreja"
        verbose_name_plural = "Membros da igreja"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "igreja"], name="uniq_membro_usuario_igreja"
            )
        ]
        indexes = [
            models.Index(fields=["igreja", "status"]),
            models.Index(fields=["igreja", "papel"]),
            models.Index(fields=["usuario", "status"]),
        ]

    @property
    def eh_lideranca(self):
        """Ancião, pastor ou admin da igreja — quem aprova/decide."""
        return self.papel in {
            PapelIgreja.ANCIAO,
            PapelIgreja.PASTOR,
            PapelIgreja.ADMIN,
        }

    def __str__(self):
        return f"{self.usuario} @ {self.igreja} ({self.get_papel_display()})"


# --------------------------------------------------------------------------- #
# Grupo + membros de grupo
# --------------------------------------------------------------------------- #
class Grupo(models.Model):
    nome = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, blank=True)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(
        max_length=20, choices=TipoGrupo.choices, default=TipoGrupo.MINISTERIO
    )
    igreja = models.ForeignKey(
        Igreja, on_delete=models.CASCADE, related_name="grupos"
    )
    foto = models.ImageField(upload_to="grupos/", null=True, blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Grupo"
        verbose_name_plural = "Grupos"
        ordering = ["nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["igreja", "slug"], name="uniq_grupo_igreja_slug"
            )
        ]
        indexes = [
            models.Index(fields=["igreja", "ativo"]),
            models.Index(fields=["igreja", "tipo"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.nome)[:260] or "grupo"
            slug, i = base, 2
            while (
                Grupo.objects.filter(igreja=self.igreja, slug=slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nome} ({self.igreja.nome})"


class GrupoMembro(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vinculos_grupo",
    )
    grupo = models.ForeignKey(
        Grupo, on_delete=models.CASCADE, related_name="membros"
    )
    cargo = models.CharField(
        max_length=12, choices=CargoGrupo.choices, default=CargoGrupo.MEMBRO
    )
    status = models.CharField(
        max_length=12, choices=StatusVinculo.choices, default=StatusVinculo.PENDENTE
    )
    data_entrada = models.DateTimeField(auto_now_add=True)
    motivo_rejeicao = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Membro de grupo"
        verbose_name_plural = "Membros de grupo"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "grupo"], name="uniq_grupomembro_usuario_grupo"
            )
        ]
        indexes = [
            models.Index(fields=["grupo", "status"]),
            models.Index(fields=["usuario", "status"]),
        ]

    @property
    def eh_lideranca(self):
        return self.cargo in {CargoGrupo.LIDER, CargoGrupo.DIRETOR}

    def __str__(self):
        return f"{self.usuario} em {self.grupo} ({self.get_cargo_display()})"


# --------------------------------------------------------------------------- #
# Sala / Local
# --------------------------------------------------------------------------- #
class Sala(models.Model):
    nome = models.CharField(max_length=255)
    igreja = models.ForeignKey(
        Igreja, on_delete=models.CASCADE, related_name="salas"
    )
    capacidade = models.PositiveIntegerField(null=True, blank=True)
    equipamentos = models.CharField(max_length=255, blank=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Sala / Local"
        verbose_name_plural = "Salas / Locais"
        ordering = ["nome"]
        indexes = [models.Index(fields=["igreja", "ativo"])]

    def __str__(self):
        return f"{self.nome} ({self.igreja.nome})"


# --------------------------------------------------------------------------- #
# Evento + Inscrição
# --------------------------------------------------------------------------- #
class Evento(models.Model):
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    igreja = models.ForeignKey(
        Igreja, on_delete=models.CASCADE, related_name="eventos"
    )
    grupo = models.ForeignKey(
        Grupo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos",
    )
    sala = models.ForeignKey(
        Sala,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos",
    )

    inicio = models.DateTimeField(db_index=True)
    fim = models.DateTimeField()

    visibilidade = models.CharField(
        max_length=10,
        choices=VisibilidadeEvento.choices,
        default=VisibilidadeEvento.PUBLICO,
    )
    status = models.CharField(
        max_length=12, choices=StatusEvento.choices, default=StatusEvento.RASCUNHO
    )
    recorrencia = models.CharField(
        max_length=10, choices=Recorrencia.choices, default=Recorrencia.NENHUMA
    )
    recorrencia_ate = models.DateField(null=True, blank=True)

    foto = models.ImageField(upload_to="eventos/", null=True, blank=True)

    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="eventos_criados",
    )
    aprovado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_aprovados",
    )
    motivo_rejeicao = models.CharField(max_length=255, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"
        ordering = ["inicio"]
        indexes = [
            # Agenda da igreja: filtra por igreja+status e ordena por início.
            models.Index(fields=["igreja", "status", "inicio"]),
            models.Index(fields=["grupo", "inicio"]),
            models.Index(fields=["status", "inicio"]),
            models.Index(fields=["visibilidade", "status"]),
        ]

    def __str__(self):
        return self.titulo


class Inscricao(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="inscricoes"
    )
    evento = models.ForeignKey(
        Evento, on_delete=models.CASCADE, related_name="inscricoes"
    )
    status = models.CharField(
        max_length=12,
        choices=StatusInscricao.choices,
        default=StatusInscricao.CONFIRMADO,
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Inscrição"
        verbose_name_plural = "Inscrições"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "evento"], name="uniq_inscricao_usuario_evento"
            )
        ]
        indexes = [
            models.Index(fields=["evento", "status"]),
            models.Index(fields=["usuario", "status"]),
        ]

    def __str__(self):
        return f"{self.usuario} -> {self.evento} ({self.get_status_display()})"


# --------------------------------------------------------------------------- #
# Pauta + Voto (deliberação dos anciões)
# --------------------------------------------------------------------------- #
class Pauta(models.Model):
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    igreja = models.ForeignKey(
        Igreja, on_delete=models.CASCADE, related_name="pautas"
    )
    criada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="pautas_criadas",
    )
    tipo = models.CharField(
        max_length=20, choices=TipoPauta.choices, default=TipoPauta.OUTRA
    )
    # Proposta concreta (ex.: {"antes": {...}, "depois": {...}} ou dados de criação).
    payload = models.JSONField(null=True, blank=True)
    # Opções customizadas para enquete_livre (lista de strings). Vazio = sim/não/abstenção.
    opcoes = models.JSONField(null=True, blank=True)
    anonima = models.BooleanField(
        default=False, help_text="Se marcado, os votos não revelam quem votou."
    )
    permitir_justificativa = models.BooleanField(default=True)
    prazo_votacao = models.DateTimeField(null=True, blank=True)
    quorum_minimo = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Nº mínimo de votos para encerrar a pauta automaticamente.",
    )
    status = models.CharField(
        max_length=10, choices=StatusPauta.choices, default=StatusPauta.ABERTA
    )
    # aprovado / rejeitado / empate (ou a opção vencedora numa enquete).
    decisao = models.CharField(max_length=50, blank=True)
    aplicada_em = models.DateTimeField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Pauta"
        verbose_name_plural = "Pautas"
        ordering = ["-criado_em"]
        indexes = [models.Index(fields=["igreja", "status", "-criado_em"])]

    @property
    def expirada(self):
        return bool(self.prazo_votacao and self.prazo_votacao < timezone.now())

    @property
    def quorum_atingido(self):
        return bool(self.quorum_minimo and self.votos.count() >= self.quorum_minimo)

    def _computar_decisao(self):
        """Decide o resultado: para enquete, a opção vencedora; senão sim/não."""
        from collections import Counter

        contagem = Counter(v.opcao for v in self.votos.all())
        if self.tipo == TipoPauta.ENQUETE_LIVRE and self.opcoes:
            vencedora = ""
            melhor = -1
            for op in self.opcoes:
                n = contagem.get(op, 0)
                if n > melhor:
                    melhor, vencedora = n, op
            return vencedora
        sim, nao = contagem.get("sim", 0), contagem.get("nao", 0)
        if sim > nao:
            return "aprovado"
        if nao > sim:
            return "rejeitado"
        return "empate"

    def fechar_se_necessario(self):
        """Encerra a pauta (quórum/prazo), computa a decisão e aplica se aprovada."""
        if self.status != StatusPauta.ABERTA:
            return False
        if self.quorum_atingido or self.expirada:
            self.decisao = self._computar_decisao()
            self.status = StatusPauta.ENCERRADA
            self.save(update_fields=["status", "decisao"])
            if self.decisao == "aprovado":
                self.aplicar()
            return True
        return False

    def aplicar(self):
        """Aplica o payload de uma pauta aprovada (idempotente)."""
        if self.aplicada_em or self.tipo in (TipoPauta.ENQUETE_LIVRE, TipoPauta.OUTRA):
            return
        from django.utils.dateparse import parse_datetime

        p = self.payload or {}
        try:
            if self.tipo == TipoPauta.ALTERACAO_IGREJA:
                depois = p.get("depois", {})
                campos_ok = {
                    "nome", "descricao", "endereco", "cidade", "estado", "cep",
                    "telefone", "email", "latitude", "longitude",
                }
                for k, v in depois.items():
                    if k in campos_ok:
                        setattr(self.igreja, k, v)
                self.igreja.save()
            elif self.tipo == TipoPauta.CRIAR_GRUPO:
                Grupo.objects.create(
                    igreja=self.igreja,
                    nome=p.get("nome", "Novo grupo"),
                    tipo=p.get("tipo", "ministerio"),
                    descricao=p.get("descricao", ""),
                )
            elif self.tipo == TipoPauta.CRIAR_SALA:
                Sala.objects.create(
                    igreja=self.igreja,
                    nome=p.get("nome", "Nova sala"),
                    capacidade=p.get("capacidade") or None,
                    equipamentos=p.get("equipamentos", ""),
                )
            elif self.tipo == TipoPauta.AGENDAR_EVENTO:
                Evento.objects.create(
                    igreja=self.igreja,
                    titulo=p.get("titulo", "Evento"),
                    descricao=p.get("descricao", ""),
                    inicio=parse_datetime(p["inicio"]),
                    fim=parse_datetime(p["fim"]),
                    visibilidade=p.get("visibilidade", "publico"),
                    status=StatusEvento.APROVADO,
                    criado_por=self.criada_por,
                    aprovado_por=self.criada_por,
                )
            self.aplicada_em = timezone.now()
            self.save(update_fields=["aplicada_em"])
        except Exception:
            # Não derruba a votação se o payload estiver malformado.
            pass

    def __str__(self):
        return self.titulo


class Voto(models.Model):
    pauta = models.ForeignKey(Pauta, on_delete=models.CASCADE, related_name="votos")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="votos"
    )
    # sim/não/abstenção nas pautas padrão, ou uma das opções da enquete.
    opcao = models.CharField(max_length=50)
    comentario = models.TextField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Voto"
        verbose_name_plural = "Votos"
        constraints = [
            models.UniqueConstraint(
                fields=["pauta", "usuario"], name="uniq_voto_pauta_usuario"
            )
        ]
        indexes = [models.Index(fields=["pauta", "opcao"])]

    def __str__(self):
        return f"Voto {self.get_opcao_display()} em {self.pauta}"


# --------------------------------------------------------------------------- #
# Chat de grupo
# --------------------------------------------------------------------------- #
class Mensagem(models.Model):
    grupo = models.ForeignKey(
        Grupo, on_delete=models.CASCADE, related_name="mensagens"
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mensagens"
    )
    conteudo = models.TextField()
    anexo = models.FileField(upload_to="chat/", null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Mensagem"
        verbose_name_plural = "Mensagens"
        ordering = ["criado_em"]
        indexes = [models.Index(fields=["grupo", "criado_em"])]

    def __str__(self):
        return f"{self.autor} em {self.grupo}: {self.conteudo[:30]}"


# --------------------------------------------------------------------------- #
# Notificações
# --------------------------------------------------------------------------- #
class Notificacao(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificacoes",
    )
    tipo = models.CharField(max_length=40, blank=True)
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField(blank=True)
    link = models.CharField(max_length=255, blank=True)
    lida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notificação"
        verbose_name_plural = "Notificações"
        ordering = ["-criado_em"]
        indexes = [models.Index(fields=["usuario", "lida", "-criado_em"])]

    def __str__(self):
        return f"{self.titulo} -> {self.usuario}"


# --------------------------------------------------------------------------- #
# Auditoria (governança)
# --------------------------------------------------------------------------- #
class AuditLog(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="acoes",
    )
    acao = models.CharField(max_length=80)
    entidade = models.CharField(max_length=80, blank=True)
    entidade_id = models.PositiveIntegerField(null=True, blank=True)
    detalhes = models.JSONField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registro de auditoria"
        verbose_name_plural = "Registros de auditoria"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["entidade", "entidade_id"]),
            models.Index(fields=["-criado_em"]),
        ]

    def __str__(self):
        return f"{self.usuario} {self.acao} {self.entidade}#{self.entidade_id}"


@receiver(post_save, sender=Voto)
def fechar_pauta_no_quorum(sender, instance, created, **kwargs):
    """Ao registrar um voto, encerra a pauta se o quórum foi atingido.

    Refetch fresco da pauta (a instância em `instance.pauta` pode vir com os
    votos pré-carregados via prefetch_related, o que daria uma contagem velha).
    """
    if created:
        Pauta.objects.get(pk=instance.pauta_id).fechar_se_necessario()
