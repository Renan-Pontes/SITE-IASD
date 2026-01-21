from django.urls import path

from . import views

urlpatterns = [
    #authentication
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),

    #igrejas
    path('igrejas/', views.IgrejaList.as_view(), name='igreja-list'),
    path('igrejas/<int:pk>/', views.IgrejaDetail.as_view(), name='igreja-detail'),

    #grupos
    path('grupos/', views.GruposList.as_view(), name='grupos-list'),
    path('grupos/<int:pk>/', views.GruposDetail.as_view(), name='grupos-detail'),
    
    #profiles
    path('profiles/', views.ProfileList.as_view(), name='profile-list'),
    path('profiles/<int:pk>/', views.ProfileDetail.as_view(), name='profile-detail'),
    path('profiles/notify/', views.ProfileNotify.as_view(), name='profile-notify'),
    path('profiles/<int:pk>/update/', views.ProfileUpdate.as_view(), name='profile-update'),
    path('profiles/<int:pk>/delete/', views.ProfileDelete.as_view(), name='profile-delete'),

    #events
    path('events/', views.EventsList.as_view(), name='events-list'),
    path('events/<int:pk>/', views.EventsDetail.as_view(), name='events-detail'),
    path('events/create/', views.EventsCreate.as_view(), name='events-create'),
    path('events/<int:pk>/update/', views.EventsUpdate.as_view(), name='events-update'),
    path('events/<int:pk>/delete/', views.EventsDelete.as_view(), name='events-delete'),

    #atividades
    path('atividades/', views.AtividadesList.as_view(), name='atividades-list'),
    path('atividades/<int:pk>/', views.AtividadesDetail.as_view(), name='atividades-detail'),
    path('atividades/create/', views.AtividadesCreate.as_view(), name='atividades-create'),
    path('atividades/<int:pk>/update/', views.AtividadesUpdate.as_view(), name='atividades-update'),
    path('atividades/<int:pk>/delete/', views.AtividadesDelete.as_view(), name='atividades-delete'),

    #comunicados
    path('comunicados/', views.ComunicadosList.as_view(), name='comunicados-list'),
    path('comunicados/<int:pk>/', views.ComunicadosDetail.as_view(), name='comunicados-detail'),
    path('comunicados/create/', views.ComunicadosCreate.as_view(), name='comunicados-create'),
    path('comunicados/<int:pk>/update/', views.ComunicadosUpdate.as_view(), name='comunicados-update'),
    path('comunicados/<int:pk>/delete/', views.ComunicadosDelete.as_view(), name='comunicados-delete'),

    #avisos
    path('avisos/', views.AvisosList.as_view(), name='avisos-list'),
    path('avisos/<int:pk>/', views.AvisosDetail.as_view(), name='avisos-detail'),
    path('avisos/create/', views.AvisosCreate.as_view(), name='avisos-create'),
    path('avisos/<int:pk>/update/', views.AvisosUpdate.as_view(), name='avisos-update'),
    path('avisos/<int:pk>/delete/', views.AvisosDelete.as_view(), name='avisos-delete'),

    #notificacoes grupos
    path('notificacoes-grupos/', views.NotificacoesGruposList.as_view(), name='notificacoes-grupos-list'),
    path('notificacoes-grupos/<int:pk>/', views.NotificacoesGruposDetail.as_view(), name='notificacoes-grupos-detail'),
    path('notificacoes-grupos/create/', views.NotificacoesGruposCreate.as_view(), name='notificacoes-grupos-create'),
    path('notificacoes-grupos/<int:pk>/update/', views.NotificacoesGruposUpdate.as_view(), name='notificacoes-grupos-update'),
    path('notificacoes-grupos/<int:pk>/delete/', views.NotificacoesGruposDelete.as_view(), name='notificacoes-grupos-delete'),  

    #recursos educacionais
    path('recursos-educacionais/', views.RecursosEducacionaisList.as_view(), name='recursos-educacionais-list'),
    path('recursos-educacionais/<int:pk>/', views.RecursosEducacionaisDetail.as_view(), name='recursos-educacionais-detail'),
    path('recursos-educacionais/create/', views.RecursosEducacionaisCreate.as_view(), name='recursos-educacionais-create'),
    path('recursos-educacionais/<int:pk>/update/', views.RecursosEducacionaisUpdate.as_view(), name='recursos-educacionais-update'),
    path('recursos-educacionais/<int:pk>/delete/', views.RecursosEducacionaisDelete.as_view(), name='recursos-educacionais-delete'),    

    #arquivos igreja
    path('arquivos-igreja/', views.ArquivosIgrejaList.as_view(), name='arquivos-igreja-list'),
    path('arquivos-igreja/<int:pk>/', views.ArquivosIgrejaDetail.as_view(), name='arquivos-igreja-detail'),
    path('arquivos-igreja/create/', views.ArquivosIgrejaCreate.as_view(), name='arquivos-igreja-create'),
    path('arquivos-igreja/<int:pk>/update/', views.ArquivosIgrejaUpdate.as_view(), name='arquivos-igreja-update'),
    path('arquivos-igreja/<int:pk>/delete/', views.ArquivosIgrejaDelete.as_view(), name='arquivos-igreja-delete'),

    #postagens grupos
    path('postagens-grupos/', views.PostagensGruposList.as_view(), name='postagens-grupos-list'),
    path('postagens-grupos/<int:pk>/', views.PostagensGruposDetail.as_view(), name='postagens-grupos-detail'),
    path('postagens-grupos/create/', views.PostagensGruposCreate.as_view(), name='postagens-grupos-create'),
    path('postagens-grupos/<int:pk>/update/', views.PostagensGruposUpdate.as_view(), name='postagens-grupos-update'),
    path('postagens-grupos/<int:pk>/delete/', views.PostagensGruposDelete.as_view(), name='postagens-grupos-delete'),

    #comentarios postagens
    path('comentarios-postagens/', views.ComentariosPostagensList.as_view(), name='comentarios-postagens-list'),
    path('comentarios-postagens/<int:pk>/', views.ComentariosPostagensDetail.as_view(), name='comentarios-postagens-detail'),
    path('comentarios-postagens/create/', views.ComentariosPostagensCreate.as_view(), name='comentarios-postagens-create'),
    path('comentarios-postagens/<int:pk>/update/', views.ComentariosPostagensUpdate.as_view(), name='comentarios-postagens-update'),
    path('comentarios-postagens/<int:pk>/delete/', views.ComentariosPostagensDelete.as_view(), name='comentarios-postagens-delete'),    

    #mensagens privadas
    path('mensagens-privadas/', views.MensagensPrivadasList.as_view(), name='mensagens-privadas-list'),
    path('mensagens-privadas/<int:pk>/', views.MensagensPrivadasDetail.as_view(), name='mensagens-privadas-detail'),
    path('mensagens-privadas/create/', views.MensagensPrivadasCreate.as_view(), name='mensagens-privadas-create'),
    path('mensagens-privadas/<int:pk>/update/', views.MensagensPrivadasUpdate.as_view(), name='mensagens-privadas-update'),
    path('mensagens-privadas/<int:pk>/delete/', views.MensagensPrivadasDelete.as_view(), name='mensagens-privadas-delete'),     



]
