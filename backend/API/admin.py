from django.contrib import admin

from .models import (
    AuthToken,
    Church,
    ChurchStaff,
    Event,
    EventParticipation,
    EventUpdate,
    OperatingException,
    OperatingHour,
    Team,
    TeamChatMessage,
    TeamMembership,
    TeamRole,
)


class OperatingHourInline(admin.TabularInline):
    model = OperatingHour
    extra = 0


class OperatingExceptionInline(admin.TabularInline):
    model = OperatingException
    extra = 0


@admin.register(Church)
class ChurchAdmin(admin.ModelAdmin):
    list_display = ("name", "timezone", "is_active", "updated_at")
    search_fields = ("name", "address", "email")
    inlines = [OperatingHourInline, OperatingExceptionInline]


@admin.register(OperatingHour)
class OperatingHourAdmin(admin.ModelAdmin):
    list_display = ("church", "day_of_week", "opens_at", "closes_at", "is_closed")
    list_filter = ("church", "day_of_week", "is_closed")


@admin.register(OperatingException)
class OperatingExceptionAdmin(admin.ModelAdmin):
    list_display = ("church", "date", "opens_at", "closes_at", "is_closed")
    list_filter = ("church", "is_closed")


@admin.register(ChurchStaff)
class ChurchStaffAdmin(admin.ModelAdmin):
    list_display = ("church", "user", "role", "is_active", "added_at")
    list_filter = ("church", "role", "is_active")
    search_fields = ("user__username", "user__email")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "is_active", "created_at")
    list_filter = ("church", "is_active")
    search_fields = ("name",)


@admin.register(TeamRole)
class TeamRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "team", "rank", "can_manage_chat", "can_promote_members")
    list_filter = ("team", "can_manage_chat", "can_promote_members")


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = ("team", "user", "role", "is_active", "joined_at")
    list_filter = ("team", "role", "is_active")
    search_fields = ("user__username", "user__email")


@admin.register(TeamChatMessage)
class TeamChatMessageAdmin(admin.ModelAdmin):
    list_display = ("team", "author", "created_at")
    list_filter = ("team",)
    search_fields = ("author__username", "author__email", "content")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "church",
        "speaker_name",
        "attendance_mode",
        "starts_at",
        "ends_at",
        "is_published",
    )
    list_filter = ("church", "is_published", "attendance_mode")
    search_fields = ("title", "description", "location", "speaker_name")


@admin.register(EventParticipation)
class EventParticipationAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("user__username", "user__email", "event__title")


@admin.register(EventUpdate)
class EventUpdateAdmin(admin.ModelAdmin):
    list_display = ("event", "title", "created_by", "created_at", "is_published")
    list_filter = ("is_published",)
    search_fields = ("title", "content")


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "key", "created_at", "last_used_at")
    search_fields = ("user__username", "user__email", "key")
