import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import (
    AuthToken,
    Profile,
    Igreja,
    Grupos,
    Events,
    Atividades,
    Comunicados,
    Avisos,
    NotificacoesGrupos,
    RecursosEducacionais,
    ArquivosIgreja,
    PostagensGrupos,
    ComentariosPostagens,
    MensagensPrivadas,
)


def json_error(message, status=400, **extra):
    payload = {"error": message}
    payload.update(extra)
    return JsonResponse(payload, status=status)


def parse_json_body(request):
    if not request.body:
        return {}, None
    try:
        return json.loads(request.body), None
    except json.JSONDecodeError:
        return None, json_error("Invalid JSON body", status=400)


def get_request_data(request):
    content_type = request.content_type or ""
    if content_type.startswith("application/json"):
        return parse_json_body(request)
    if request.POST:
        return request.POST.dict(), None
    if not request.body:
        return {}, None
    return parse_json_body(request)


def get_list_value(data, name, request=None):
    if name in data:
        value = data.get(name)
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return [value]
    if request is not None:
        values = request.POST.getlist(name)
        if values:
            return values
    return []


def require_fields(data, fields):
    missing = [field for field in fields if data.get(field) in (None, "")]
    if missing:
        return json_error("Missing required fields", status=400, fields=missing)
    return None


def parse_int(value, field_name, required=True):
    if value in (None, ""):
        if required:
            return None, json_error(f"{field_name} is required", status=400)
        return None, None
    try:
        return int(value), None
    except (TypeError, ValueError):
        return None, json_error(f"Invalid {field_name}", status=400)


def parse_datetime_value(value, field_name, required=True):
    if value in (None, ""):
        if required:
            return None, json_error(f"{field_name} is required", status=400)
        return None, None
    parsed = parse_datetime(value)
    if parsed is None:
        return None, json_error(f"Invalid datetime for {field_name}", status=400)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed, None


def parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "y", "sim")
    return bool(value)


def extract_token_key(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() in ("token", "bearer"):
        return parts[1]
    return auth_header


def token_is_expired(token):
    ttl_days = getattr(settings, "AUTH_TOKEN_TTL_DAYS", 7)
    if not ttl_days or ttl_days <= 0:
        return False
    return token.created_at < timezone.now() - timedelta(days=ttl_days)


def issue_token(user):
    token, _ = AuthToken.objects.get_or_create(user=user)
    now = timezone.now()
    token.key = secrets.token_hex(20)
    token.created_at = now
    token.last_used_at = now
    token.save()
    return token


def get_authenticated_profile(request):
    token_key = extract_token_key(request)
    if not token_key:
        return None, json_error("Authorization header missing", status=401)
    try:
        token = AuthToken.objects.select_related("user").get(key=token_key)
    except AuthToken.DoesNotExist:
        return None, json_error("Invalid token", status=401)
    if token_is_expired(token):
        token.delete()
        return None, json_error("Token expired", status=401)
    token.last_used_at = timezone.now()
    token.save(update_fields=["last_used_at"])
    profile, _ = Profile.objects.get_or_create(user=token.user)
    return profile, None


def has_staff_access(profile):
    return profile.is_admin or profile.is_elder


def is_group_member(profile, grupo):
    if has_staff_access(profile):
        return True
    return profile.grupos.filter(pk=grupo.pk).exists()


def igreja_payload(igreja):
    return {
        "id": igreja.id,
        "nome": igreja.nome,
        "endereco": igreja.endereco,
        "telefone": igreja.telefone,
        "email": igreja.email,
    }


def grupo_payload(grupo):
    return {
        "id": grupo.id,
        "nome": grupo.nome,
        "descricao": grupo.descricao,
        "igreja_id": grupo.igreja_id,
        "igreja_nome": grupo.igreja.nome if grupo.igreja_id else None,
    }


def profile_summary_payload(profile):
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "username": profile.user.username,
        "email": profile.user.email,
        "telefone": profile.telefone,
        "is_admin": profile.is_admin,
        "is_elder": profile.is_elder,
        "image_url": profile.image.url if profile.image else None,
    }


def profile_detail_payload(profile):
    return {
        **profile_summary_payload(profile),
        "bio": profile.bio,
        "igrejas": list(profile.igrejas.values("id", "nome")),
        "grupos": list(profile.grupos.values("id", "nome")),
    }


def event_payload(event):
    return {
        "id": event.id,
        "titulo": event.titulo,
        "descricao": event.descricao,
        "data_inicio": event.data_inicio,
        "data_fim": event.data_fim,
        "igreja_id": event.igreja_id,
        "igreja_nome": event.igreja.nome if event.igreja_id else None,
    }


def atividade_payload(atividade):
    return {
        "id": atividade.id,
        "nome": atividade.nome,
        "descricao": atividade.descricao,
        "data": atividade.data,
        "grupo_id": atividade.Grupo_id,
        "grupo_nome": atividade.Grupo.nome if atividade.Grupo_id else None,
    }


def comunicado_payload(comunicado):
    return {
        "id": comunicado.id,
        "titulo": comunicado.titulo,
        "mensagem": comunicado.mensagem,
        "data_envio": comunicado.data_envio,
        "igreja_id": comunicado.igreja_id,
        "igreja_nome": comunicado.igreja.nome if comunicado.igreja_id else None,
    }


def aviso_payload(aviso):
    return {
        "id": aviso.id,
        "titulo": aviso.titulo,
        "mensagem": aviso.mensagem,
        "data_envio": aviso.data_envio,
        "igreja_id": aviso.igreja_id,
        "igreja_nome": aviso.igreja.nome if aviso.igreja_id else None,
    }


def notificacao_payload(notificacao):
    return {
        "id": notificacao.id,
        "perfil_id": notificacao.perfil_id,
        "grupo_id": notificacao.grupo_id,
        "grupo_nome": notificacao.grupo.nome if notificacao.grupo_id else None,
        "mensagem": notificacao.mensagem,
        "data_notificacao": notificacao.data_notificacao,
        "lida": notificacao.lida,
    }


def recurso_payload(recurso):
    return {
        "id": recurso.id,
        "titulo": recurso.titulo,
        "descricao": recurso.descricao,
        "arquivo_url": recurso.arquivo.url if recurso.arquivo else None,
        "data_upload": recurso.data_upload,
        "igreja_id": recurso.igreja_id,
        "igreja_nome": recurso.igreja.nome if recurso.igreja_id else None,
    }


def arquivo_payload(arquivo):
    return {
        "id": arquivo.id,
        "nome_arquivo": arquivo.nome_arquivo,
        "arquivo_url": arquivo.arquivo.url if arquivo.arquivo else None,
        "data_upload": arquivo.data_upload,
        "igreja_id": arquivo.igreja_id,
        "igreja_nome": arquivo.igreja.nome if arquivo.igreja_id else None,
    }


def postagem_payload(postagem):
    return {
        "id": postagem.id,
        "autor_id": postagem.autor_id,
        "autor_nome": postagem.autor.user.username if postagem.autor_id else None,
        "grupo_id": postagem.grupo_id,
        "grupo_nome": postagem.grupo.nome if postagem.grupo_id else None,
        "conteudo": postagem.conteudo,
        "arquivo_url": postagem.arquivo.url if postagem.arquivo else None,
        "enquete": postagem.enquete,
        "link": postagem.link,
        "data_postagem": postagem.data_postagem,
    }


def comentario_payload(comentario):
    return {
        "id": comentario.id,
        "postagem_id": comentario.postagem_id,
        "autor_id": comentario.autor_id,
        "autor_nome": comentario.autor.user.username if comentario.autor_id else None,
        "conteudo": comentario.conteudo,
        "data_comentario": comentario.data_comentario,
    }


def mensagem_payload(mensagem):
    return {
        "id": mensagem.id,
        "remetente_id": mensagem.remetente_id,
        "remetente_nome": mensagem.remetente.user.username if mensagem.remetente_id else None,
        "destinatario_id": mensagem.destinatario_id,
        "destinatario_nome": mensagem.destinatario.user.username if mensagem.destinatario_id else None,
        "conteudo": mensagem.conteudo,
        "data_envio": mensagem.data_envio,
        "lida": mensagem.lida,
    }


class AuthenticatedView(View):
    require_staff = False

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        profile, error = get_authenticated_profile(request)
        if error:
            return error
        if self.require_staff and not has_staff_access(profile):
            return json_error("Forbidden", status=403)
        request.profile = profile
        return super().dispatch(request, *args, **kwargs)


class StaffView(AuthenticatedView):
    require_staff = True


@csrf_exempt
@require_POST
def login_view(request):
    data, error = parse_json_body(request)
    if error:
        return error
    missing = require_fields(data, ["username", "password"])
    if missing:
        return missing

    user = authenticate(request, username=data.get("username"), password=data.get("password"))
    if user is None:
        return json_error("Invalid credentials", status=401)

    token = issue_token(user)
    profile, _ = Profile.objects.get_or_create(user=user)
    payload = {
        "token": token.key,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
        "profile": profile_detail_payload(profile),
    }
    return JsonResponse(payload)


@csrf_exempt
@require_POST
def logout_view(request):
    token_key = extract_token_key(request)
    if not token_key:
        return json_error("Authorization header missing", status=401)
    try:
        token = AuthToken.objects.get(key=token_key)
    except AuthToken.DoesNotExist:
        return json_error("Invalid token", status=401)
    token.delete()
    return JsonResponse({"message": "Logged out successfully"})


@csrf_exempt
@require_POST
def register_view(request):
    data, error = get_request_data(request)
    if error:
        return error
    missing = require_fields(data, ["username", "password", "email"])
    if missing:
        return missing

    username = data.get("username")
    password = data.get("password")
    email = data.get("email")
    telefone = data.get("telefone")

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return json_error("Username already exists", status=400)

    try:
        validate_password(password, user=User(username=username, email=email))
    except ValidationError as exc:
        return json_error("Invalid password", status=400, details=exc.messages)

    user = User.objects.create_user(username=username, password=password, email=email)
    profile, _ = Profile.objects.get_or_create(user=user)
    if telefone:
        profile.telefone = telefone

    igreja_ids = get_list_value(data, "Igreja_Participante", request=request)
    if not igreja_ids:
        igreja_ids = get_list_value(data, "igreja_ids", request=request)
    if igreja_ids:
        parsed_ids = []
        for igreja_id in igreja_ids:
            parsed_id, parse_error = parse_int(igreja_id, "igreja_id")
            if parse_error:
                return parse_error
            parsed_ids.append(parsed_id)
        igrejas = Igreja.objects.filter(id__in=parsed_ids)
        if igrejas.count() != len(parsed_ids):
            return json_error("One or more igrejas not found", status=400)
        profile.igrejas.add(*igrejas)

    profile.save()
    token = issue_token(user)
    payload = {
        "message": "User registered successfully",
        "token": token.key,
        "user": {"id": user.id, "username": user.username, "email": user.email},
        "profile": profile_detail_payload(profile),
    }
    return JsonResponse(payload, status=201)


class IgrejaList(View):
    def get(self, request):
        igrejas = Igreja.objects.all().order_by("nome")
        data = [igreja_payload(igreja) for igreja in igrejas]
        return JsonResponse(data, safe=False)


class IgrejaDetail(View):
    def get(self, request, pk):
        try:
            igreja = Igreja.objects.get(pk=pk)
        except Igreja.DoesNotExist:
            return json_error("Igreja not found", status=404)
        return JsonResponse(igreja_payload(igreja))


class GruposList(AuthenticatedView):
    def get(self, request):
        grupos = Grupos.objects.select_related("igreja").all()
        igreja_id, error = parse_int(request.GET.get("igreja_id"), "igreja_id", required=False)
        if error:
            return error
        if igreja_id is not None:
            grupos = grupos.filter(igreja_id=igreja_id)
        if not has_staff_access(request.profile):
            grupos = grupos.filter(id__in=request.profile.grupos.values_list("id", flat=True))
        data = [grupo_payload(grupo) for grupo in grupos]
        return JsonResponse(data, safe=False)


class GruposDetail(AuthenticatedView):
    def get(self, request, pk):
        try:
            grupo = Grupos.objects.select_related("igreja").get(pk=pk)
        except Grupos.DoesNotExist:
            return json_error("Grupo not found", status=404)
        if not is_group_member(request.profile, grupo):
            return json_error("Forbidden", status=403)
        return JsonResponse(grupo_payload(grupo))


class ProfileList(StaffView):
    def get(self, request):
        profiles = Profile.objects.select_related("user").all()
        data = [profile_summary_payload(profile) for profile in profiles]
        return JsonResponse(data, safe=False)


class ProfileNotify(AuthenticatedView):
    def get(self, request):
        include_read = request.GET.get("include_read") in ("1", "true", "yes")
        notificacoes = NotificacoesGrupos.objects.select_related("grupo").filter(
            perfil=request.profile
        )
        if not include_read:
            notificacoes = notificacoes.filter(lida=False)
        data = [notificacao_payload(notificacao) for notificacao in notificacoes]
        return JsonResponse(data, safe=False)


class ProfileDetail(AuthenticatedView):
    def get(self, request, pk):
        try:
            profile = Profile.objects.select_related("user").prefetch_related(
                "igrejas", "grupos"
            ).get(pk=pk)
        except Profile.DoesNotExist:
            return json_error("Profile not found", status=404)
        if profile.id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)
        return JsonResponse(profile_detail_payload(profile))


class ProfileUpdate(AuthenticatedView):
    def post(self, request, pk):
        try:
            profile = Profile.objects.select_related("user").get(pk=pk)
        except Profile.DoesNotExist:
            return json_error("Profile not found", status=404)
        if profile.id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)

        data, error = get_request_data(request)
        if error:
            return error
        profile.telefone = data.get("telefone", profile.telefone)
        profile.bio = data.get("bio", profile.bio)
        if request.FILES.get("image"):
            profile.image = request.FILES["image"]

        if has_staff_access(request.profile):
            igreja_ids = get_list_value(data, "igreja_ids", request=request)
            if igreja_ids:
                parsed_ids = []
                for igreja_id in igreja_ids:
                    parsed_id, parse_error = parse_int(igreja_id, "igreja_id")
                    if parse_error:
                        return parse_error
                    parsed_ids.append(parsed_id)
                igrejas = Igreja.objects.filter(id__in=parsed_ids)
                if igrejas.count() != len(parsed_ids):
                    return json_error("One or more igrejas not found", status=400)
                profile.igrejas.set(igrejas)

            grupo_ids = get_list_value(data, "grupo_ids", request=request)
            if grupo_ids:
                parsed_ids = []
                for grupo_id in grupo_ids:
                    parsed_id, parse_error = parse_int(grupo_id, "grupo_id")
                    if parse_error:
                        return parse_error
                    parsed_ids.append(parsed_id)
                grupos = Grupos.objects.filter(id__in=parsed_ids)
                if grupos.count() != len(parsed_ids):
                    return json_error("One or more grupos not found", status=400)
                profile.grupos.set(grupos)

        profile.save()
        return JsonResponse({"message": "Profile updated successfully"})


class ProfileDelete(AuthenticatedView):
    def post(self, request, pk):
        try:
            profile = Profile.objects.select_related("user").get(pk=pk)
        except Profile.DoesNotExist:
            return json_error("Profile not found", status=404)
        if profile.id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)
        profile.user.delete()
        return JsonResponse({"message": "Profile deleted successfully"})


class EventsList(View):
    def get(self, request):
        events = Events.objects.select_related("igreja").all()
        igreja_id, error = parse_int(request.GET.get("igreja_id"), "igreja_id", required=False)
        if error:
            return error
        if igreja_id is not None:
            events = events.filter(igreja_id=igreja_id)
        data = [event_payload(event) for event in events]
        return JsonResponse(data, safe=False)


class EventsDetail(View):
    def get(self, request, pk):
        try:
            event = Events.objects.select_related("igreja").get(pk=pk)
        except Events.DoesNotExist:
            return json_error("Event not found", status=404)
        return JsonResponse(event_payload(event))


class EventsCreate(StaffView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["titulo", "data_inicio", "data_fim", "igreja_id"])
        if missing:
            return missing

        igreja_id, parse_error = parse_int(data.get("igreja_id"), "igreja_id")
        if parse_error:
            return parse_error
        data_inicio, parse_error = parse_datetime_value(data.get("data_inicio"), "data_inicio")
        if parse_error:
            return parse_error
        data_fim, parse_error = parse_datetime_value(data.get("data_fim"), "data_fim")
        if parse_error:
            return parse_error
        if data_fim < data_inicio:
            return json_error("data_fim must be after data_inicio", status=400)

        try:
            igreja = Igreja.objects.get(pk=igreja_id)
        except Igreja.DoesNotExist:
            return json_error("Igreja not found", status=404)

        event = Events.objects.create(
            titulo=data.get("titulo"),
            descricao=data.get("descricao", ""),
            data_inicio=data_inicio,
            data_fim=data_fim,
            igreja=igreja,
        )
        return JsonResponse({"message": "Event created successfully", "event_id": event.id}, status=201)


class EventsUpdate(StaffView):
    def post(self, request, pk):
        try:
            event = Events.objects.get(pk=pk)
        except Events.DoesNotExist:
            return json_error("Event not found", status=404)

        data, error = get_request_data(request)
        if error:
            return error
        if "titulo" in data:
            event.titulo = data.get("titulo") or event.titulo
        if "descricao" in data:
            event.descricao = data.get("descricao") or ""
        if "data_inicio" in data:
            data_inicio, parse_error = parse_datetime_value(
                data.get("data_inicio"), "data_inicio", required=False
            )
            if parse_error:
                return parse_error
            if data_inicio is not None:
                event.data_inicio = data_inicio
        if "data_fim" in data:
            data_fim, parse_error = parse_datetime_value(
                data.get("data_fim"), "data_fim", required=False
            )
            if parse_error:
                return parse_error
            if data_fim is not None:
                event.data_fim = data_fim
        if event.data_fim < event.data_inicio:
            return json_error("data_fim must be after data_inicio", status=400)

        event.save()
        return JsonResponse({"message": "Event updated successfully"})


class EventsDelete(StaffView):
    def post(self, request, pk):
        try:
            event = Events.objects.get(pk=pk)
        except Events.DoesNotExist:
            return json_error("Event not found", status=404)
        event.delete()
        return JsonResponse({"message": "Event deleted successfully"})


class AtividadesList(AuthenticatedView):
    def get(self, request):
        atividades = Atividades.objects.select_related("Grupo")
        grupo_id, error = parse_int(request.GET.get("grupo_id"), "grupo_id", required=False)
        if error:
            return error
        if grupo_id is not None:
            atividades = atividades.filter(Grupo_id=grupo_id)
        if not has_staff_access(request.profile):
            atividades = atividades.filter(
                Grupo_id__in=request.profile.grupos.values_list("id", flat=True)
            )
        data = [atividade_payload(atividade) for atividade in atividades]
        return JsonResponse(data, safe=False)


class AtividadesDetail(AuthenticatedView):
    def get(self, request, pk):
        try:
            atividade = Atividades.objects.select_related("Grupo").get(pk=pk)
        except Atividades.DoesNotExist:
            return json_error("Atividade not found", status=404)
        if not is_group_member(request.profile, atividade.Grupo):
            return json_error("Forbidden", status=403)
        return JsonResponse(atividade_payload(atividade))


class AtividadesCreate(AuthenticatedView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["nome", "data", "grupo_id"])
        if missing:
            return missing

        grupo_id, parse_error = parse_int(data.get("grupo_id"), "grupo_id")
        if parse_error:
            return parse_error
        data_atividade, parse_error = parse_datetime_value(data.get("data"), "data")
        if parse_error:
            return parse_error

        try:
            grupo = Grupos.objects.get(pk=grupo_id)
        except Grupos.DoesNotExist:
            return json_error("Grupo not found", status=404)
        if not is_group_member(request.profile, grupo):
            return json_error("Forbidden", status=403)

        atividade = Atividades.objects.create(
            nome=data.get("nome"),
            descricao=data.get("descricao", ""),
            data=data_atividade,
            Grupo=grupo,
        )
        return JsonResponse(
            {"message": "Atividade created successfully", "atividade_id": atividade.id},
            status=201,
        )


class AtividadesUpdate(AuthenticatedView):
    def post(self, request, pk):
        try:
            atividade = Atividades.objects.select_related("Grupo").get(pk=pk)
        except Atividades.DoesNotExist:
            return json_error("Atividade not found", status=404)
        if not is_group_member(request.profile, atividade.Grupo):
            return json_error("Forbidden", status=403)

        data, error = get_request_data(request)
        if error:
            return error
        if "nome" in data:
            atividade.nome = data.get("nome") or atividade.nome
        if "descricao" in data:
            atividade.descricao = data.get("descricao") or ""
        if "data" in data:
            data_atividade, parse_error = parse_datetime_value(
                data.get("data"), "data", required=False
            )
            if parse_error:
                return parse_error
            if data_atividade is not None:
                atividade.data = data_atividade
        atividade.save()
        return JsonResponse({"message": "Atividade updated successfully"})


class AtividadesDelete(AuthenticatedView):
    def post(self, request, pk):
        try:
            atividade = Atividades.objects.select_related("Grupo").get(pk=pk)
        except Atividades.DoesNotExist:
            return json_error("Atividade not found", status=404)
        if not is_group_member(request.profile, atividade.Grupo):
            return json_error("Forbidden", status=403)
        atividade.delete()
        return JsonResponse({"message": "Atividade deleted successfully"})


class ComunicadosList(View):
    def get(self, request):
        comunicados = Comunicados.objects.select_related("igreja")
        igreja_id, error = parse_int(request.GET.get("igreja_id"), "igreja_id", required=False)
        if error:
            return error
        if igreja_id is not None:
            comunicados = comunicados.filter(igreja_id=igreja_id)
        data = [comunicado_payload(comunicado) for comunicado in comunicados]
        return JsonResponse(data, safe=False)


class ComunicadosDetail(View):
    def get(self, request, pk):
        try:
            comunicado = Comunicados.objects.select_related("igreja").get(pk=pk)
        except Comunicados.DoesNotExist:
            return json_error("Comunicado not found", status=404)
        return JsonResponse(comunicado_payload(comunicado))


class ComunicadosCreate(StaffView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["titulo", "mensagem", "igreja_id"])
        if missing:
            return missing

        igreja_id, parse_error = parse_int(data.get("igreja_id"), "igreja_id")
        if parse_error:
            return parse_error
        try:
            igreja = Igreja.objects.get(pk=igreja_id)
        except Igreja.DoesNotExist:
            return json_error("Igreja not found", status=404)

        comunicado = Comunicados.objects.create(
            titulo=data.get("titulo"),
            mensagem=data.get("mensagem"),
            igreja=igreja,
        )
        return JsonResponse(
            {"message": "Comunicado created successfully", "comunicado_id": comunicado.id},
            status=201,
        )


class ComunicadosUpdate(StaffView):
    def post(self, request, pk):
        try:
            comunicado = Comunicados.objects.get(pk=pk)
        except Comunicados.DoesNotExist:
            return json_error("Comunicado not found", status=404)

        data, error = get_request_data(request)
        if error:
            return error
        if "titulo" in data:
            comunicado.titulo = data.get("titulo") or comunicado.titulo
        if "mensagem" in data:
            comunicado.mensagem = data.get("mensagem") or comunicado.mensagem
        comunicado.save()
        return JsonResponse({"message": "Comunicado updated successfully"})


class ComunicadosDelete(StaffView):
    def post(self, request, pk):
        try:
            comunicado = Comunicados.objects.get(pk=pk)
        except Comunicados.DoesNotExist:
            return json_error("Comunicado not found", status=404)
        comunicado.delete()
        return JsonResponse({"message": "Comunicado deleted successfully"})


class AvisosList(View):
    def get(self, request):
        avisos = Avisos.objects.select_related("igreja")
        igreja_id, error = parse_int(request.GET.get("igreja_id"), "igreja_id", required=False)
        if error:
            return error
        if igreja_id is not None:
            avisos = avisos.filter(igreja_id=igreja_id)
        data = [aviso_payload(aviso) for aviso in avisos]
        return JsonResponse(data, safe=False)


class AvisosDetail(View):
    def get(self, request, pk):
        try:
            aviso = Avisos.objects.select_related("igreja").get(pk=pk)
        except Avisos.DoesNotExist:
            return json_error("Aviso not found", status=404)
        return JsonResponse(aviso_payload(aviso))


class AvisosCreate(StaffView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["titulo", "mensagem", "igreja_id"])
        if missing:
            return missing

        igreja_id, parse_error = parse_int(data.get("igreja_id"), "igreja_id")
        if parse_error:
            return parse_error
        try:
            igreja = Igreja.objects.get(pk=igreja_id)
        except Igreja.DoesNotExist:
            return json_error("Igreja not found", status=404)

        aviso = Avisos.objects.create(
            titulo=data.get("titulo"),
            mensagem=data.get("mensagem"),
            igreja=igreja,
        )
        return JsonResponse({"message": "Aviso created successfully", "aviso_id": aviso.id}, status=201)


class AvisosUpdate(StaffView):
    def post(self, request, pk):
        try:
            aviso = Avisos.objects.get(pk=pk)
        except Avisos.DoesNotExist:
            return json_error("Aviso not found", status=404)

        data, error = get_request_data(request)
        if error:
            return error
        if "titulo" in data:
            aviso.titulo = data.get("titulo") or aviso.titulo
        if "mensagem" in data:
            aviso.mensagem = data.get("mensagem") or aviso.mensagem
        aviso.save()
        return JsonResponse({"message": "Aviso updated successfully"})


class AvisosDelete(StaffView):
    def post(self, request, pk):
        try:
            aviso = Avisos.objects.get(pk=pk)
        except Avisos.DoesNotExist:
            return json_error("Aviso not found", status=404)
        aviso.delete()
        return JsonResponse({"message": "Aviso deleted successfully"})


class NotificacoesGruposList(StaffView):
    def get(self, request):
        notificacoes = NotificacoesGrupos.objects.select_related("grupo", "perfil")
        data = [notificacao_payload(notificacao) for notificacao in notificacoes]
        return JsonResponse(data, safe=False)


class NotificacoesGruposDetail(StaffView):
    def get(self, request, pk):
        try:
            notificacao = NotificacoesGrupos.objects.select_related("grupo", "perfil").get(pk=pk)
        except NotificacoesGrupos.DoesNotExist:
            return json_error("Notificacao not found", status=404)
        return JsonResponse(notificacao_payload(notificacao))


class NotificacoesGruposCreate(StaffView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["perfil_id", "grupo_id", "mensagem"])
        if missing:
            return missing

        perfil_id, parse_error = parse_int(data.get("perfil_id"), "perfil_id")
        if parse_error:
            return parse_error
        grupo_id, parse_error = parse_int(data.get("grupo_id"), "grupo_id")
        if parse_error:
            return parse_error

        try:
            perfil = Profile.objects.get(pk=perfil_id)
        except Profile.DoesNotExist:
            return json_error("Perfil not found", status=404)
        try:
            grupo = Grupos.objects.get(pk=grupo_id)
        except Grupos.DoesNotExist:
            return json_error("Grupo not found", status=404)

        notificacao = NotificacoesGrupos.objects.create(
            perfil=perfil, grupo=grupo, mensagem=data.get("mensagem")
        )
        return JsonResponse(
            {"message": "Notificacao created successfully", "notificacao_id": notificacao.id},
            status=201,
        )


class NotificacoesGruposUpdate(AuthenticatedView):
    def post(self, request, pk):
        try:
            notificacao = NotificacoesGrupos.objects.select_related("perfil").get(pk=pk)
        except NotificacoesGrupos.DoesNotExist:
            return json_error("Notificacao not found", status=404)
        if not has_staff_access(request.profile) and notificacao.perfil_id != request.profile.id:
            return json_error("Forbidden", status=403)

        data, error = get_request_data(request)
        if error:
            return error
        if "mensagem" in data and has_staff_access(request.profile):
            notificacao.mensagem = data.get("mensagem") or notificacao.mensagem
        if "lida" in data:
            notificacao.lida = parse_bool(data.get("lida"))
        notificacao.save()
        return JsonResponse({"message": "Notificacao updated successfully"})


class NotificacoesGruposDelete(StaffView):
    def post(self, request, pk):
        try:
            notificacao = NotificacoesGrupos.objects.get(pk=pk)
        except NotificacoesGrupos.DoesNotExist:
            return json_error("Notificacao not found", status=404)
        notificacao.delete()
        return JsonResponse({"message": "Notificacao deleted successfully"})


class RecursosEducacionaisList(View):
    def get(self, request):
        recursos = RecursosEducacionais.objects.select_related("igreja")
        igreja_id, error = parse_int(request.GET.get("igreja_id"), "igreja_id", required=False)
        if error:
            return error
        if igreja_id is not None:
            recursos = recursos.filter(igreja_id=igreja_id)
        data = [recurso_payload(recurso) for recurso in recursos]
        return JsonResponse(data, safe=False)


class RecursosEducacionaisDetail(View):
    def get(self, request, pk):
        try:
            recurso = RecursosEducacionais.objects.select_related("igreja").get(pk=pk)
        except RecursosEducacionais.DoesNotExist:
            return json_error("Recurso Educacional not found", status=404)
        return JsonResponse(recurso_payload(recurso))


class RecursosEducacionaisCreate(StaffView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["titulo", "igreja_id"])
        if missing:
            return missing
        if not request.FILES.get("arquivo"):
            return json_error("arquivo is required", status=400)

        igreja_id, parse_error = parse_int(data.get("igreja_id"), "igreja_id")
        if parse_error:
            return parse_error
        try:
            igreja = Igreja.objects.get(pk=igreja_id)
        except Igreja.DoesNotExist:
            return json_error("Igreja not found", status=404)

        recurso = RecursosEducacionais.objects.create(
            titulo=data.get("titulo"),
            descricao=data.get("descricao", ""),
            arquivo=request.FILES["arquivo"],
            igreja=igreja,
        )
        return JsonResponse(
            {"message": "Recurso Educacional created successfully", "recurso_id": recurso.id},
            status=201,
        )


class RecursosEducacionaisUpdate(StaffView):
    def post(self, request, pk):
        try:
            recurso = RecursosEducacionais.objects.get(pk=pk)
        except RecursosEducacionais.DoesNotExist:
            return json_error("Recurso Educacional not found", status=404)

        data, error = get_request_data(request)
        if error:
            return error
        if "titulo" in data:
            recurso.titulo = data.get("titulo") or recurso.titulo
        if "descricao" in data:
            recurso.descricao = data.get("descricao") or recurso.descricao
        if request.FILES.get("arquivo"):
            recurso.arquivo = request.FILES["arquivo"]
        recurso.save()
        return JsonResponse({"message": "Recurso Educacional updated successfully"})


class RecursosEducacionaisDelete(StaffView):
    def post(self, request, pk):
        try:
            recurso = RecursosEducacionais.objects.get(pk=pk)
        except RecursosEducacionais.DoesNotExist:
            return json_error("Recurso Educacional not found", status=404)
        recurso.delete()
        return JsonResponse({"message": "Recurso Educacional deleted successfully"})


class ArquivosIgrejaList(View):
    def get(self, request):
        arquivos = ArquivosIgreja.objects.select_related("igreja")
        igreja_id, error = parse_int(request.GET.get("igreja_id"), "igreja_id", required=False)
        if error:
            return error
        if igreja_id is not None:
            arquivos = arquivos.filter(igreja_id=igreja_id)
        data = [arquivo_payload(arquivo) for arquivo in arquivos]
        return JsonResponse(data, safe=False)


class ArquivosIgrejaDetail(View):
    def get(self, request, pk):
        try:
            arquivo = ArquivosIgreja.objects.select_related("igreja").get(pk=pk)
        except ArquivosIgreja.DoesNotExist:
            return json_error("Arquivo Igreja not found", status=404)
        return JsonResponse(arquivo_payload(arquivo))


class ArquivosIgrejaCreate(StaffView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["nome_arquivo", "igreja_id"])
        if missing:
            return missing
        if not request.FILES.get("arquivo"):
            return json_error("arquivo is required", status=400)

        igreja_id, parse_error = parse_int(data.get("igreja_id"), "igreja_id")
        if parse_error:
            return parse_error
        try:
            igreja = Igreja.objects.get(pk=igreja_id)
        except Igreja.DoesNotExist:
            return json_error("Igreja not found", status=404)

        arquivo = ArquivosIgreja.objects.create(
            igreja=igreja,
            nome_arquivo=data.get("nome_arquivo"),
            arquivo=request.FILES["arquivo"],
        )
        return JsonResponse(
            {"message": "Arquivo Igreja created successfully", "arquivo_id": arquivo.id},
            status=201,
        )


class ArquivosIgrejaUpdate(StaffView):
    def post(self, request, pk):
        try:
            arquivo = ArquivosIgreja.objects.get(pk=pk)
        except ArquivosIgreja.DoesNotExist:
            return json_error("Arquivo Igreja not found", status=404)

        data, error = get_request_data(request)
        if error:
            return error
        if "nome_arquivo" in data:
            arquivo.nome_arquivo = data.get("nome_arquivo") or arquivo.nome_arquivo
        if request.FILES.get("arquivo"):
            arquivo.arquivo = request.FILES["arquivo"]
        arquivo.save()
        return JsonResponse({"message": "Arquivo Igreja updated successfully"})


class ArquivosIgrejaDelete(StaffView):
    def post(self, request, pk):
        try:
            arquivo = ArquivosIgreja.objects.get(pk=pk)
        except ArquivosIgreja.DoesNotExist:
            return json_error("Arquivo Igreja not found", status=404)
        arquivo.delete()
        return JsonResponse({"message": "Arquivo Igreja deleted successfully"})


class PostagensGruposList(AuthenticatedView):
    def get(self, request):
        postagens = PostagensGrupos.objects.select_related("autor__user", "grupo")
        grupo_id, error = parse_int(request.GET.get("grupo_id"), "grupo_id", required=False)
        if error:
            return error
        if grupo_id is not None:
            postagens = postagens.filter(grupo_id=grupo_id)
        if not has_staff_access(request.profile):
            postagens = postagens.filter(
                grupo_id__in=request.profile.grupos.values_list("id", flat=True)
            )
        data = [postagem_payload(postagem) for postagem in postagens]
        return JsonResponse(data, safe=False)


class PostagensGruposDetail(AuthenticatedView):
    def get(self, request, pk):
        try:
            postagem = PostagensGrupos.objects.select_related("autor__user", "grupo").get(pk=pk)
        except PostagensGrupos.DoesNotExist:
            return json_error("Postagem not found", status=404)
        if not is_group_member(request.profile, postagem.grupo):
            return json_error("Forbidden", status=403)
        return JsonResponse(postagem_payload(postagem))


class PostagensGruposCreate(AuthenticatedView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["grupo_id"])
        if missing:
            return missing

        grupo_id, parse_error = parse_int(data.get("grupo_id"), "grupo_id")
        if parse_error:
            return parse_error
        try:
            grupo = Grupos.objects.get(pk=grupo_id)
        except Grupos.DoesNotExist:
            return json_error("Grupo not found", status=404)
        if not is_group_member(request.profile, grupo):
            return json_error("Forbidden", status=403)

        conteudo = data.get("conteudo", "")
        enquete = data.get("enquete")
        link = data.get("link")
        arquivo = request.FILES.get("arquivo")
        if not any([conteudo, enquete, link, arquivo]):
            return json_error("Provide conteudo, enquete, link, or arquivo", status=400)

        postagem = PostagensGrupos.objects.create(
            autor=request.profile,
            grupo=grupo,
            conteudo=conteudo,
            arquivo=arquivo,
            enquete=enquete,
            link=link,
        )
        return JsonResponse(
            {"message": "Postagem created successfully", "postagem_id": postagem.id},
            status=201,
        )


class PostagensGruposUpdate(AuthenticatedView):
    def post(self, request, pk):
        try:
            postagem = PostagensGrupos.objects.select_related("grupo").get(pk=pk)
        except PostagensGrupos.DoesNotExist:
            return json_error("Postagem not found", status=404)
        if postagem.autor_id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)

        data, error = get_request_data(request)
        if error:
            return error
        if "conteudo" in data:
            postagem.conteudo = data.get("conteudo") or postagem.conteudo
        if "enquete" in data:
            postagem.enquete = data.get("enquete")
        if "link" in data:
            postagem.link = data.get("link")
        if request.FILES.get("arquivo"):
            postagem.arquivo = request.FILES["arquivo"]
        postagem.save()
        return JsonResponse({"message": "Postagem updated successfully"})


class PostagensGruposDelete(AuthenticatedView):
    def post(self, request, pk):
        try:
            postagem = PostagensGrupos.objects.get(pk=pk)
        except PostagensGrupos.DoesNotExist:
            return json_error("Postagem not found", status=404)
        if postagem.autor_id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)
        postagem.delete()
        return JsonResponse({"message": "Postagem deleted successfully"})


class ComentariosPostagensList(AuthenticatedView):
    def get(self, request):
        comentarios = ComentariosPostagens.objects.select_related("autor__user", "postagem__grupo")
        postagem_id, error = parse_int(
            request.GET.get("postagem_id"), "postagem_id", required=False
        )
        if error:
            return error
        if postagem_id is not None:
            comentarios = comentarios.filter(postagem_id=postagem_id)
            try:
                postagem = PostagensGrupos.objects.select_related("grupo").get(pk=postagem_id)
            except PostagensGrupos.DoesNotExist:
                return json_error("Postagem not found", status=404)
            if not is_group_member(request.profile, postagem.grupo):
                return json_error("Forbidden", status=403)
        elif not has_staff_access(request.profile):
            comentarios = comentarios.filter(
                postagem__grupo_id__in=request.profile.grupos.values_list("id", flat=True)
            )
        data = [comentario_payload(comentario) for comentario in comentarios]
        return JsonResponse(data, safe=False)


class ComentariosPostagensDetail(AuthenticatedView):
    def get(self, request, pk):
        try:
            comentario = ComentariosPostagens.objects.select_related(
                "autor__user", "postagem__grupo"
            ).get(pk=pk)
        except ComentariosPostagens.DoesNotExist:
            return json_error("Comentario not found", status=404)
        if not is_group_member(request.profile, comentario.postagem.grupo):
            return json_error("Forbidden", status=403)
        return JsonResponse(comentario_payload(comentario))


class ComentariosPostagensCreate(AuthenticatedView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["postagem_id", "conteudo"])
        if missing:
            return missing

        postagem_id, parse_error = parse_int(data.get("postagem_id"), "postagem_id")
        if parse_error:
            return parse_error
        try:
            postagem = PostagensGrupos.objects.select_related("grupo").get(pk=postagem_id)
        except PostagensGrupos.DoesNotExist:
            return json_error("Postagem not found", status=404)
        if not is_group_member(request.profile, postagem.grupo):
            return json_error("Forbidden", status=403)

        comentario = ComentariosPostagens.objects.create(
            postagem=postagem, autor=request.profile, conteudo=data.get("conteudo")
        )
        return JsonResponse(
            {"message": "Comentario created successfully", "comentario_id": comentario.id},
            status=201,
        )


class ComentariosPostagensUpdate(AuthenticatedView):
    def post(self, request, pk):
        try:
            comentario = ComentariosPostagens.objects.select_related("postagem__grupo").get(pk=pk)
        except ComentariosPostagens.DoesNotExist:
            return json_error("Comentario not found", status=404)
        if comentario.autor_id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)

        data, error = get_request_data(request)
        if error:
            return error
        if "conteudo" in data:
            comentario.conteudo = data.get("conteudo") or comentario.conteudo
        comentario.save()
        return JsonResponse({"message": "Comentario updated successfully"})


class ComentariosPostagensDelete(AuthenticatedView):
    def post(self, request, pk):
        try:
            comentario = ComentariosPostagens.objects.get(pk=pk)
        except ComentariosPostagens.DoesNotExist:
            return json_error("Comentario not found", status=404)
        if comentario.autor_id != request.profile.id and not has_staff_access(request.profile):
            return json_error("Forbidden", status=403)
        comentario.delete()
        return JsonResponse({"message": "Comentario deleted successfully"})


class MensagensPrivadasList(AuthenticatedView):
    def get(self, request):
        kind = request.GET.get("kind", "todas")
        mensagens = MensagensPrivadas.objects.select_related("remetente__user", "destinatario__user").filter(
            Q(remetente=request.profile) | Q(destinatario=request.profile)
        )
        if kind == "enviadas":
            mensagens = mensagens.filter(remetente=request.profile)
        elif kind == "recebidas":
            mensagens = mensagens.filter(destinatario=request.profile)
        data = [mensagem_payload(mensagem) for mensagem in mensagens]
        return JsonResponse(data, safe=False)


class MensagensPrivadasDetail(AuthenticatedView):
    def get(self, request, pk):
        try:
            mensagem = MensagensPrivadas.objects.select_related(
                "remetente__user", "destinatario__user"
            ).get(pk=pk)
        except MensagensPrivadas.DoesNotExist:
            return json_error("Mensagem not found", status=404)
        if (
            mensagem.remetente_id != request.profile.id
            and mensagem.destinatario_id != request.profile.id
            and not has_staff_access(request.profile)
        ):
            return json_error("Forbidden", status=403)
        return JsonResponse(mensagem_payload(mensagem))


class MensagensPrivadasCreate(AuthenticatedView):
    def post(self, request):
        data, error = get_request_data(request)
        if error:
            return error
        missing = require_fields(data, ["destinatario_id", "conteudo"])
        if missing:
            return missing

        destinatario_id, parse_error = parse_int(data.get("destinatario_id"), "destinatario_id")
        if parse_error:
            return parse_error
        if destinatario_id == request.profile.id:
            return json_error("destinatario_id must be different", status=400)
        try:
            destinatario = Profile.objects.get(pk=destinatario_id)
        except Profile.DoesNotExist:
            return json_error("Destinatario not found", status=404)

        mensagem = MensagensPrivadas.objects.create(
            remetente=request.profile,
            destinatario=destinatario,
            conteudo=data.get("conteudo"),
        )
        return JsonResponse(
            {"message": "Mensagem created successfully", "mensagem_id": mensagem.id}, status=201
        )


class MensagensPrivadasUpdate(AuthenticatedView):
    def post(self, request, pk):
        try:
            mensagem = MensagensPrivadas.objects.get(pk=pk)
        except MensagensPrivadas.DoesNotExist:
            return json_error("Mensagem not found", status=404)
        if (
            mensagem.remetente_id != request.profile.id
            and mensagem.destinatario_id != request.profile.id
            and not has_staff_access(request.profile)
        ):
            return json_error("Forbidden", status=403)

        data, error = get_request_data(request)
        if error:
            return error
        if "conteudo" in data:
            if mensagem.remetente_id != request.profile.id and not has_staff_access(request.profile):
                return json_error("Forbidden", status=403)
            mensagem.conteudo = data.get("conteudo") or mensagem.conteudo
        if "lida" in data:
            if mensagem.destinatario_id != request.profile.id and not has_staff_access(request.profile):
                return json_error("Forbidden", status=403)
            mensagem.lida = parse_bool(data.get("lida"))
        mensagem.save()
        return JsonResponse({"message": "Mensagem updated successfully"})


class MensagensPrivadasDelete(AuthenticatedView):
    def post(self, request, pk):
        try:
            mensagem = MensagensPrivadas.objects.get(pk=pk)
        except MensagensPrivadas.DoesNotExist:
            return json_error("Mensagem not found", status=404)
        if (
            mensagem.remetente_id != request.profile.id
            and mensagem.destinatario_id != request.profile.id
            and not has_staff_access(request.profile)
        ):
            return json_error("Forbidden", status=403)
        mensagem.delete()
        return JsonResponse({"message": "Mensagem deleted successfully"})
