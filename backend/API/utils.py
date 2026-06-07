"""Helpers de auditoria, notificações e geolocalização."""

import math

from .models import AuditLog, Notificacao


def log_acao(user, acao, entidade="", entidade_id=None, detalhes=None):
    """Registra uma ação no log de auditoria (governança)."""
    autor = user if getattr(user, "is_authenticated", False) else None
    return AuditLog.objects.create(
        usuario=autor,
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        detalhes=detalhes,
    )


def notificar(usuario, titulo, mensagem="", tipo="", link=""):
    """Cria uma notificação in-app para o usuário."""
    if usuario is None:
        return None
    return Notificacao.objects.create(
        usuario=usuario, titulo=titulo, mensagem=mensagem, tipo=tipo, link=link
    )


def haversine_km(lat1, lon1, lat2, lon2):
    """Distância em km entre duas coordenadas (fórmula de Haversine)."""
    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.asin(math.sqrt(a))
