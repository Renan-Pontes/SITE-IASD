"""Serializers do DRF — IASD Gestão."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError
from rest_framework import serializers

from . import roles
from .models import (
    AuditLog,
    Evento,
    Grupo,
    GrupoMembro,
    Igreja,
    Inscricao,
    Membro,
    Mensagem,
    Notificacao,
    OpcaoVoto,
    Pauta,
    Profile,
    Sala,
    StatusInscricao,
    StatusVinculo,
    Voto,
)

User = get_user_model()


# --------------------------------------------------------------------------- #
# Usuário / Perfil / Auth
# --------------------------------------------------------------------------- #
class UsuarioMiniSerializer(serializers.ModelSerializer):
    """Representação enxuta para exibir autores, participantes, etc."""

    nome = serializers.SerializerMethodField()
    foto = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "nome", "foto"]

    def get_nome(self, obj):
        return obj.get_full_name() or obj.username

    def get_foto(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.foto:
            return profile.foto.url
        return None


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    nome = serializers.SerializerMethodField()
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    igreja_principal_nome = serializers.CharField(
        source="igreja_principal.nome", read_only=True
    )
    is_super_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "email",
            "nome",
            "first_name",
            "last_name",
            "telefone",
            "foto",
            "bio",
            "igreja_principal",
            "igreja_principal_nome",
            "latitude",
            "longitude",
            "is_super_admin",
            "fonte_grande",
            "notificacoes_email",
        ]
        read_only_fields = ["foto"]

    def get_nome(self, obj):
        return obj.nome

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr in ("first_name", "last_name"):
            if attr in user_data:
                setattr(instance.user, attr, user_data[attr])
        if user_data:
            instance.user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)


class MeSerializer(serializers.Serializer):
    """Payload do /auth/me: perfil + papéis para o frontend montar a navegação."""

    profile = ProfileSerializer()
    vinculos_igreja = serializers.SerializerMethodField()
    vinculos_grupo = serializers.SerializerMethodField()
    is_super_admin = serializers.SerializerMethodField()

    def get_is_super_admin(self, obj):
        return roles.is_super(obj["user"])

    def get_vinculos_igreja(self, obj):
        qs = Membro.objects.filter(usuario=obj["user"]).select_related("igreja")
        return [
            {
                "igreja": m.igreja_id,
                "igreja_nome": m.igreja.nome,
                "papel": m.papel,
                "status": m.status,
                "eh_lideranca": m.eh_lideranca,
            }
            for m in qs
        ]

    def get_vinculos_grupo(self, obj):
        qs = GrupoMembro.objects.filter(usuario=obj["user"]).select_related("grupo")
        return [
            {
                "grupo": g.grupo_id,
                "grupo_nome": g.grupo.nome,
                "igreja": g.grupo.igreja_id,
                "cargo": g.cargo,
                "status": g.status,
                "eh_lideranca": g.eh_lideranca,
            }
            for g in qs
        ]


class RegisterSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    telefone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Já existe uma conta com este e-mail.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        nome = validated_data["nome"].strip()
        partes = nome.split(" ", 1)
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=partes[0],
            last_name=partes[1] if len(partes) > 1 else "",
        )
        if validated_data.get("telefone"):
            user.profile.telefone = validated_data["telefone"]
            user.profile.save(update_fields=["telefone"])
        return user


# --------------------------------------------------------------------------- #
# Igreja
# --------------------------------------------------------------------------- #
class IgrejaSerializer(serializers.ModelSerializer):
    total_membros = serializers.SerializerMethodField()
    distancia_km = serializers.SerializerMethodField()
    meu_status = serializers.SerializerMethodField()
    meu_papel = serializers.SerializerMethodField()

    class Meta:
        model = Igreja
        fields = [
            "id",
            "nome",
            "slug",
            "descricao",
            "endereco",
            "cidade",
            "estado",
            "cep",
            "latitude",
            "longitude",
            "telefone",
            "email",
            "foto",
            "ativo",
            "total_membros",
            "distancia_km",
            "meu_status",
            "meu_papel",
            "criado_em",
        ]
        read_only_fields = ["slug", "foto", "criado_em"]

    def get_total_membros(self, obj):
        if hasattr(obj, "total_membros_anot"):
            return obj.total_membros_anot
        return obj.membros.filter(status=StatusVinculo.ATIVO).count()

    def get_distancia_km(self, obj):
        valor = getattr(obj, "distancia_km", None)
        return round(valor, 1) if valor is not None else None

    def _meu_vinculo(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        cache = self.context.setdefault("_vinculos_cache", {})
        if request.user.id not in cache:
            cache[request.user.id] = {
                m.igreja_id: m
                for m in Membro.objects.filter(usuario=request.user)
            }
        return cache[request.user.id].get(obj.id)

    def get_meu_status(self, obj):
        m = self._meu_vinculo(obj)
        return m.status if m else None

    def get_meu_papel(self, obj):
        m = self._meu_vinculo(obj)
        return m.papel if m else None


# --------------------------------------------------------------------------- #
# Membro
# --------------------------------------------------------------------------- #
class MembroSerializer(serializers.ModelSerializer):
    usuario_detalhe = UsuarioMiniSerializer(source="usuario", read_only=True)
    igreja_nome = serializers.CharField(source="igreja.nome", read_only=True)

    class Meta:
        model = Membro
        fields = [
            "id",
            "usuario",
            "usuario_detalhe",
            "igreja",
            "igreja_nome",
            "papel",
            "status",
            "data_entrada",
        ]
        read_only_fields = ["usuario", "data_entrada"]


# --------------------------------------------------------------------------- #
# Grupo
# --------------------------------------------------------------------------- #
class GrupoSerializer(serializers.ModelSerializer):
    igreja_nome = serializers.CharField(source="igreja.nome", read_only=True)
    total_membros = serializers.SerializerMethodField()
    meu_status = serializers.SerializerMethodField()
    meu_cargo = serializers.SerializerMethodField()

    class Meta:
        model = Grupo
        fields = [
            "id",
            "nome",
            "slug",
            "descricao",
            "tipo",
            "igreja",
            "igreja_nome",
            "foto",
            "ativo",
            "total_membros",
            "meu_status",
            "meu_cargo",
            "criado_em",
        ]
        read_only_fields = ["slug", "foto", "criado_em"]

    def get_total_membros(self, obj):
        return obj.membros.filter(status=StatusVinculo.ATIVO).count()

    def _meu_vinculo(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        cache = self.context.setdefault("_grupo_vinculos_cache", {})
        if request.user.id not in cache:
            cache[request.user.id] = {
                g.grupo_id: g
                for g in GrupoMembro.objects.filter(usuario=request.user)
            }
        return cache[request.user.id].get(obj.id)

    def get_meu_status(self, obj):
        g = self._meu_vinculo(obj)
        return g.status if g else None

    def get_meu_cargo(self, obj):
        g = self._meu_vinculo(obj)
        return g.cargo if g else None


class GrupoMembroSerializer(serializers.ModelSerializer):
    usuario_detalhe = UsuarioMiniSerializer(source="usuario", read_only=True)
    grupo_nome = serializers.CharField(source="grupo.nome", read_only=True)

    class Meta:
        model = GrupoMembro
        fields = [
            "id",
            "usuario",
            "usuario_detalhe",
            "grupo",
            "grupo_nome",
            "cargo",
            "status",
            "data_entrada",
        ]
        read_only_fields = ["usuario", "data_entrada"]


# --------------------------------------------------------------------------- #
# Sala
# --------------------------------------------------------------------------- #
class SalaSerializer(serializers.ModelSerializer):
    igreja_nome = serializers.CharField(source="igreja.nome", read_only=True)

    class Meta:
        model = Sala
        fields = [
            "id",
            "nome",
            "igreja",
            "igreja_nome",
            "capacidade",
            "equipamentos",
            "ativo",
        ]


# --------------------------------------------------------------------------- #
# Evento + Inscrição
# --------------------------------------------------------------------------- #
class EventoSerializer(serializers.ModelSerializer):
    igreja_nome = serializers.CharField(source="igreja.nome", read_only=True)
    grupo_nome = serializers.CharField(source="grupo.nome", read_only=True)
    sala_nome = serializers.CharField(source="sala.nome", read_only=True)
    criado_por_detalhe = UsuarioMiniSerializer(source="criado_por", read_only=True)
    total_confirmados = serializers.SerializerMethodField()
    meu_rsvp = serializers.SerializerMethodField()
    posso_aprovar = serializers.SerializerMethodField()

    class Meta:
        model = Evento
        fields = [
            "id",
            "titulo",
            "descricao",
            "igreja",
            "igreja_nome",
            "grupo",
            "grupo_nome",
            "sala",
            "sala_nome",
            "inicio",
            "fim",
            "visibilidade",
            "status",
            "recorrencia",
            "recorrencia_ate",
            "foto",
            "criado_por",
            "criado_por_detalhe",
            "aprovado_por",
            "motivo_rejeicao",
            "total_confirmados",
            "meu_rsvp",
            "posso_aprovar",
            "criado_em",
        ]
        read_only_fields = [
            "status",
            "foto",
            "criado_por",
            "aprovado_por",
            "motivo_rejeicao",
            "criado_em",
        ]

    def validate(self, attrs):
        inicio = attrs.get("inicio", getattr(self.instance, "inicio", None))
        fim = attrs.get("fim", getattr(self.instance, "fim", None))
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError(
                {"fim": "O término não pode ser antes do início."}
            )
        return attrs

    def get_total_confirmados(self, obj):
        if hasattr(obj, "total_confirmados_anot"):
            return obj.total_confirmados_anot
        return obj.inscricoes.filter(status=StatusInscricao.CONFIRMADO).count()

    def get_meu_rsvp(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        insc = next(
            (i for i in obj.inscricoes.all() if i.usuario_id == request.user.id), None
        )
        if insc is None:
            insc = Inscricao.objects.filter(
                evento=obj, usuario=request.user
            ).first()
        return insc.status if insc else None

    def get_posso_aprovar(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return roles.eh_lideranca_igreja(request.user, obj.igreja)


class InscricaoSerializer(serializers.ModelSerializer):
    usuario_detalhe = UsuarioMiniSerializer(source="usuario", read_only=True)
    evento_titulo = serializers.CharField(source="evento.titulo", read_only=True)

    class Meta:
        model = Inscricao
        fields = [
            "id",
            "usuario",
            "usuario_detalhe",
            "evento",
            "evento_titulo",
            "status",
            "criado_em",
        ]
        read_only_fields = ["usuario", "criado_em"]


# --------------------------------------------------------------------------- #
# Pauta + Voto
# --------------------------------------------------------------------------- #
class PautaSerializer(serializers.ModelSerializer):
    igreja_nome = serializers.CharField(source="igreja.nome", read_only=True)
    criada_por_detalhe = UsuarioMiniSerializer(source="criada_por", read_only=True)
    resultado = serializers.SerializerMethodField()
    meu_voto = serializers.SerializerMethodField()
    total_votos = serializers.SerializerMethodField()
    expirada = serializers.BooleanField(read_only=True)

    class Meta:
        model = Pauta
        fields = [
            "id",
            "titulo",
            "descricao",
            "igreja",
            "igreja_nome",
            "criada_por",
            "criada_por_detalhe",
            "anonima",
            "prazo_votacao",
            "status",
            "resultado",
            "meu_voto",
            "total_votos",
            "expirada",
            "criado_em",
        ]
        read_only_fields = ["criada_por", "status", "criado_em"]

    def get_resultado(self, obj):
        contagem = {OpcaoVoto.SIM: 0, OpcaoVoto.NAO: 0, OpcaoVoto.ABSTENCAO: 0}
        for v in obj.votos.all():
            contagem[v.opcao] = contagem.get(v.opcao, 0) + 1
        return {
            "sim": contagem.get(OpcaoVoto.SIM, 0),
            "nao": contagem.get(OpcaoVoto.NAO, 0),
            "abstencao": contagem.get(OpcaoVoto.ABSTENCAO, 0),
        }

    def get_total_votos(self, obj):
        return obj.votos.count()

    def get_meu_voto(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        v = next(
            (x for x in obj.votos.all() if x.usuario_id == request.user.id), None
        )
        if v is None:
            v = Voto.objects.filter(pauta=obj, usuario=request.user).first()
        return v.opcao if v else None


class VotoSerializer(serializers.ModelSerializer):
    """Respeita anonimato: oculta o autor quando a pauta é anônima."""

    usuario_detalhe = serializers.SerializerMethodField()

    class Meta:
        model = Voto
        fields = [
            "id",
            "pauta",
            "opcao",
            "comentario",
            "usuario_detalhe",
            "criado_em",
        ]
        read_only_fields = ["criado_em"]

    def get_usuario_detalhe(self, obj):
        if obj.pauta.anonima:
            return None
        return UsuarioMiniSerializer(obj.usuario, context=self.context).data


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #
class MensagemSerializer(serializers.ModelSerializer):
    autor_detalhe = UsuarioMiniSerializer(source="autor", read_only=True)

    class Meta:
        model = Mensagem
        fields = [
            "id",
            "grupo",
            "autor",
            "autor_detalhe",
            "conteudo",
            "anexo",
            "criado_em",
        ]
        read_only_fields = ["autor", "anexo", "criado_em"]


# --------------------------------------------------------------------------- #
# Notificação
# --------------------------------------------------------------------------- #
class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        fields = [
            "id",
            "tipo",
            "titulo",
            "mensagem",
            "link",
            "lida",
            "criado_em",
        ]
        read_only_fields = ["tipo", "titulo", "mensagem", "link", "criado_em"]


class AuditLogSerializer(serializers.ModelSerializer):
    usuario_detalhe = UsuarioMiniSerializer(source="usuario", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "usuario_detalhe",
            "acao",
            "entidade",
            "entidade_id",
            "detalhes",
            "criado_em",
        ]
