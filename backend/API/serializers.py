"""Serializers do DRF — IASD Gestão."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError
from rest_framework import serializers

from . import roles
from .models import (
    Ata,
    AuditLog,
    EnqueteGrupo,
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
                "secretaria": m.secretaria,
                "papel_desde": m.papel_desde,
                "status": m.status,
                "eh_lideranca": m.eh_lideranca,
                "motivo_rejeicao": m.motivo_rejeicao,
                "data_entrada": m.data_entrada,
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
                "motivo_rejeicao": g.motivo_rejeicao,
                "data_entrada": g.data_entrada,
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
    eu_sigo = serializers.SerializerMethodField()

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
            "cor_primaria",
            "ativo",
            "total_membros",
            "distancia_km",
            "meu_status",
            "meu_papel",
            "eu_sigo",
            "criado_em",
        ]
        read_only_fields = ["slug", "foto", "criado_em"]

    def get_eu_sigo(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from .models import IgrejaSeguidor

        cache = self.context.setdefault("_seguidas_cache", {})
        if request.user.id not in cache:
            cache[request.user.id] = set(
                IgrejaSeguidor.objects.filter(usuario=request.user).values_list("igreja_id", flat=True)
            )
        return obj.id in cache[request.user.id]

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
            "secretaria",
            "papel_desde",
            "status",
            "motivo_rejeicao",
            "data_entrada",
        ]
        read_only_fields = ["usuario", "data_entrada", "motivo_rejeicao", "papel_desde"]


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
            "cor",
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
            "motivo_rejeicao",
            "data_entrada",
        ]
        read_only_fields = ["usuario", "data_entrada", "motivo_rejeicao"]


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
    cor_igreja = serializers.CharField(source="igreja.cor_primaria", read_only=True)
    cor_grupo = serializers.SerializerMethodField()
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
            "cor_igreja",
            "cor_grupo",
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
        sala = attrs.get("sala", getattr(self.instance, "sala", None))
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError(
                {"fim": "O término não pode ser antes do início."}
            )
        # Conflito de sala: nenhuma sobreposição com eventos pendentes/aprovados.
        if sala and inicio and fim:
            from .models import Evento as _Evento, StatusEvento as _SE

            conf = _Evento.objects.filter(
                sala=sala,
                status__in=[_SE.PENDENTE, _SE.APROVADO],
                inicio__lt=fim,
                fim__gt=inicio,
            )
            if self.instance:
                conf = conf.exclude(pk=self.instance.pk)
            ocupado = conf.select_related("grupo").first()
            if ocupado:
                from django.utils import timezone as _tz

                hi = _tz.localtime(ocupado.inicio).strftime("%d/%m %H:%M")
                hf = _tz.localtime(ocupado.fim).strftime("%H:%M")
                por = f" por {ocupado.grupo.nome}" if ocupado.grupo_id else ""
                raise serializers.ValidationError(
                    {"sala": f"Sala já reservada das {hi} às {hf}{por}. Escolha outro horário ou outra sala."}
                )
        return attrs

    def get_cor_grupo(self, obj):
        return obj.grupo.cor if obj.grupo_id else None

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
    total_eleitores = serializers.SerializerMethodField()
    pendentes = serializers.SerializerMethodField()
    mostra_resultado = serializers.SerializerMethodField()
    pode_votar = serializers.SerializerMethodField()
    expirada = serializers.BooleanField(read_only=True)
    quorum_atingido = serializers.BooleanField(read_only=True)

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
            "tipo",
            "categoria",
            "canal",
            "metodo_votacao",
            "pode_votar",
            "payload",
            "opcoes",
            "anonima",
            "permitir_justificativa",
            "prazo_votacao",
            "quorum_minimo",
            "quorum_atingido",
            "status",
            "decisao",
            "aplicada_em",
            "resultado",
            "mostra_resultado",
            "meu_voto",
            "total_votos",
            "total_eleitores",
            "pendentes",
            "expirada",
            "criado_em",
        ]
        read_only_fields = [
            "criada_por", "status", "decisao", "aplicada_em", "criado_em",
        ]

    def get_mostra_resultado(self, obj):
        # Em pauta anônima, a contagem por opção só aparece após o encerramento.
        return not (obj.anonima and obj.status == "aberta")

    def get_resultado(self, obj):
        if not self.get_mostra_resultado(obj):
            return None
        from collections import Counter

        contagem = Counter(v.opcao for v in obj.votos.all())
        if obj.tipo == "enquete_livre" and obj.opcoes:
            return {op: contagem.get(op, 0) for op in obj.opcoes}
        return {
            "sim": contagem.get(OpcaoVoto.SIM, 0),
            "nao": contagem.get(OpcaoVoto.NAO, 0),
            "abstencao": contagem.get(OpcaoVoto.ABSTENCAO, 0),
        }

    def get_total_votos(self, obj):
        # Participação do eleitorado (no Canal da Liderança, exclui votos
        # consultivos dos anciões — que não contam para o quórum).
        return len(obj.votos_que_contam())

    def get_total_eleitores(self, obj):
        return obj.total_eleitores()

    def get_pode_votar(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return roles.pode_votar_pauta(request.user, obj)

    def get_pendentes(self, obj):
        """Eleitores que ainda não votaram (para cobrar) — não vaza o voto deles."""
        votaram = set(obj.votos.values_list("usuario_id", flat=True))
        qs = obj.eleitores().exclude(usuario_id__in=votaram).select_related("usuario")
        return [
            {"id": m.usuario_id, "nome": m.usuario.get_full_name() or m.usuario.username}
            for m in qs
        ]

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


class PautaAnexoSerializer(serializers.ModelSerializer):
    arquivo = serializers.SerializerMethodField()

    class Meta:
        from .models import PautaAnexo

        model = PautaAnexo
        fields = ["id", "arquivo", "tipo_mime", "tamanho_bytes", "nome_original", "criado_em"]

    def get_arquivo(self, obj):
        return obj.arquivo.url if obj.arquivo else None


class PautaComentarioSerializer(serializers.ModelSerializer):
    autor_detalhe = UsuarioMiniSerializer(source="autor", read_only=True)
    anexos = PautaAnexoSerializer(many=True, read_only=True)
    editado = serializers.SerializerMethodField()

    class Meta:
        from .models import PautaComentario

        model = PautaComentario
        fields = [
            "id", "pauta", "autor", "autor_detalhe", "texto", "anexos",
            "editado", "criado_em", "editado_em",
        ]
        read_only_fields = ["autor", "criado_em", "editado_em"]

    def get_editado(self, obj):
        return obj.editado_em is not None


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
        # A secretaria pode revelar o autor mesmo em pauta anônima (sob sigilo);
        # o viewset sinaliza isso via contexto e registra a auditoria.
        if obj.pauta.anonima and not self.context.get("revelar_anonimo"):
            return None
        return UsuarioMiniSerializer(obj.usuario, context=self.context).data


class AtaSerializer(serializers.ModelSerializer):
    igreja_nome = serializers.CharField(source="igreja.nome", read_only=True)
    pauta_titulo = serializers.CharField(source="pauta.titulo", read_only=True, default=None)
    criada_por_detalhe = UsuarioMiniSerializer(source="criada_por", read_only=True)

    class Meta:
        model = Ata
        fields = [
            "id",
            "pauta",
            "pauta_titulo",
            "igreja",
            "igreja_nome",
            "titulo",
            "conteudo",
            "status",
            "criada_por",
            "criada_por_detalhe",
            "publicada_em",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "pauta", "criada_por", "status", "publicada_em", "criado_em", "atualizado_em",
        ]


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #
class EnqueteGrupoSerializer(serializers.ModelSerializer):
    """Enquete do chat de grupo, com barras de resultado.

    As opções vêm com contagem de votos e `eu_votei`. Em enquetes não anônimas,
    cada opção também traz `votantes` (mini-usuários). `encerrada` reflete o
    fechamento manual **ou** o prazo expirado.
    """

    criada_por_detalhe = UsuarioMiniSerializer(source="criada_por", read_only=True)
    opcoes = serializers.SerializerMethodField()
    total_votos = serializers.SerializerMethodField()
    encerrada = serializers.SerializerMethodField()
    meu_voto = serializers.SerializerMethodField()

    class Meta:
        model = EnqueteGrupo
        fields = [
            "id",
            "grupo",
            "pergunta",
            "multipla_escolha",
            "anonima",
            "prazo",
            "encerrada",
            "encerrada_em",
            "criado_em",
            "criada_por",
            "criada_por_detalhe",
            "opcoes",
            "total_votos",
            "meu_voto",
        ]

    def _uid(self):
        req = self.context.get("request")
        u = getattr(req, "user", None)
        return u.id if (u and u.is_authenticated) else None

    def get_encerrada(self, obj):
        return obj.esta_fechada

    def get_opcoes(self, obj):
        uid = self._uid()
        saida = []
        for o in obj.opcoes.all():
            votos = list(o.votos.all())
            item = {
                "id": o.id,
                "texto": o.texto,
                "ordem": o.ordem,
                "votos": len(votos),
                "eu_votei": any(v.usuario_id == uid for v in votos),
            }
            if not obj.anonima:
                item["votantes"] = UsuarioMiniSerializer(
                    [v.usuario for v in votos], many=True, context=self.context
                ).data
            saida.append(item)
        return saida

    def get_total_votos(self, obj):
        votantes = set()
        for o in obj.opcoes.all():
            for v in o.votos.all():
                votantes.add(v.usuario_id)
        return len(votantes)

    def get_meu_voto(self, obj):
        uid = self._uid()
        if uid is None:
            return []
        return [
            o.id for o in obj.opcoes.all()
            if any(v.usuario_id == uid for v in o.votos.all())
        ]


class MensagemSerializer(serializers.ModelSerializer):
    autor_detalhe = UsuarioMiniSerializer(source="autor", read_only=True)
    enquete_detalhe = EnqueteGrupoSerializer(source="enquete", read_only=True)

    class Meta:
        model = Mensagem
        fields = [
            "id",
            "grupo",
            "autor",
            "autor_detalhe",
            "conteudo",
            "anexo",
            "enquete",
            "enquete_detalhe",
            "criado_em",
        ]
        read_only_fields = ["autor", "anexo", "enquete", "criado_em"]


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
