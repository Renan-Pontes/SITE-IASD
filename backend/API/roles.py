"""
Funções utilitárias de papéis/permissões (RBAC).

Camadas de autorização:
- Global:   Profile.is_super_admin (o Mestre) — pode tudo.
- Igreja:   Membro.papel (ancião/pastor/admin) define liderança local.
- Grupo:    GrupoMembro.cargo (líder/diretor) define liderança do grupo.

Use estas funções em viewsets/serializers para manter a regra num só lugar.
"""

from .models import (
    CargoGrupo,
    GrupoMembro,
    Membro,
    StatusVinculo,
)


def is_super(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    profile = getattr(user, "profile", None)
    return bool(profile and profile.is_super_admin)


def membro_ativo(user, igreja):
    """Retorna o Membro ATIVO do usuário na igreja, ou None."""
    if not user or not user.is_authenticated or igreja is None:
        return None
    igreja_id = getattr(igreja, "pk", igreja)
    return (
        Membro.objects.filter(
            usuario=user, igreja_id=igreja_id, status=StatusVinculo.ATIVO
        )
        .select_related("igreja")
        .first()
    )


def eh_membro(user, igreja):
    return membro_ativo(user, igreja) is not None


def eh_lideranca_igreja(user, igreja):
    """Ancião, pastor ou admin da igreja (ou super admin)."""
    if is_super(user):
        return True
    m = membro_ativo(user, igreja)
    return bool(m and m.eh_lideranca)


def eh_lider_igreja(user, igreja):
    """Líder de igreja (nível entre membro e ancião) — dono do Canal da Liderança."""
    m = membro_ativo(user, igreja)
    return bool(m and m.eh_lider_igreja)


def eh_secretaria(user, igreja):
    """Cargo de secretaria: registra atas e tem acesso amplo (inclusive aos
    votos de pautas anônimas — sob sigilo e com auditoria)."""
    if is_super(user):
        return True
    m = membro_ativo(user, igreja)
    return bool(m and m.secretaria)


def igrejas_lidera_igreja_ids(user):
    """IDs das igrejas onde o usuário é Líder de igreja (papel lider_igreja)."""
    if not user or not user.is_authenticated:
        return []
    from .models import PapelIgreja

    return list(
        Membro.objects.filter(
            usuario=user,
            status=StatusVinculo.ATIVO,
            papel=PapelIgreja.LIDER_IGREJA,
        ).values_list("igreja_id", flat=True)
    )


def pode_votar_pauta(user, pauta):
    """Quem pode registrar voto, conforme o canal da pauta.

    - Canal dos Anciões: anciões/pastores/admins (eleitorado oficial).
    - Canal da Liderança: líderes de igreja (eleitorado) + anciões em caráter
      **consultivo** (o voto não conta para quórum — ver Pauta.votos_que_contam).
    """
    from .models import CanalPauta

    if eh_lideranca_igreja(user, pauta.igreja):
        return True
    if pauta.canal == CanalPauta.LIDERANCA:
        return eh_lider_igreja(user, pauta.igreja)
    return False


def eh_admin_igreja(user, igreja):
    """Administrador da igreja (papel admin_igreja) ou super admin.

    Quem pode aplicar alterações de dados da igreja DIRETAMENTE. Anciões/pastores
    propõem alterações pelo Canal dos Anciões (votação).
    """
    if is_super(user):
        return True
    from .models import PapelIgreja

    m = membro_ativo(user, igreja)
    return bool(m and m.papel == PapelIgreja.ADMIN)


def grupo_membro_ativo(user, grupo):
    if not user or not user.is_authenticated or grupo is None:
        return None
    grupo_id = getattr(grupo, "pk", grupo)
    return (
        GrupoMembro.objects.filter(
            usuario=user, grupo_id=grupo_id, status=StatusVinculo.ATIVO
        )
        .select_related("grupo")
        .first()
    )


def eh_membro_grupo(user, grupo):
    return grupo_membro_ativo(user, grupo) is not None


def eh_lideranca_grupo(user, grupo):
    """Líder/diretor do grupo, liderança da igreja dona, ou super admin."""
    if is_super(user):
        return True
    gm = grupo_membro_ativo(user, grupo)
    if gm and gm.eh_lideranca:
        return True
    # Liderança da igreja também administra os grupos dela.
    igreja = getattr(grupo, "igreja", None)
    return eh_lideranca_igreja(user, igreja)


def igrejas_que_lidera_ids(user):
    """IDs das igrejas onde o usuário é liderança (para filtrar caixas de aprovação)."""
    if not user or not user.is_authenticated:
        return []
    if is_super(user):
        return list(Membro.objects.values_list("igreja_id", flat=True).distinct())
    return list(
        Membro.objects.filter(
            usuario=user,
            status=StatusVinculo.ATIVO,
            papel__in=["anciao", "pastor", "admin_igreja"],
        ).values_list("igreja_id", flat=True)
    )
