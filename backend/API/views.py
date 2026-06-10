"""
Viewsets e endpoints da API — IASD Gestão.

Convenções de autorização:
- Leitura de dados públicos (igrejas, grupos, eventos aprovados públicos) é aberta.
- Ações sensíveis (aprovar evento, votar pauta, gerir membros) checam `roles.*`.
- Toda mutação relevante grava AuditLog via `utils.log_acao`.
"""

from datetime import timedelta, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import roles
from .models import (
    CargoGrupo,
    EnqueteGrupo,
    EnqueteOpcao,
    EnqueteVoto,
    Evento,
    Grupo,
    GrupoMembro,
    Igreja,
    IgrejaSeguidor,
    Inscricao,
    Membro,
    Mensagem,
    Notificacao,
    OpcaoVoto,
    PapelIgreja,
    Pauta,
    PautaAnexo,
    PautaComentario,
    Recorrencia,
    Sala,
    StatusEvento,
    StatusInscricao,
    StatusPauta,
    StatusVinculo,
    VisibilidadeEvento,
    Voto,
)
from .permissions import IsSuperAdmin
from .serializers import (
    AuditLogSerializer,
    EnqueteGrupoSerializer,
    PautaAnexoSerializer,
    PautaComentarioSerializer,
    EventoSerializer,
    GrupoMembroSerializer,
    GrupoSerializer,
    IgrejaSerializer,
    InscricaoSerializer,
    MembroSerializer,
    MensagemSerializer,
    MeSerializer,
    NotificacaoSerializer,
    PautaSerializer,
    ProfileSerializer,
    RegisterSerializer,
    SalaSerializer,
    UsuarioMiniSerializer,
    VotoSerializer,
)
from .utils import haversine_km, log_acao, notificar, proximo_mensal

User = get_user_model()


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Healthcheck simples para monitoramento/deploy (PythonAnywhere)."""
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([AllowAny])
def search(request):
    """Busca global agrupada (igrejas, grupos, eventos, pessoas)."""
    q = (request.query_params.get("q") or "").strip()
    if len(q) < 2:
        return Response({"igrejas": [], "grupos": [], "eventos": [], "pessoas": []})

    ctx = {"request": request}

    igrejas = Igreja.objects.filter(ativo=True).filter(
        Q(nome__icontains=q) | Q(cidade__icontains=q)
    )[:6]
    grupos = Grupo.objects.filter(ativo=True, nome__icontains=q).select_related("igreja")[:6]
    eventos = (
        Evento.objects.filter(
            status=StatusEvento.APROVADO,
            visibilidade=VisibilidadeEvento.PUBLICO,
            fim__gte=timezone.now(),
            titulo__icontains=q,
        )
        .select_related("igreja", "grupo")
        .order_by("inicio")[:6]
    )

    # Pessoas só para usuários autenticados (privacidade).
    pessoas = []
    if request.user.is_authenticated:
        usuarios = (
            User.objects.filter(is_active=True)
            .filter(
                Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(username__icontains=q)
            )
            .select_related("profile")[:6]
        )
        pessoas = UsuarioMiniSerializer(usuarios, many=True, context=ctx).data

    return Response(
        {
            "igrejas": IgrejaSerializer(igrejas, many=True, context=ctx).data,
            "grupos": GrupoSerializer(grupos, many=True, context=ctx).data,
            "eventos": EventoSerializer(eventos, many=True, context=ctx).data,
            "pessoas": pessoas,
        }
    )


def _abrir_pauta_criacao(user, igreja, tipo, titulo, categoria, payload, metodo="maioria_simples"):
    """
    Abre uma pauta de proposta no Canal dos Anciões (em vez de criar direto).
    Notifica proponente + anciões. Usado pelo enforcement de governança.
    """
    pauta = Pauta.objects.create(
        igreja=igreja, criada_por=user, tipo=tipo, titulo=titulo,
        categoria=categoria, payload=payload, metodo_votacao=metodo,
    )
    log_acao(user, "criar_pauta", "Pauta", pauta.id, {"tipo": tipo, "via": "enforcement"})
    notificar(
        user, "Proposta enviada para votação",
        f"“{titulo}” foi enviada ao Canal dos Anciões. Acompanhe o andamento.",
        tipo="pauta_proposta", link=f"/pauta/{pauta.id}",
    )
    for lider in Membro.objects.filter(
        igreja=igreja, status=StatusVinculo.ATIVO,
        papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN],
    ).exclude(usuario=user).select_related("usuario"):
        notificar(
            lider.usuario, "📜 Nova pauta para votar",
            f"“{titulo}” aguarda seu voto no Canal dos Anciões.",
            tipo="pauta_nova", link=f"/igreja/{igreja.id}/canal",
        )
    return pauta


ANEXO_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".docx", ".xlsx", ".txt", ".md"}
ANEXO_MAX = 10 * 1024 * 1024


def _validar_anexo(arquivo):
    """Valida extensão e tamanho. Retorna (ok, erro)."""
    import os

    nome = (arquivo.name or "").lower()
    ext = os.path.splitext(nome)[1]
    if ext not in ANEXO_EXTS:
        return False, f"Tipo não permitido ({ext})."
    if arquivo.size > ANEXO_MAX:
        return False, "Arquivo maior que 10 MB."
    # Imagens passam por verificação extra do Pillow.
    if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        try:
            from PIL import Image

            Image.open(arquivo).verify()
            arquivo.seek(0)
        except Exception:
            return False, "Imagem inválida."
    return True, ""


def _resposta_pauta_aberta(pauta):
    return Response(
        {
            "status": "pauta_aberta",
            "pauta_id": pauta.id,
            "mensagem": "Sua proposta foi enviada ao Canal dos Anciões para votação.",
        },
        status=status.HTTP_202_ACCEPTED,
    )


def _salvar_foto(instance, request):
    """
    Valida (Pillow) e salva a imagem enviada no campo `foto`.
    Retorna (ok: bool, erro: str). Limite de 5 MB, somente imagens válidas.
    """
    arquivo = request.FILES.get("foto")
    if not arquivo:
        return False, "Envie um arquivo de imagem."
    if arquivo.size > 5 * 1024 * 1024:
        return False, "Imagem muito grande (máximo 5 MB)."
    try:
        from PIL import Image

        Image.open(arquivo).verify()
        arquivo.seek(0)
    except Exception:
        return False, "Arquivo de imagem inválido."
    instance.foto = arquivo
    instance.save(update_fields=["foto"])
    return True, ""


# --------------------------------------------------------------------------- #
# Autenticação / perfil
# --------------------------------------------------------------------------- #
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_acao(user, "registro", "User", user.id)
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": ProfileSerializer(user.profile, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = MeSerializer(
            {"user": request.user, "profile": request.user.profile},
            context={"request": request},
        ).data
        return Response(data)

    def patch(self, request):
        serializer = ProfileSerializer(
            request.user.profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MeFotoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ok, erro = _salvar_foto(request.user.profile, request)
        if not ok:
            return Response({"foto": erro}, status=400)
        return Response(
            ProfileSerializer(request.user.profile, context={"request": request}).data
        )


class TrocarSenhaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        atual = request.data.get("senha_atual", "")
        nova = request.data.get("senha_nova", "")
        if not request.user.check_password(atual):
            return Response(
                {"senha_atual": "Senha atual incorreta."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            validate_password(nova, request.user)
        except ValidationError as exc:
            return Response({"senha_nova": exc.messages}, status=400)
        request.user.set_password(nova)
        request.user.save(update_fields=["password"])
        log_acao(request.user, "troca_senha", "User", request.user.id)
        return Response({"detail": "Senha atualizada."})


# --------------------------------------------------------------------------- #
# Igreja
# --------------------------------------------------------------------------- #
class IgrejaViewSet(viewsets.ModelViewSet):
    serializer_class = IgrejaSerializer
    filterset_fields = ["cidade", "estado", "ativo"]
    search_fields = ["nome", "cidade", "endereco"]
    ordering_fields = ["nome", "criado_em"]

    def get_queryset(self):
        qs = Igreja.objects.all()
        if self.action == "list":
            ver_todas = (
                self.request.query_params.get("todas") == "1"
                and roles.is_super(self.request.user)
            )
            if not ver_todas:
                qs = qs.filter(ativo=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "create":
            return [IsSuperAdmin()]
        return [IsAuthenticated()]

    def _pode_editar(self, igreja):
        # Edição direta dos dados: só admin da igreja / super. Anciões propõem
        # alterações pelo Canal dos Anciões (votação).
        return roles.eh_admin_igreja(self.request.user, igreja)

    def update(self, request, *args, **kwargs):
        igreja = self.get_object()
        if not self._pode_editar(igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not roles.is_super(request.user):
            return Response({"detail": "Apenas o administrador geral."}, status=403)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        igreja = serializer.save()
        log_acao(self.request.user, "criar_igreja", "Igreja", igreja.id)
        # Opcional: define um ancião responsável pelo e-mail informado.
        email = (self.request.data.get("anciao_email") or "").strip().lower()
        if email:
            user = User.objects.filter(email__iexact=email).first()
            if user:
                Membro.objects.update_or_create(
                    usuario=user,
                    igreja=igreja,
                    defaults={
                        "papel": PapelIgreja.ANCIAO,
                        "status": StatusVinculo.ATIVO,
                        "aprovado_por": self.request.user,
                    },
                )
                notificar(
                    user,
                    "Você foi definido como ancião",
                    f"Você é ancião responsável de {igreja.nome}.",
                    tipo="papel",
                    link=f"/igreja/{igreja.id}",
                )

    def list(self, request, *args, **kwargs):
        """Lista com ordenação opcional por proximidade (?lat=&lng=)."""
        qs = self.filter_queryset(self.get_queryset())
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")

        if lat and lng:
            igrejas = list(qs)
            for ig in igrejas:
                ig.distancia_km = (
                    haversine_km(lat, lng, ig.latitude, ig.longitude)
                    if ig.latitude is not None and ig.longitude is not None
                    else None
                )
            igrejas.sort(
                key=lambda i: (
                    i.distancia_km is None,
                    i.distancia_km if i.distancia_km is not None else 0,
                )
            )
            page = self.paginate_queryset(igrejas)
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return super().list(request, *args, **kwargs)

    # --- membros / entrada ---
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def entrar(self, request, pk=None):
        igreja = self.get_object()
        membro, created = Membro.objects.get_or_create(
            usuario=request.user,
            igreja=igreja,
            defaults={"papel": PapelIgreja.VISITANTE, "status": StatusVinculo.PENDENTE},
        )
        if not created and membro.status == StatusVinculo.REJEITADO:
            membro.status = StatusVinculo.PENDENTE
            membro.save(update_fields=["status"])
        # Define como igreja principal se o usuário ainda não tem.
        if request.user.profile.igreja_principal_id is None:
            request.user.profile.igreja_principal = igreja
            request.user.profile.save(update_fields=["igreja_principal"])
        # Ao entrar, passa a seguir automaticamente (pode deixar depois).
        IgrejaSeguidor.objects.get_or_create(usuario=request.user, igreja=igreja)
        log_acao(request.user, "pedir_entrada_igreja", "Igreja", igreja.id)
        # Avisa a liderança.
        for lider in Membro.objects.filter(
            igreja=igreja,
            status=StatusVinculo.ATIVO,
            papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN],
        ).select_related("usuario"):
            notificar(
                lider.usuario,
                "Novo pedido de entrada",
                f"{request.user.get_full_name() or request.user.username} pediu para entrar em {igreja.nome}.",
                tipo="membro_pendente",
                link=f"/igreja/{igreja.id}/membros",
            )
        return Response(
            MembroSerializer(membro, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def sair(self, request, pk=None):
        igreja = self.get_object()
        Membro.objects.filter(usuario=request.user, igreja=igreja).delete()
        log_acao(request.user, "sair_igreja", "Igreja", igreja.id)
        return Response({"detail": "Você saiu da igreja."})

    @action(detail=True, methods=["get"])
    def membros(self, request, pk=None):
        igreja = self.get_object()
        qs = Membro.objects.filter(igreja=igreja).select_related("usuario", "usuario__profile")
        status_filtro = request.query_params.get("status")
        # Pendentes só para a liderança.
        if not roles.eh_lideranca_igreja(request.user, igreja):
            qs = qs.filter(status=StatusVinculo.ATIVO)
        elif status_filtro:
            qs = qs.filter(status=status_filtro)
        qs = qs.order_by("status", "usuario__first_name")
        return Response(
            MembroSerializer(qs, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["get"])
    def grupos(self, request, pk=None):
        igreja = self.get_object()
        qs = Grupo.objects.filter(igreja=igreja, ativo=True)
        return Response(
            GrupoSerializer(qs, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["get"])
    def salas(self, request, pk=None):
        igreja = self.get_object()
        qs = Sala.objects.filter(igreja=igreja, ativo=True)
        return Response(SalaSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def foto(self, request, pk=None):
        igreja = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        ok, erro = _salvar_foto(igreja, request)
        if not ok:
            return Response({"foto": erro}, status=400)
        return Response(IgrejaSerializer(igreja, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def lideranca(self, request, pk=None):
        igreja = self.get_object()
        qs = Membro.objects.filter(
            igreja=igreja,
            status=StatusVinculo.ATIVO,
            papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN],
        ).select_related("usuario", "usuario__profile")
        return Response(
            MembroSerializer(qs, many=True, context={"request": request}).data
        )

    # --- seguir (curadoria de feed; != ser membro) ---
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def seguir(self, request, pk=None):
        igreja = self.get_object()
        IgrejaSeguidor.objects.get_or_create(usuario=request.user, igreja=igreja)
        return Response({"eu_sigo": True})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="deixar-de-seguir")
    def deixar_de_seguir(self, request, pk=None):
        igreja = self.get_object()
        IgrejaSeguidor.objects.filter(usuario=request.user, igreja=igreja).delete()
        return Response({"eu_sigo": False})

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def seguidas(self, request):
        ids = IgrejaSeguidor.objects.filter(usuario=request.user).values_list("igreja_id", flat=True)
        qs = Igreja.objects.filter(id__in=ids, ativo=True)
        return Response(IgrejaSerializer(qs, many=True, context={"request": request}).data)


# --------------------------------------------------------------------------- #
# Membro (gestão pela liderança)
# --------------------------------------------------------------------------- #
class MembroViewSet(viewsets.ModelViewSet):
    serializer_class = MembroSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["igreja", "status", "papel"]

    def get_queryset(self):
        user = self.request.user
        if roles.is_super(user):
            return Membro.objects.select_related("usuario", "usuario__profile", "igreja")
        # Liderança vê os membros das igrejas que administra; demais veem só os próprios.
        igrejas = roles.igrejas_que_lidera_ids(user)
        return Membro.objects.filter(
            Q(igreja_id__in=igrejas) | Q(usuario=user)
        ).select_related("usuario", "usuario__profile", "igreja")

    def _exige_lideranca(self, membro):
        return roles.eh_lideranca_igreja(self.request.user, membro.igreja)

    @action(detail=True, methods=["post"])
    def aprovar(self, request, pk=None):
        membro = self.get_object()
        if not self._exige_lideranca(membro):
            return Response({"detail": "Sem permissão."}, status=403)
        membro.status = StatusVinculo.ATIVO
        membro.aprovado_por = request.user
        membro.save(update_fields=["status", "aprovado_por"])
        log_acao(request.user, "aprovar_membro", "Membro", membro.id)
        notificar(
            membro.usuario,
            "Entrada aprovada",
            f"Você agora é membro de {membro.igreja.nome}.",
            tipo="membro_aprovado",
            link=f"/igreja/{membro.igreja_id}",
        )
        return Response(MembroSerializer(membro, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def rejeitar(self, request, pk=None):
        membro = self.get_object()
        if not self._exige_lideranca(membro):
            return Response({"detail": "Sem permissão."}, status=403)
        membro.status = StatusVinculo.REJEITADO
        membro.motivo_rejeicao = request.data.get("motivo", "")
        membro.save(update_fields=["status", "motivo_rejeicao"])
        log_acao(request.user, "rejeitar_membro", "Membro", membro.id)
        notificar(
            membro.usuario,
            "Pedido de entrada não aprovado",
            f"Seu pedido para entrar em {membro.igreja.nome} não foi aprovado."
            + (f" Motivo: {membro.motivo_rejeicao}" if membro.motivo_rejeicao else ""),
            tipo="membro_rejeitado",
            link=f"/igreja/{membro.igreja_id}",
        )
        return Response(MembroSerializer(membro, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def definir_papel(self, request, pk=None):
        membro = self.get_object()
        if not self._exige_lideranca(membro):
            return Response({"detail": "Sem permissão."}, status=403)
        papel = request.data.get("papel")
        if papel not in PapelIgreja.values:
            return Response({"papel": "Papel inválido."}, status=400)
        membro.papel = papel
        if membro.status != StatusVinculo.ATIVO:
            membro.status = StatusVinculo.ATIVO
        membro.save(update_fields=["papel", "status"])
        log_acao(request.user, "definir_papel", "Membro", membro.id, {"papel": papel})
        notificar(
            membro.usuario,
            "Seu papel mudou",
            f"Você agora é {membro.get_papel_display()} em {membro.igreja.nome}.",
            tipo="papel",
            link=f"/igreja/{membro.igreja_id}",
        )
        return Response(MembroSerializer(membro, context={"request": request}).data)


# --------------------------------------------------------------------------- #
# Grupo
# --------------------------------------------------------------------------- #
class GrupoViewSet(viewsets.ModelViewSet):
    serializer_class = GrupoSerializer
    filterset_fields = ["igreja", "tipo", "ativo"]
    search_fields = ["nome", "descricao"]

    def get_queryset(self):
        qs = Grupo.objects.select_related("igreja")
        if self.action == "list":
            qs = qs.filter(ativo=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Criar grupo afeta a igreja toda → vira PAUTA no Canal (governança).

        Super admin pode criar direto (bootstrapping) passando ?direto=1.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        igreja = serializer.validated_data["igreja"]
        if not (roles.eh_membro(request.user, igreja) or roles.eh_lideranca_igreja(request.user, igreja)):
            return Response({"detail": "Você precisa ser membro da igreja."}, status=403)

        bypass = roles.is_super(request.user) and request.query_params.get("direto") == "1"
        if not bypass:
            dados = serializer.validated_data
            pauta = _abrir_pauta_criacao(
                request.user, igreja, "criar_grupo",
                f"Criar grupo: {dados.get('nome')}", "grupos",
                {
                    "nome": dados.get("nome", ""),
                    "tipo": dados.get("tipo", "ministerio"),
                    "descricao": dados.get("descricao", ""),
                },
            )
            return _resposta_pauta_aberta(pauta)

        grupo = serializer.save()
        GrupoMembro.objects.create(
            usuario=request.user, grupo=grupo, cargo=CargoGrupo.DIRETOR, status=StatusVinculo.ATIVO,
        )
        log_acao(request.user, "criar_grupo", "Grupo", grupo.id, {"direto": True})
        return Response(self.get_serializer(grupo).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        grupo = self.get_object()
        if not roles.eh_lideranca_grupo(request.user, grupo):
            return Response({"detail": "Sem permissão."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        grupo = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, grupo.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def entrar(self, request, pk=None):
        grupo = self.get_object()
        gm, created = GrupoMembro.objects.get_or_create(
            usuario=request.user,
            grupo=grupo,
            defaults={"cargo": CargoGrupo.MEMBRO, "status": StatusVinculo.PENDENTE},
        )
        if not created and gm.status == StatusVinculo.REJEITADO:
            gm.status = StatusVinculo.PENDENTE
            gm.save(update_fields=["status"])
        log_acao(request.user, "pedir_entrada_grupo", "Grupo", grupo.id)
        for lider in GrupoMembro.objects.filter(
            grupo=grupo,
            status=StatusVinculo.ATIVO,
            cargo__in=[CargoGrupo.LIDER, CargoGrupo.DIRETOR],
        ).select_related("usuario"):
            notificar(
                lider.usuario,
                "Novo pedido no grupo",
                f"{request.user.get_full_name() or request.user.username} quer entrar em {grupo.nome}.",
                tipo="grupo_pendente",
                link=f"/grupo/{grupo.id}/membros",
            )
        return Response(
            GrupoMembroSerializer(gm, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def sair(self, request, pk=None):
        grupo = self.get_object()
        GrupoMembro.objects.filter(usuario=request.user, grupo=grupo).delete()
        log_acao(request.user, "sair_grupo", "Grupo", grupo.id)
        return Response({"detail": "Você saiu do grupo."})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def foto(self, request, pk=None):
        grupo = self.get_object()
        if not roles.eh_lideranca_grupo(request.user, grupo):
            return Response({"detail": "Sem permissão."}, status=403)
        ok, erro = _salvar_foto(grupo, request)
        if not ok:
            return Response({"foto": erro}, status=400)
        return Response(GrupoSerializer(grupo, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def membros(self, request, pk=None):
        grupo = self.get_object()
        qs = GrupoMembro.objects.filter(grupo=grupo).select_related(
            "usuario", "usuario__profile"
        )
        if not roles.eh_lideranca_grupo(request.user, grupo):
            qs = qs.filter(status=StatusVinculo.ATIVO)
        elif request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        qs = qs.order_by("status", "cargo")
        return Response(
            GrupoMembroSerializer(qs, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["get", "post"], permission_classes=[IsAuthenticated])
    def mensagens(self, request, pk=None):
        grupo = self.get_object()
        if not (roles.eh_membro_grupo(request.user, grupo) or roles.eh_lideranca_grupo(request.user, grupo)):
            return Response({"detail": "Só membros do grupo acessam o chat."}, status=403)
        if request.method == "POST":
            conteudo = (request.data.get("conteudo") or "").strip()
            if not conteudo:
                return Response({"conteudo": "Mensagem vazia."}, status=400)
            msg = Mensagem.objects.create(
                grupo=grupo, autor=request.user, conteudo=conteudo
            )
            return Response(
                MensagemSerializer(msg, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )
        qs = Mensagem.objects.filter(grupo=grupo).select_related(
            "autor", "autor__profile", "enquete", "enquete__criada_por",
            "enquete__criada_por__profile",
        ).prefetch_related("enquete__opcoes__votos__usuario__profile")
        depois = request.query_params.get("depois_de")
        if depois:
            qs = qs.filter(id__gt=depois)
        qs = qs.order_by("criado_em")[:200]
        return Response(
            MensagemSerializer(qs, many=True, context={"request": request}).data
        )


class GrupoMembroViewSet(viewsets.ModelViewSet):
    serializer_class = GrupoMembroSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["grupo", "status", "cargo"]

    def get_queryset(self):
        user = self.request.user
        if roles.is_super(user):
            return GrupoMembro.objects.select_related("usuario", "grupo")
        return GrupoMembro.objects.filter(
            Q(usuario=user)
            | Q(grupo__membros__usuario=user, grupo__membros__cargo__in=[CargoGrupo.LIDER, CargoGrupo.DIRETOR], grupo__membros__status=StatusVinculo.ATIVO)
        ).select_related("usuario", "grupo").distinct()

    @action(detail=True, methods=["post"])
    def aprovar(self, request, pk=None):
        gm = self.get_object()
        if not roles.eh_lideranca_grupo(request.user, gm.grupo):
            return Response({"detail": "Sem permissão."}, status=403)
        gm.status = StatusVinculo.ATIVO
        gm.save(update_fields=["status"])
        log_acao(request.user, "aprovar_grupo_membro", "GrupoMembro", gm.id)
        notificar(
            gm.usuario,
            "Entrada no grupo aprovada",
            f"Você agora faz parte de {gm.grupo.nome}.",
            tipo="grupo_aprovado",
            link=f"/grupo/{gm.grupo_id}",
        )
        return Response(GrupoMembroSerializer(gm, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def rejeitar(self, request, pk=None):
        gm = self.get_object()
        if not roles.eh_lideranca_grupo(request.user, gm.grupo):
            return Response({"detail": "Sem permissão."}, status=403)
        gm.status = StatusVinculo.REJEITADO
        gm.motivo_rejeicao = request.data.get("motivo", "")
        gm.save(update_fields=["status", "motivo_rejeicao"])
        log_acao(request.user, "rejeitar_grupo_membro", "GrupoMembro", gm.id)
        notificar(
            gm.usuario,
            "Pedido no grupo não aprovado",
            f"Seu pedido para entrar em {gm.grupo.nome} não foi aprovado."
            + (f" Motivo: {gm.motivo_rejeicao}" if gm.motivo_rejeicao else ""),
            tipo="grupo_rejeitado",
            link=f"/grupo/{gm.grupo_id}",
        )
        return Response(GrupoMembroSerializer(gm, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def definir_cargo(self, request, pk=None):
        gm = self.get_object()
        if not roles.eh_lideranca_grupo(request.user, gm.grupo):
            return Response({"detail": "Sem permissão."}, status=403)
        cargo = request.data.get("cargo")
        if cargo not in CargoGrupo.values:
            return Response({"cargo": "Cargo inválido."}, status=400)
        gm.cargo = cargo
        if gm.status != StatusVinculo.ATIVO:
            gm.status = StatusVinculo.ATIVO
        gm.save(update_fields=["cargo", "status"])
        log_acao(request.user, "definir_cargo", "GrupoMembro", gm.id, {"cargo": cargo})
        return Response(GrupoMembroSerializer(gm, context={"request": request}).data)


# --------------------------------------------------------------------------- #
# Enquete do chat de grupo (informal — qualquer membro cria, todos votam)
# --------------------------------------------------------------------------- #
class EnqueteGrupoViewSet(viewsets.ModelViewSet):
    serializer_class = EnqueteGrupoSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post"]

    def get_queryset(self):
        qs = EnqueteGrupo.objects.select_related(
            "grupo", "criada_por", "criada_por__profile"
        ).prefetch_related("opcoes__votos__usuario__profile")
        grupo = self.request.query_params.get("grupo")
        if grupo:
            qs = qs.filter(grupo_id=grupo)
        return qs

    def _membro(self, grupo):
        return roles.eh_membro_grupo(self.request.user, grupo) or roles.eh_lideranca_grupo(
            self.request.user, grupo
        )

    def create(self, request, *args, **kwargs):
        from django.db import transaction
        from django.shortcuts import get_object_or_404
        from django.utils.dateparse import parse_datetime

        grupo = get_object_or_404(Grupo, pk=request.data.get("grupo"))
        if not self._membro(grupo):
            return Response({"detail": "Só membros do grupo criam enquetes."}, status=403)

        pergunta = (request.data.get("pergunta") or "").strip()
        opcoes = [
            (o or "").strip()
            for o in (request.data.get("opcoes") or [])
            if (o or "").strip()
        ]
        if not pergunta:
            return Response({"pergunta": "Informe a pergunta."}, status=400)
        if len(opcoes) < 2:
            return Response({"opcoes": "Inclua ao menos duas opções."}, status=400)
        if len(opcoes) > 10:
            return Response({"opcoes": "No máximo 10 opções."}, status=400)

        prazo = None
        if request.data.get("prazo"):
            prazo = parse_datetime(request.data["prazo"])
            if prazo and timezone.is_naive(prazo):
                prazo = timezone.make_aware(prazo)

        with transaction.atomic():
            enquete = EnqueteGrupo.objects.create(
                grupo=grupo,
                criada_por=request.user,
                pergunta=pergunta,
                multipla_escolha=bool(request.data.get("multipla_escolha")),
                anonima=bool(request.data.get("anonima")),
                prazo=prazo,
            )
            EnqueteOpcao.objects.bulk_create(
                [EnqueteOpcao(enquete=enquete, texto=t, ordem=i) for i, t in enumerate(opcoes)]
            )
            msg = Mensagem.objects.create(grupo=grupo, autor=request.user, enquete=enquete)

        log_acao(request.user, "criar_enquete", "EnqueteGrupo", enquete.id)
        # Devolve a mensagem (com a enquete embutida) para o chat exibir de imediato.
        return Response(
            MensagemSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def votar(self, request, pk=None):
        enquete = self.get_object()
        if not self._membro(enquete.grupo):
            return Response({"detail": "Só membros do grupo votam."}, status=403)
        enquete.fechar_se_expirada()
        if enquete.esta_fechada:
            return Response({"detail": "Esta enquete está encerrada."}, status=400)

        ids = request.data.get("opcoes")
        if ids is None and request.data.get("opcao") is not None:
            ids = [request.data.get("opcao")]
        try:
            ids = [int(i) for i in (ids or [])]
        except (TypeError, ValueError):
            return Response({"opcoes": "Opções inválidas."}, status=400)

        validas = set(enquete.opcoes.values_list("id", flat=True))
        ids = [i for i in ids if i in validas]
        if not enquete.multipla_escolha and len(ids) > 1:
            return Response({"opcoes": "Escolha apenas uma opção."}, status=400)

        # Substitui os votos do usuário nesta enquete (permite trocar / desfazer).
        EnqueteVoto.objects.filter(opcao__enquete=enquete, usuario=request.user).delete()
        EnqueteVoto.objects.bulk_create(
            [EnqueteVoto(opcao_id=i, usuario=request.user) for i in ids]
        )
        enquete.refresh_from_db()
        return Response(EnqueteGrupoSerializer(enquete, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def encerrar(self, request, pk=None):
        enquete = self.get_object()
        pode = enquete.criada_por_id == request.user.id or roles.eh_lideranca_grupo(
            request.user, enquete.grupo
        )
        if not pode:
            return Response(
                {"detail": "Só quem criou ou a liderança do grupo encerra a enquete."},
                status=403,
            )
        enquete.encerrar()
        log_acao(request.user, "encerrar_enquete", "EnqueteGrupo", enquete.id)
        return Response(EnqueteGrupoSerializer(enquete, context={"request": request}).data)


# --------------------------------------------------------------------------- #
# Sala
# --------------------------------------------------------------------------- #
class SalaViewSet(viewsets.ModelViewSet):
    serializer_class = SalaSerializer
    filterset_fields = ["igreja", "ativo"]

    def get_queryset(self):
        return Sala.objects.select_related("igreja")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def _checar(self, igreja):
        if not roles.eh_lideranca_igreja(self.request.user, igreja):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Apenas a liderança da igreja gerencia salas.")

    def create(self, request, *args, **kwargs):
        """Criar sala afeta a igreja toda → vira PAUTA (governança)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        igreja = serializer.validated_data["igreja"]
        if not (roles.eh_membro(request.user, igreja) or roles.eh_lideranca_igreja(request.user, igreja)):
            return Response({"detail": "Você precisa ser membro da igreja."}, status=403)

        bypass = roles.is_super(request.user) and request.query_params.get("direto") == "1"
        if not bypass:
            d = serializer.validated_data
            pauta = _abrir_pauta_criacao(
                request.user, igreja, "criar_sala",
                f"Criar sala: {d.get('nome')}", "infraestrutura",
                {
                    "nome": d.get("nome", ""),
                    "capacidade": d.get("capacidade"),
                    "equipamentos": d.get("equipamentos", ""),
                },
            )
            return _resposta_pauta_aberta(pauta)

        sala = serializer.save()
        log_acao(request.user, "criar_sala", "Sala", sala.id, {"direto": True})
        return Response(self.get_serializer(sala).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        self._checar(serializer.instance.igreja)
        serializer.save()

    def perform_destroy(self, instance):
        self._checar(instance.igreja)
        instance.delete()

    @action(detail=True, methods=["get"])
    def disponibilidade(self, request, pk=None):
        """Conflitos da sala num intervalo + sugestões (próximo horário / salas livres)."""
        from django.utils.dateparse import parse_datetime

        sala = self.get_object()
        inicio = parse_datetime(request.query_params.get("inicio") or "")
        fim = parse_datetime(request.query_params.get("fim") or "")
        excluir = request.query_params.get("excluir")
        if not inicio or not fim:
            return Response({"detail": "Informe inicio e fim."}, status=400)
        if timezone.is_naive(inicio):
            inicio = timezone.make_aware(inicio)
        if timezone.is_naive(fim):
            fim = timezone.make_aware(fim)

        conf = Evento.objects.filter(
            sala=sala, status__in=[StatusEvento.PENDENTE, StatusEvento.APROVADO],
            inicio__lt=fim, fim__gt=inicio,
        ).select_related("grupo").order_by("inicio")
        if excluir:
            conf = conf.exclude(pk=excluir)
        conflitos = list(conf)

        conflitos_data = [
            {
                "evento_id": e.id, "titulo": e.titulo,
                "inicio": e.inicio.isoformat(), "fim": e.fim.isoformat(),
                "grupo": e.grupo.nome if e.grupo_id else None,
            }
            for e in conflitos
        ]

        sugestoes_sala = []
        proximo = None
        if conflitos:
            duracao = fim - inicio
            # Próximo horário livre: começa no fim do último conflito.
            fim_max = max(e.fim for e in conflitos)
            proximo = {"inicio": fim_max.isoformat(), "fim": (fim_max + duracao).isoformat()}
            # Salas alternativas livres no mesmo horário.
            for outra in Sala.objects.filter(igreja=sala.igreja, ativo=True).exclude(pk=sala.pk):
                livre = not Evento.objects.filter(
                    sala=outra, status__in=[StatusEvento.PENDENTE, StatusEvento.APROVADO],
                    inicio__lt=fim, fim__gt=inicio,
                ).exists()
                if livre:
                    sugestoes_sala.append({"id": outra.id, "nome": outra.nome})

        return Response({
            "disponivel": not conflitos,
            "conflitos": conflitos_data,
            "proximo_horario": proximo,
            "salas_alternativas": sugestoes_sala,
        })


# --------------------------------------------------------------------------- #
# Evento
# --------------------------------------------------------------------------- #
class EventoViewSet(viewsets.ModelViewSet):
    serializer_class = EventoSerializer
    filterset_fields = ["igreja", "grupo", "status", "visibilidade"]
    search_fields = ["titulo", "descricao"]
    ordering_fields = ["inicio", "criado_em"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "participantes", "ical"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Evento.objects.select_related(
            "igreja", "grupo", "sala", "criado_por", "criado_por__profile"
        ).prefetch_related("inscricoes")

        # Base pública: eventos aprovados e públicos.
        publico = Q(status=StatusEvento.APROVADO, visibilidade=VisibilidadeEvento.PUBLICO)

        if not user.is_authenticated:
            base = qs.filter(publico)
        elif roles.is_super(user):
            base = qs
        else:
            # Grupos onde o usuário é membro ativo (vê privados desses grupos).
            grupos_ids = GrupoMembro.objects.filter(
                usuario=user, status=StatusVinculo.ATIVO
            ).values_list("grupo_id", flat=True)
            # Igrejas que lidera (vê pendentes/rascunhos para aprovar).
            igrejas_lidera = roles.igrejas_que_lidera_ids(user)
            base = qs.filter(
                publico
                | Q(criado_por=user)
                | Q(grupo_id__in=list(grupos_ids), status=StatusEvento.APROVADO)
                | Q(igreja_id__in=igrejas_lidera)
            ).distinct()

        # Filtros de conveniência.
        params = self.request.query_params
        if params.get("proximos") in ("1", "true"):
            base = base.filter(fim__gte=timezone.now())
        de, ate = params.get("de"), params.get("ate")
        if de:
            base = base.filter(inicio__gte=de)
        if ate:
            base = base.filter(inicio__lte=ate)
        if params.get("minhas") in ("1", "true") and user.is_authenticated:
            base = base.filter(
                Q(criado_por=user) | Q(inscricoes__usuario=user)
            ).distinct()
        return base

    def perform_create(self, serializer):
        igreja = serializer.validated_data["igreja"]
        user = self.request.user
        if not (roles.eh_membro(user, igreja) or roles.eh_lideranca_igreja(user, igreja)):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Você precisa ser membro da igreja para criar eventos."
            )
        # Liderança aprova direto; demais entram na fila de aprovação.
        if roles.eh_lideranca_igreja(user, igreja):
            novo_status = StatusEvento.APROVADO
            aprovado_por = user
        else:
            novo_status = StatusEvento.PENDENTE
            aprovado_por = None
        evento = serializer.save(
            criado_por=user, status=novo_status, aprovado_por=aprovado_por
        )
        log_acao(user, "criar_evento", "Evento", evento.id, {"status": novo_status})
        if novo_status == StatusEvento.PENDENTE:
            for lider in Membro.objects.filter(
                igreja=igreja,
                status=StatusVinculo.ATIVO,
                papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN],
            ).select_related("usuario"):
                notificar(
                    lider.usuario,
                    "Evento aguardando aprovação",
                    f"“{evento.titulo}” precisa da sua aprovação.",
                    tipo="evento_pendente",
                    link=f"/aprovacoes",
                )

    def update(self, request, *args, **kwargs):
        evento = self.get_object()
        if not (evento.criado_por_id == request.user.id or roles.eh_lideranca_igreja(request.user, evento.igreja)):
            return Response({"detail": "Sem permissão."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        evento = self.get_object()
        if not (evento.criado_por_id == request.user.id or roles.eh_lideranca_igreja(request.user, evento.igreja)):
            return Response({"detail": "Sem permissão."}, status=403)
        return super().destroy(request, *args, **kwargs)

    # --- workflow de aprovação ---
    @action(detail=True, methods=["post"])
    def aprovar(self, request, pk=None):
        evento = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, evento.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        evento.status = StatusEvento.APROVADO
        evento.aprovado_por = request.user
        evento.motivo_rejeicao = ""
        evento.save(update_fields=["status", "aprovado_por", "motivo_rejeicao"])
        log_acao(request.user, "aprovar_evento", "Evento", evento.id)
        notificar(
            evento.criado_por,
            "Evento aprovado",
            f"“{evento.titulo}” foi aprovado.",
            tipo="evento_aprovado",
            link=f"/evento/{evento.id}",
        )
        return Response(EventoSerializer(evento, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def rejeitar(self, request, pk=None):
        evento = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, evento.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        evento.status = StatusEvento.REJEITADO
        evento.motivo_rejeicao = request.data.get("motivo", "")
        evento.save(update_fields=["status", "motivo_rejeicao"])
        log_acao(request.user, "rejeitar_evento", "Evento", evento.id)
        notificar(
            evento.criado_por,
            "Evento não aprovado",
            f"“{evento.titulo}”: {evento.motivo_rejeicao or 'sem motivo informado'}.",
            tipo="evento_rejeitado",
            link=f"/evento/{evento.id}",
        )
        return Response(EventoSerializer(evento, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def cancelar(self, request, pk=None):
        evento = self.get_object()
        if not (evento.criado_por_id == request.user.id or roles.eh_lideranca_igreja(request.user, evento.igreja)):
            return Response({"detail": "Sem permissão."}, status=403)
        evento.status = StatusEvento.CANCELADO
        evento.save(update_fields=["status"])
        log_acao(request.user, "cancelar_evento", "Evento", evento.id)
        return Response(EventoSerializer(evento, context={"request": request}).data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def pendentes(self, request):
        """Caixa de aprovação: eventos pendentes nas igrejas que o usuário lidera."""
        igrejas = roles.igrejas_que_lidera_ids(request.user)
        qs = Evento.objects.filter(
            igreja_id__in=igrejas, status=StatusEvento.PENDENTE
        ).select_related("igreja", "grupo", "criado_por", "criado_por__profile").order_by("inicio")
        return Response(
            EventoSerializer(qs, many=True, context={"request": request}).data
        )

    # --- RSVP ---
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def rsvp(self, request, pk=None):
        evento = self.get_object()
        novo = request.data.get("status", StatusInscricao.CONFIRMADO)
        if novo not in StatusInscricao.values:
            return Response({"status": "Status inválido."}, status=400)
        insc, _ = Inscricao.objects.update_or_create(
            usuario=request.user, evento=evento, defaults={"status": novo}
        )
        log_acao(request.user, "rsvp", "Evento", evento.id, {"status": novo})
        return Response(InscricaoSerializer(insc, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def participantes(self, request, pk=None):
        evento = self.get_object()
        qs = Inscricao.objects.filter(
            evento=evento, status=StatusInscricao.CONFIRMADO
        ).select_related("usuario", "usuario__profile")
        return Response(
            InscricaoSerializer(qs, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def foto(self, request, pk=None):
        evento = self.get_object()
        if not (
            evento.criado_por_id == request.user.id
            or roles.eh_lideranca_igreja(request.user, evento.igreja)
        ):
            return Response({"detail": "Sem permissão."}, status=403)
        ok, erro = _salvar_foto(evento, request)
        if not ok:
            return Response({"foto": erro}, status=400)
        return Response(EventoSerializer(evento, context={"request": request}).data)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def ical(self, request, pk=None):
        """Exporta o evento como .ics (para o Google Agenda / calendário do celular)."""
        evento = self.get_object()  # respeita a visibilidade do get_queryset

        def fmt(dt):
            return dt.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        def esc(txt):
            return (
                (txt or "")
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n")
            )

        local = ", ".join(
            p for p in [evento.sala.nome if evento.sala else "", evento.igreja.nome] if p
        )
        linhas = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//IASD Gestao//PT-BR//",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            f"UID:evento-{evento.id}@iasd-gestao",
            f"DTSTAMP:{fmt(timezone.now())}",
            f"DTSTART:{fmt(evento.inicio)}",
            f"DTEND:{fmt(evento.fim)}",
            f"SUMMARY:{esc(evento.titulo)}",
            f"DESCRIPTION:{esc(evento.descricao)}",
            f"LOCATION:{esc(local)}",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
        conteudo = "\r\n".join(linhas) + "\r\n"
        resp = HttpResponse(conteudo, content_type="text/calendar; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="evento-{evento.id}.ics"'
        return resp


# --------------------------------------------------------------------------- #
# Pauta + Voto (deliberação dos anciões)
# --------------------------------------------------------------------------- #
class PautaViewSet(viewsets.ModelViewSet):
    serializer_class = PautaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["igreja", "status"]

    def get_queryset(self):
        user = self.request.user
        base = Pauta.objects.select_related("igreja", "criada_por").prefetch_related("votos")
        if not user.is_authenticated:
            return base.none()
        if roles.is_super(user):
            qs = base
        else:
            # Liderança vê as pautas das igrejas que lidera; o proponente vê as suas
            # (mesmo não sendo ancião) para acompanhar o andamento.
            igrejas = roles.igrejas_que_lidera_ids(user)
            qs = base.filter(Q(igreja_id__in=igrejas) | Q(criada_por=user)).distinct()
        if self.request.query_params.get("proponente_me") == "true":
            qs = qs.filter(criada_por=user)
        return qs

    def perform_create(self, serializer):
        igreja = serializer.validated_data["igreja"]
        # Qualquer membro ativo pode PROPOR (vira pauta); só anciões votam.
        if not (
            roles.eh_membro(self.request.user, igreja)
            or roles.eh_lideranca_igreja(self.request.user, igreja)
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Você precisa ser membro da igreja para propor pautas.")
        pauta = serializer.save(criada_por=self.request.user)
        log_acao(self.request.user, "criar_pauta", "Pauta", pauta.id, {"tipo": pauta.tipo})
        # Confirma ao proponente.
        notificar(
            self.request.user,
            "Proposta enviada para votação",
            f"“{pauta.titulo}” foi enviada ao Canal dos Anciões. Acompanhe o andamento.",
            tipo="pauta_proposta", link=f"/pauta/{pauta.id}",
        )
        # Notifica os anciões/liderança da igreja sobre a nova pauta.
        for lider in Membro.objects.filter(
            igreja=igreja,
            status=StatusVinculo.ATIVO,
            papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN],
        ).exclude(usuario=self.request.user).select_related("usuario"):
            notificar(
                lider.usuario,
                "📜 Nova pauta para votar",
                f"“{pauta.titulo}” aguarda seu voto no Canal dos Anciões.",
                tipo="pauta_nova",
                link=f"/igreja/{igreja.id}/canal",
            )

    def update(self, request, *args, **kwargs):
        pauta = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, pauta.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def votar(self, request, pk=None):
        pauta = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, pauta.igreja):
            return Response(
                {"detail": "Apenas a liderança vota nas pautas."}, status=403
            )
        if pauta.status == StatusPauta.ENCERRADA or pauta.expirada:
            return Response({"detail": "Votação encerrada."}, status=400)
        opcao = request.data.get("opcao")
        # Enquete com opções customizadas valida contra elas; senão, sim/não/abstenção.
        validas = (
            pauta.opcoes
            if (pauta.tipo == "enquete_livre" and pauta.opcoes)
            else OpcaoVoto.values
        )
        if opcao not in validas:
            return Response({"opcao": "Opção inválida."}, status=400)
        comentario = request.data.get("comentario", "") if pauta.permitir_justificativa else ""
        voto, _ = Voto.objects.update_or_create(
            pauta=pauta,
            usuario=request.user,
            defaults={"opcao": opcao, "comentario": comentario},
        )
        log_acao(request.user, "votar", "Pauta", pauta.id)
        return Response(VotoSerializer(voto, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def encerrar(self, request, pk=None):
        pauta = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, pauta.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        pauta.encerrar_agora()
        log_acao(request.user, "encerrar_pauta", "Pauta", pauta.id)
        return Response(PautaSerializer(pauta, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def votos(self, request, pk=None):
        pauta = self.get_object()
        # Liderança ou o proponente (transparência da governança).
        if not (
            roles.eh_lideranca_igreja(request.user, pauta.igreja)
            or pauta.criada_por_id == request.user.id
        ):
            return Response({"detail": "Sem permissão."}, status=403)
        # Em pauta anônima aberta, não revela os votos (nem contagem). Só após encerrar.
        if pauta.anonima and pauta.status == StatusPauta.ABERTA:
            return Response([])
        qs = pauta.votos.select_related("usuario", "usuario__profile")
        return Response(VotoSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def aplicar(self, request, pk=None):
        """Aplica manualmente uma pauta aprovada (caso a automática tenha falhado)."""
        pauta = self.get_object()
        if not roles.eh_admin_igreja(request.user, pauta.igreja):
            return Response({"detail": "Apenas o administrador da igreja."}, status=403)
        if pauta.decisao != "aprovado":
            return Response({"detail": "A pauta não foi aprovada."}, status=400)
        pauta.aplicar()
        log_acao(request.user, "aplicar_pauta", "Pauta", pauta.id)
        return Response(PautaSerializer(pauta, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        """Cancela a pauta — só o criador e somente antes de qualquer voto."""
        pauta = self.get_object()
        if pauta.criada_por_id != request.user.id:
            return Response({"detail": "Apenas quem criou pode cancelar."}, status=403)
        if pauta.votos.exists():
            return Response({"detail": "Já há votos; não é possível cancelar."}, status=400)
        log_acao(request.user, "cancelar_pauta", "Pauta", pauta.id)
        pauta.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def minhas(self, request):
        """Pautas que o usuário propôs (acompanhamento do proponente)."""
        qs = self.get_queryset().filter(criada_por=request.user).order_by("-criado_em")
        page = self.paginate_queryset(qs)
        ser = PautaSerializer(page if page is not None else qs, many=True, context={"request": request})
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


# --------------------------------------------------------------------------- #
# Fórum de pauta (discussão + anexos)
# --------------------------------------------------------------------------- #
class PautaComentarioViewSet(viewsets.ModelViewSet):
    serializer_class = PautaComentarioSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["pauta"]

    def _pode_acessar(self, pauta):
        u = self.request.user
        return bool(pauta) and (
            roles.eh_lideranca_igreja(u, pauta.igreja)
            or pauta.criada_por_id == u.id
            or roles.is_super(u)
        )

    def get_queryset(self):
        user = self.request.user
        qs = (
            PautaComentario.objects.filter(deletado_em__isnull=True)
            .select_related("autor", "autor__profile", "pauta", "pauta__igreja")
            .prefetch_related("anexos")
        )
        if not roles.is_super(user):
            igrejas = roles.igrejas_que_lidera_ids(user)
            qs = qs.filter(Q(pauta__igreja_id__in=igrejas) | Q(pauta__criada_por=user))
        return qs

    def create(self, request, *args, **kwargs):
        pauta = Pauta.objects.filter(pk=request.data.get("pauta")).select_related("igreja").first()
        if not self._pode_acessar(pauta):
            return Response({"detail": "Sem permissão para comentar."}, status=403)
        texto = (request.data.get("texto") or "").strip()
        arquivos = request.FILES.getlist("anexos")
        if not texto and not arquivos:
            return Response({"texto": "Escreva algo ou anexe um arquivo."}, status=400)
        if len(arquivos) > 5:
            return Response({"anexos": "Máximo de 5 anexos por comentário."}, status=400)
        for a in arquivos:
            ok, erro = _validar_anexo(a)
            if not ok:
                return Response({"anexos": erro}, status=400)

        coment = PautaComentario.objects.create(pauta=pauta, autor=request.user, texto=texto)
        for a in arquivos:
            PautaAnexo.objects.create(
                pauta=pauta, comentario=coment, autor=request.user, arquivo=a,
                tipo_mime=getattr(a, "content_type", ""), tamanho_bytes=a.size,
                nome_original=a.name[:255],
            )
        # Notifica anciões + proponente (exceto o autor).
        destinatarios = set(
            Membro.objects.filter(
                igreja=pauta.igreja, status=StatusVinculo.ATIVO,
                papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN],
            ).values_list("usuario_id", flat=True)
        )
        if pauta.criada_por_id:
            destinatarios.add(pauta.criada_por_id)
        destinatarios.discard(request.user.id)
        for uid in destinatarios:
            notificar(
                User.objects.filter(pk=uid).first(),
                "💬 Novo comentário na pauta",
                f"{request.user.get_full_name() or request.user.username} comentou em “{pauta.titulo}”.",
                tipo="pauta_comentario", link=f"/pauta/{pauta.id}",
            )
        return Response(
            PautaComentarioSerializer(coment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        coment = self.get_object()
        if coment.autor_id != request.user.id:
            return Response({"detail": "Só o autor edita."}, status=403)
        coment.texto = (request.data.get("texto") or coment.texto).strip()
        coment.editado_em = timezone.now()
        coment.save(update_fields=["texto", "editado_em"])
        return Response(PautaComentarioSerializer(coment, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        coment = self.get_object()
        if coment.autor_id != request.user.id and not roles.eh_admin_igreja(request.user, coment.pauta.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        coment.deletado_em = timezone.now()
        coment.save(update_fields=["deletado_em"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Notificações
# --------------------------------------------------------------------------- #
class NotificacaoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificacaoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notificacao.objects.filter(usuario=self.request.user)

    @action(detail=True, methods=["post"])
    def ler(self, request, pk=None):
        notif = self.get_object()
        notif.lida = True
        notif.save(update_fields=["lida"])
        return Response(NotificacaoSerializer(notif).data)

    @action(detail=False, methods=["post"])
    def ler_todas(self, request):
        Notificacao.objects.filter(usuario=request.user, lida=False).update(lida=True)
        return Response({"detail": "Todas marcadas como lidas."})

    @action(detail=False, methods=["get"])
    def nao_lidas(self, request):
        total = Notificacao.objects.filter(usuario=request.user, lida=False).count()
        return Response({"total": total})


# --------------------------------------------------------------------------- #
# Auditoria (super admin)
# --------------------------------------------------------------------------- #
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["entidade", "acao"]

    def get_queryset(self):
        return AuditLog.objects.select_related("usuario", "usuario__profile")


# --------------------------------------------------------------------------- #
# Calendário consolidado (com expansão de recorrências)
# --------------------------------------------------------------------------- #
class CalendarioView(APIView):
    permission_classes = [AllowAny]

    LIMITE_OCORRENCIAS = 60

    def get(self, request):
        de = request.query_params.get("de")
        ate = request.query_params.get("ate")
        agora = timezone.now()
        inicio_janela = de or (agora - timedelta(days=1)).isoformat()
        fim_janela = ate or (agora + timedelta(days=90)).isoformat()

        user = request.user
        base = Evento.objects.filter(status=StatusEvento.APROVADO).select_related(
            "igreja", "grupo", "sala", "criado_por", "criado_por__profile"
        ).prefetch_related("inscricoes")

        if not user.is_authenticated:
            # Visitante: programação pública de todas as igrejas.
            qs = base.filter(visibilidade=VisibilidadeEvento.PUBLICO)
        else:
            # Calendário consolidado e CURADO: igrejas onde é membro + que segue
            # (+ próximas, se pedir). Evita poluir com todas as igrejas do sistema.
            membro_ids = set(
                Membro.objects.filter(usuario=user, status=StatusVinculo.ATIVO).values_list("igreja_id", flat=True)
            )
            seguidas_ids = set(
                IgrejaSeguidor.objects.filter(usuario=user).values_list("igreja_id", flat=True)
            )
            relevantes = membro_ids | seguidas_ids

            if request.query_params.get("proximas") == "1":
                prof = getattr(user, "profile", None)
                if prof and prof.latitude is not None and prof.longitude is not None:
                    for ig in Igreja.objects.filter(ativo=True).exclude(id__in=relevantes):
                        if ig.latitude is None:
                            continue
                        d = haversine_km(prof.latitude, prof.longitude, ig.latitude, ig.longitude)
                        if d is not None and d <= 50:
                            relevantes.add(ig.id)

            grupos_ids = list(
                GrupoMembro.objects.filter(usuario=user, status=StatusVinculo.ATIVO).values_list("grupo_id", flat=True)
            )
            qs = base.filter(
                Q(igreja_id__in=relevantes, visibilidade=VisibilidadeEvento.PUBLICO)
                | Q(grupo_id__in=grupos_ids)
                | Q(criado_por=user)
            ).distinct()

        if request.query_params.get("igreja"):
            qs = qs.filter(igreja_id=request.query_params["igreja"])
        if request.query_params.get("grupo"):
            qs = qs.filter(grupo_id=request.query_params["grupo"])

        ocorrencias = []
        for ev in qs:
            ocorrencias.extend(
                self._expandir(ev, inicio_janela, fim_janela, request)
            )
        ocorrencias.sort(key=lambda o: o["inicio"])
        return Response(ocorrencias)

    def _expandir(self, ev, de, ate, request):
        base = EventoSerializer(ev, context={"request": request}).data
        from django.utils.dateparse import parse_datetime

        de_dt = parse_datetime(de)
        ate_dt = parse_datetime(ate)
        if de_dt and timezone.is_naive(de_dt):
            de_dt = timezone.make_aware(de_dt)
        if ate_dt and timezone.is_naive(ate_dt):
            ate_dt = timezone.make_aware(ate_dt)

        duracao = ev.fim - ev.inicio
        if ev.recorrencia == Recorrencia.NENHUMA:
            return [self._ocorrencia(base, ev.inicio, ev.fim)]

        passo = {
            Recorrencia.DIARIA: timedelta(days=1),
            Recorrencia.SEMANAL: timedelta(weeks=1),
        }.get(ev.recorrencia)

        def avancar(cursor):
            # Mensal: mesma "Nth weekday" do mês (ex.: 2ª terça); demais: passo fixo.
            if ev.recorrencia == Recorrencia.MENSAL:
                return proximo_mensal(cursor)
            return cursor + passo

        limite_fim = ate_dt
        if ev.recorrencia_ate:
            fim_recorr = timezone.make_aware(
                timezone.datetime.combine(ev.recorrencia_ate, timezone.datetime.min.time())
            )
            if limite_fim is None or fim_recorr < limite_fim:
                limite_fim = fim_recorr

        ocorrencias = []
        cursor = ev.inicio
        n = 0
        while n < self.LIMITE_OCORRENCIAS and cursor is not None:
            if limite_fim and cursor > limite_fim:
                break
            if de_dt is None or (cursor + duracao) >= de_dt:
                ocorrencias.append(self._ocorrencia(base, cursor, cursor + duracao))
            cursor = avancar(cursor)
            n += 1
            if cursor and ate_dt and cursor > ate_dt:
                break
        return ocorrencias

    @staticmethod
    def _ocorrencia(base, inicio, fim):
        item = dict(base)
        item["inicio"] = inicio.isoformat()
        item["fim"] = fim.isoformat()
        return item


# --------------------------------------------------------------------------- #
# Dashboard (agregador para a tela inicial)
# --------------------------------------------------------------------------- #
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user
    agora = timezone.now()
    profile = user.profile

    # Próximos eventos da igreja principal (ou de todas as minhas igrejas).
    minhas_igrejas = list(
        Membro.objects.filter(usuario=user, status=StatusVinculo.ATIVO).values_list(
            "igreja_id", flat=True
        )
    )
    eventos_minha_igreja = (
        Evento.objects.filter(
            igreja_id__in=minhas_igrejas or [0],
            status=StatusEvento.APROVADO,
            fim__gte=agora,
        )
        .select_related("igreja", "grupo")
        .order_by("inicio")[:8]
    )

    # Eventos próximos em outras igrejas (por distância, se houver geo).
    outras = (
        Evento.objects.filter(status=StatusEvento.APROVADO, fim__gte=agora)
        .exclude(igreja_id__in=minhas_igrejas)
        .filter(visibilidade=VisibilidadeEvento.PUBLICO)
        .select_related("igreja", "grupo")
        .order_by("inicio")[:30]
    )
    outras_list = list(outras)
    if profile.latitude is not None and profile.longitude is not None:
        for ev in outras_list:
            ev.igreja.distancia_km = (
                haversine_km(
                    profile.latitude,
                    profile.longitude,
                    ev.igreja.latitude,
                    ev.igreja.longitude,
                )
                if ev.igreja.latitude is not None
                else None
            )
        outras_list.sort(
            key=lambda e: (
                getattr(e.igreja, "distancia_km", None) is None,
                getattr(e.igreja, "distancia_km", None) or 0,
            )
        )
    outras_list = outras_list[:8]

    # Pendências de aprovação (liderança).
    igrejas_lidera = roles.igrejas_que_lidera_ids(user)
    eventos_pendentes = Evento.objects.filter(
        igreja_id__in=igrejas_lidera, status=StatusEvento.PENDENTE
    ).count()
    membros_pendentes = Membro.objects.filter(
        igreja_id__in=igrejas_lidera, status=StatusVinculo.PENDENTE
    ).count()
    pautas_abertas = Pauta.objects.filter(
        igreja_id__in=igrejas_lidera, status=StatusPauta.ABERTA
    ).count()
    # Pautas abertas que o usuário ainda não votou (aguardando seu voto).
    pautas_aguardando = (
        Pauta.objects.filter(igreja_id__in=igrejas_lidera, status=StatusPauta.ABERTA)
        .exclude(votos__usuario=user)
        .select_related("igreja", "criada_por")
        .prefetch_related("votos")
        .order_by("-criado_em")[:10]
    )

    ctx = {"request": request}
    return Response(
        {
            "eventos_minha_igreja": EventoSerializer(
                eventos_minha_igreja, many=True, context=ctx
            ).data,
            "eventos_proximos": EventoSerializer(
                outras_list, many=True, context=ctx
            ).data,
            "pendencias": {
                "eventos": eventos_pendentes,
                "membros": membros_pendentes,
                "pautas_abertas": pautas_abertas,
            },
            "pautas_aguardando": PautaSerializer(
                pautas_aguardando, many=True, context=ctx
            ).data,
            "sou_lideranca": len(igrejas_lidera) > 0,
        }
    )
