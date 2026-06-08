"""Rotas da API — IASD Gestão."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from . import views

router = DefaultRouter()
router.register("igrejas", views.IgrejaViewSet, basename="igreja")
router.register("membros", views.MembroViewSet, basename="membro")
router.register("grupos", views.GrupoViewSet, basename="grupo")
router.register("grupo-membros", views.GrupoMembroViewSet, basename="grupomembro")
router.register("salas", views.SalaViewSet, basename="sala")
router.register("eventos", views.EventoViewSet, basename="evento")
router.register("pautas", views.PautaViewSet, basename="pauta")
router.register("pauta-comentarios", views.PautaComentarioViewSet, basename="pautacomentario")
router.register("notificacoes", views.NotificacaoViewSet, basename="notificacao")
router.register("auditoria", views.AuditLogViewSet, basename="auditoria")

urlpatterns = [
    # Healthcheck + busca global
    path("health/", views.health, name="health"),
    path("search/", views.search, name="search"),
    # Autenticação (JWT)
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/me/foto/", views.MeFotoView.as_view(), name="me-foto"),
    path("auth/trocar-senha/", views.TrocarSenhaView.as_view(), name="trocar-senha"),
    # Agregadores
    path("dashboard/", views.dashboard, name="dashboard"),
    path("calendario/", views.CalendarioView.as_view(), name="calendario"),
    # Recursos REST
    path("", include(router.urls)),
]
