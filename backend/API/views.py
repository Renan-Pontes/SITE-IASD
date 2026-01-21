import json
import secrets

from django.contrib.auth import authenticate, get_user_model
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import AuthToken, Church, Event, EventParticipation, EventUpdate, Team

DAY_LABELS = {
    0: "Segunda",
    1: "Terca",
    2: "Quarta",
    3: "Quinta",
    4: "Sexta",
    5: "Sabado",
    6: "Domingo",
}


def _format_time(value):
    if not value:
        return None
    return value.strftime("%H:%M")


def _format_date(value):
    if not value:
        return None
    return value.isoformat()


def _format_datetime(value):
    if not value:
        return None
    return value.isoformat()


def _parse_limit(request):
    raw_value = request.GET.get("limit", "0")
    try:
        return max(int(raw_value or 0), 0)
    except (TypeError, ValueError):
        return 0


def _json_response(payload, status=200):
    response = JsonResponse(payload, status=status, safe=not isinstance(payload, list))
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


def _parse_json(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None


def _get_token_key(request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Token "):
        return auth_header.split(" ", 1)[1].strip()
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


def _get_authenticated_user(request):
    token_key = _get_token_key(request)
    if not token_key:
        return None
    try:
        token = AuthToken.objects.select_related("user").get(key=token_key)
    except AuthToken.DoesNotExist:
        return None
    token.last_used_at = timezone.now()
    token.save(update_fields=["last_used_at"])
    return token.user


def _issue_token(user):
    key = secrets.token_hex(20)
    token, _ = AuthToken.objects.update_or_create(
        user=user,
        defaults={"key": key, "last_used_at": timezone.now()},
    )
    return token


@require_GET
def church_detail(request):
    church = Church.objects.filter(is_active=True).first()
    if not church:
        return _json_response({"detail": "No active church configured."}, status=404)

    hours = [
        {
            "id": hour.id,
            "day_of_week": hour.day_of_week,
            "day_label": DAY_LABELS.get(hour.day_of_week, "Dia"),
            "opens_at": _format_time(hour.opens_at),
            "closes_at": _format_time(hour.closes_at),
            "is_closed": hour.is_closed,
            "notes": hour.notes,
        }
        for hour in church.operating_hours.all().order_by("day_of_week", "opens_at")
    ]

    exceptions = [
        {
            "id": exception.id,
            "date": _format_date(exception.date),
            "opens_at": _format_time(exception.opens_at),
            "closes_at": _format_time(exception.closes_at),
            "is_closed": exception.is_closed,
            "reason": exception.reason,
        }
        for exception in church.operating_exceptions.all().order_by("-date")[:10]
    ]

    payload = {
        "id": church.id,
        "name": church.name,
        "description": church.description,
        "address": church.address,
        "phone": church.phone,
        "email": church.email,
        "timezone": church.timezone,
        "operating_hours": hours,
        "operating_exceptions": exceptions,
    }
    return _json_response(payload)


@require_GET
def events_list(request):
    limit = _parse_limit(request)
    queryset = Event.objects.filter(is_published=True, ends_at__gte=timezone.now()).order_by(
        "starts_at"
    )
    if limit > 0:
        queryset = queryset[:limit]

    events = [
        {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "speaker_name": event.speaker_name,
            "location": event.location,
            "starts_at": _format_datetime(event.starts_at),
            "ends_at": _format_datetime(event.ends_at),
            "image_url": event.image_url,
            "capacity": event.capacity,
            "attendance_mode": event.attendance_mode,
        }
        for event in queryset
    ]
    return _json_response({"results": events})


@require_GET
def teams_list(request):
    limit = _parse_limit(request)
    queryset = Team.objects.filter(is_active=True).order_by("name")
    if limit > 0:
        queryset = queryset[:limit]

    teams = [
        {
            "id": team.id,
            "name": team.name,
            "description": team.description,
        }
        for team in queryset
    ]
    return _json_response({"results": teams})


@require_GET
def event_updates_list(request):
    limit = _parse_limit(request)
    queryset = (
        EventUpdate.objects.filter(is_published=True)
        .select_related("event")
        .order_by("-created_at")
    )
    if limit > 0:
        queryset = queryset[:limit]

    updates = [
        {
            "id": update.id,
            "title": update.title,
            "content": update.content,
            "event_title": update.event.title,
            "created_at": _format_datetime(update.created_at),
        }
        for update in queryset
    ]
    return _json_response({"results": updates})


@require_GET
def participations_list(request):
    user = _get_authenticated_user(request)
    if not user:
        return _json_response({"detail": "Auth token required."}, status=401)

    participations = (
        EventParticipation.objects.filter(
            user_id=user.id, status=EventParticipation.STATUS_CONFIRMED
        )
        .select_related("event")
        .order_by("event__starts_at")
    )

    data = [
        {
            "id": participation.id,
            "event_id": participation.event_id,
            "event_title": participation.event.title,
            "event_location": participation.event.location,
            "starts_at": _format_datetime(participation.event.starts_at),
            "ends_at": _format_datetime(participation.event.ends_at),
            "confirmed_at": _format_datetime(participation.confirmed_at),
        }
        for participation in participations
    ]
    return _json_response({"results": data})


@csrf_exempt
@require_POST
def confirm_event(request, event_id):
    payload = _parse_json(request)
    if payload is None:
        return _json_response({"detail": "Invalid JSON payload."}, status=400)

    user = _get_authenticated_user(request)
    if not user:
        return _json_response({"detail": "Auth token required."}, status=401)

    status = payload.get("status", EventParticipation.STATUS_CONFIRMED)

    if status not in dict(EventParticipation.STATUS_CHOICES):
        return _json_response({"detail": "Invalid status value."}, status=400)

    try:
        event = Event.objects.get(id=event_id, is_published=True)
    except Event.DoesNotExist:
        return _json_response({"detail": "Event not found."}, status=404)

    confirmed_at = timezone.now() if status == EventParticipation.STATUS_CONFIRMED else None

    participation, _ = EventParticipation.objects.update_or_create(
        event=event,
        user_id=user.id,
        defaults={"status": status, "confirmed_at": confirmed_at},
    )

    return _json_response(
        {
            "id": participation.id,
            "event_id": participation.event_id,
            "user_id": participation.user_id,
            "status": participation.status,
            "confirmed_at": _format_datetime(participation.confirmed_at),
        }
    )


@csrf_exempt
@require_POST
def register_user(request):
    payload = _parse_json(request)
    if payload is None:
        return _json_response({"detail": "Invalid JSON payload."}, status=400)

    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not name or not email or not password:
        return _json_response({"detail": "Name, email, and password are required."}, status=400)

    user_model = get_user_model()
    if user_model.objects.filter(username__iexact=email).exists() or user_model.objects.filter(
        email__iexact=email
    ).exists():
        return _json_response({"detail": "Email already registered."}, status=400)

    user = user_model.objects.create_user(username=email, email=email, password=password)
    user.first_name = name
    user.save(update_fields=["first_name"])

    token = _issue_token(user)

    return _json_response(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "name": user.first_name,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            },
        },
        status=201,
    )


@csrf_exempt
@require_POST
def login_user(request):
    payload = _parse_json(request)
    if payload is None:
        return _json_response({"detail": "Invalid JSON payload."}, status=400)

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        return _json_response({"detail": "Email and password are required."}, status=400)

    user = authenticate(request, username=email, password=password)
    if not user:
        user_model = get_user_model()
        try:
            candidate = user_model.objects.get(email__iexact=email)
        except user_model.DoesNotExist:
            candidate = None
        if candidate and candidate.check_password(password):
            user = candidate

    if not user:
        return _json_response({"detail": "Invalid credentials."}, status=401)

    token = _issue_token(user)

    return _json_response(
        {
            "token": token.key,
            "user": {
                "id": user.id,
                "name": user.first_name,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            },
        }
    )


@require_GET
def auth_me(request):
    user = _get_authenticated_user(request)
    if not user:
        return _json_response({"detail": "Auth token required."}, status=401)
    return _json_response(
        {
            "id": user.id,
            "name": user.first_name,
            "email": user.email,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        }
    )


@csrf_exempt
@require_POST
def logout_user(request):
    token_key = _get_token_key(request)
    if not token_key:
        return _json_response({"detail": "Auth token required."}, status=401)
    AuthToken.objects.filter(key=token_key).delete()
    return _json_response({"detail": "Logged out."})


def options_handler(request):
    response = HttpResponse()
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response
