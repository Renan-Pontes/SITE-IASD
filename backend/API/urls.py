from django.urls import path

from . import views

urlpatterns = [
    path("church/", views.church_detail, name="church-detail"),
    path("events/", views.events_list, name="events-list"),
    path("teams/", views.teams_list, name="teams-list"),
    path("event-updates/", views.event_updates_list, name="event-updates-list"),
    path("participations/", views.participations_list, name="participations-list"),
    path("events/<int:event_id>/confirm/", views.confirm_event, name="event-confirm"),
    path("auth/register/", views.register_user, name="auth-register"),
    path("auth/login/", views.login_user, name="auth-login"),
    path("auth/me/", views.auth_me, name="auth-me"),
    path("auth/logout/", views.logout_user, name="auth-logout"),
    path("options/", views.options_handler, name="options-handler"),
]
