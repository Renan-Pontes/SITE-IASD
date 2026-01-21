from django.contrib import admin

from .models import (
    Igreja,
    Grupos,
    Profile,
    Events,
    Atividades,
    Comunicados,
    Avisos,
    NotificacoesGrupos,
    ComentariosPostagens,
    MensagensPrivadas,
    RecursosEducacionais,
    ArquivosIgreja,
    PostagensGrupos,
    AuthToken,
)

admin.site.register(Igreja)
admin.site.register(Grupos)
admin.site.register(Profile)
admin.site.register(Events)
admin.site.register(Atividades)
admin.site.register(Comunicados)
admin.site.register(Avisos)
admin.site.register(NotificacoesGrupos)
admin.site.register(ComentariosPostagens)
admin.site.register(MensagensPrivadas)
admin.site.register(RecursosEducacionais)
admin.site.register(ArquivosIgreja)
admin.site.register(PostagensGrupos)
admin.site.register(AuthToken)

