"""Admin do Django — visão administrativa completa para o super admin (Mestre)."""

from django.contrib import admin

from .models import (
    AuditLog,
    Evento,
    Grupo,
    GrupoMembro,
    Igreja,
    Inscricao,
    Membro,
    Mensagem,
    Notificacao,
    Pauta,
    Profile,
    Sala,
    Voto,
)


class MembroInline(admin.TabularInline):
    model = Membro
    extra = 0
    autocomplete_fields = ["usuario"]


class SalaInline(admin.TabularInline):
    model = Sala
    extra = 0


@admin.register(Igreja)
class IgrejaAdmin(admin.ModelAdmin):
    list_display = ["nome", "cidade", "estado", "ativo", "criado_em"]
    list_filter = ["ativo", "estado", "cidade"]
    search_fields = ["nome", "cidade", "endereco"]
    prepopulated_fields = {"slug": ("nome",)}
    inlines = [SalaInline, MembroInline]


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "telefone", "igreja_principal", "is_super_admin"]
    list_filter = ["is_super_admin", "fonte_grande"]
    search_fields = ["user__username", "user__email", "user__first_name", "user__last_name"]
    autocomplete_fields = ["igreja_principal"]


@admin.register(Membro)
class MembroAdmin(admin.ModelAdmin):
    list_display = ["usuario", "igreja", "papel", "status", "data_entrada"]
    list_filter = ["papel", "status", "igreja"]
    search_fields = ["usuario__username", "usuario__email"]
    autocomplete_fields = ["usuario", "igreja"]


@admin.register(Grupo)
class GrupoAdmin(admin.ModelAdmin):
    list_display = ["nome", "igreja", "tipo", "ativo", "criado_em"]
    list_filter = ["tipo", "ativo", "igreja"]
    search_fields = ["nome", "descricao"]


@admin.register(GrupoMembro)
class GrupoMembroAdmin(admin.ModelAdmin):
    list_display = ["usuario", "grupo", "cargo", "status"]
    list_filter = ["cargo", "status"]
    search_fields = ["usuario__username", "grupo__nome"]


@admin.register(Sala)
class SalaAdmin(admin.ModelAdmin):
    list_display = ["nome", "igreja", "capacidade", "ativo"]
    list_filter = ["ativo", "igreja"]
    search_fields = ["nome"]


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = ["titulo", "igreja", "grupo", "inicio", "status", "visibilidade"]
    list_filter = ["status", "visibilidade", "igreja", "recorrencia"]
    search_fields = ["titulo", "descricao"]
    date_hierarchy = "inicio"
    autocomplete_fields = ["igreja"]


@admin.register(Inscricao)
class InscricaoAdmin(admin.ModelAdmin):
    list_display = ["usuario", "evento", "status", "criado_em"]
    list_filter = ["status"]


@admin.register(Pauta)
class PautaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "igreja", "status", "anonima", "prazo_votacao", "criado_em"]
    list_filter = ["status", "anonima", "igreja"]
    search_fields = ["titulo", "descricao"]


@admin.register(Voto)
class VotoAdmin(admin.ModelAdmin):
    list_display = ["pauta", "usuario", "opcao", "criado_em"]
    list_filter = ["opcao"]


@admin.register(Mensagem)
class MensagemAdmin(admin.ModelAdmin):
    list_display = ["grupo", "autor", "criado_em"]
    search_fields = ["conteudo"]


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ["usuario", "titulo", "tipo", "lida", "criado_em"]
    list_filter = ["lida", "tipo"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["criado_em", "usuario", "acao", "entidade", "entidade_id"]
    list_filter = ["acao", "entidade"]
    search_fields = ["acao", "entidade"]
    readonly_fields = ["usuario", "acao", "entidade", "entidade_id", "detalhes", "criado_em"]
