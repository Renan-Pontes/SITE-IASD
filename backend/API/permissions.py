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
