"""Helpers de auditoria, notificações, geolocalização e recorrência."""

import calendar
import math

from .models import AuditLog, Notificacao


def proximo_mensal(dt):
    """
    Próxima ocorrência mensal mantendo o mesmo "Nth dia-da-semana" do mês
    (ex.: 2ª terça-feira, último domingo). Pula meses sem essa ocorrência
    (ex.: 5ª sexta). Mantém hora/minuto e timezone de `dt`. Retorna None se
    não achar nos próximos meses.
    """
    ordinal = (dt.day - 1) // 7  # 0-based: 0 = 1ª ocorrência do mês
    wd = dt.weekday()
    y, m = dt.year, dt.month
    for _ in range(13):
        m += 1
        if m > 12:
            m = 1
            y += 1
        primeiro_wd = dt.replace(year=y, month=m, day=1).weekday()
        offset = (wd - primeiro_wd) % 7
        dia = 1 + offset + ordinal * 7
        if dia <= calendar.monthrange(y, m)[1]:
            return dt.replace(year=y, month=m, day=dia)
    return None


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
