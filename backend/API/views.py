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
    Evento,
    Grupo,
    GrupoMembro,
    Igreja,
    Inscricao,
    Membro,
    Mensagem,
    Notificacao,
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
from .permissions import IsSuperAdmin
from .serializers import (
    AuditLogSerializer,
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
        return roles.eh_lideranca_igreja(self.request.user, igreja)

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
        membro.save(update_fields=["status"])
        log_acao(request.user, "rejeitar_membro", "Membro", membro.id)
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

    def perform_create(self, serializer):
        igreja = serializer.validated_data["igreja"]
        if not roles.eh_lideranca_igreja(self.request.user, igreja):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Apenas a liderança da igreja pode criar grupos.")
        grupo = serializer.save()
        # Quem cria já entra como diretor ativo.
        GrupoMembro.objects.create(
            usuario=self.request.user,
            grupo=grupo,
            cargo=CargoGrupo.DIRETOR,
            status=StatusVinculo.ATIVO,
        )
        log_acao(self.request.user, "criar_grupo", "Grupo", grupo.id)

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
            "autor", "autor__profile"
        )
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
        gm.save(update_fields=["status"])
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

    def perform_create(self, serializer):
        self._checar(serializer.validated_data["igreja"])
        sala = serializer.save()
        log_acao(self.request.user, "criar_sala", "Sala", sala.id)

    def perform_update(self, serializer):
        self._checar(serializer.instance.igreja)
        serializer.save()

    def perform_destroy(self, instance):
        self._checar(instance.igreja)
        instance.delete()


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
        if roles.is_super(user):
            return Pauta.objects.select_related("igreja", "criada_por").prefetch_related("votos")
        igrejas = roles.igrejas_que_lidera_ids(user)
        return (
            Pauta.objects.filter(igreja_id__in=igrejas)
            .select_related("igreja", "criada_por")
            .prefetch_related("votos")
        )

    def perform_create(self, serializer):
        igreja = serializer.validated_data["igreja"]
        if not roles.eh_lideranca_igreja(self.request.user, igreja):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Apenas anciões/liderança criam pautas.")
        pauta = serializer.save(criada_por=self.request.user)
        log_acao(self.request.user, "criar_pauta", "Pauta", pauta.id)

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
        if opcao not in OpcaoVoto.values:
            return Response({"opcao": "Opção inválida."}, status=400)
        voto, _ = Voto.objects.update_or_create(
            pauta=pauta,
            usuario=request.user,
            defaults={
                "opcao": opcao,
                "comentario": request.data.get("comentario", ""),
            },
        )
        log_acao(request.user, "votar", "Pauta", pauta.id)
        return Response(VotoSerializer(voto, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def encerrar(self, request, pk=None):
        pauta = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, pauta.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        pauta.status = StatusPauta.ENCERRADA
        pauta.save(update_fields=["status"])
        log_acao(request.user, "encerrar_pauta", "Pauta", pauta.id)
        return Response(PautaSerializer(pauta, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def votos(self, request, pk=None):
        pauta = self.get_object()
        if not roles.eh_lideranca_igreja(request.user, pauta.igreja):
            return Response({"detail": "Sem permissão."}, status=403)
        qs = pauta.votos.select_related("usuario", "usuario__profile")
        return Response(VotoSerializer(qs, many=True, context={"request": request}).data)


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

        # Reusa a lógica de visibilidade do EventoViewSet.
        vs = EventoViewSet()
        vs.request = request
        vs.action = "list"
        vs.format_kwarg = None
        qs = vs.get_queryset().filter(status=StatusEvento.APROVADO)

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
            "sou_lideranca": len(igrejas_lidera) > 0,
        }
    )
