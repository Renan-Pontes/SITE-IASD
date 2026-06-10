"""Permission classes do DRF para o RBAC do projeto."""

from rest_framework import permissions

from . import roles


class IsSuperAdmin(permissions.BasePermission):
    message = "Apenas o administrador geral pode fazer isso."

    def has_permission(self, request, view):
        return roles.is_super(request.user)


class ReadOnlyOrSuperAdmin(permissions.BasePermission):
    """Leitura liberada; escrita só para super admin."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return roles.is_super(request.user)


class IsAuthenticatedOrReadOnly(permissions.IsAuthenticatedOrReadOnly):
    pass


class PodeVerAuditoria(permissions.BasePermission):
    """Auditoria: super admin, ou liderança/secretaria de qualquer igreja."""

    message = "Apenas a liderança, a secretaria ou o administrador geral veem a auditoria."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if roles.is_super(user):
            return True
        from .models import Membro, PapelIgreja, StatusVinculo

        return Membro.objects.filter(
            usuario=user,
            status=StatusVinculo.ATIVO,
        ).filter(
            models_q_lideranca_ou_secretaria()
        ).exists()


def models_q_lideranca_ou_secretaria():
    from django.db.models import Q

    from .models import PapelIgreja

    return Q(papel__in=[PapelIgreja.ANCIAO, PapelIgreja.PASTOR, PapelIgreja.ADMIN]) | Q(secretaria=True)
