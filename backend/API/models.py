from django.conf import settings
from django.db import models


class Church(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Church"
        verbose_name_plural = "Churches"

    def __str__(self):
        return self.name


class OperatingHour(models.Model):
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6

    DAY_CHOICES = [
        (MONDAY, "Monday"),
        (TUESDAY, "Tuesday"),
        (WEDNESDAY, "Wednesday"),
        (THURSDAY, "Thursday"),
        (FRIDAY, "Friday"),
        (SATURDAY, "Saturday"),
        (SUNDAY, "Sunday"),
    ]

    church = models.ForeignKey(
        Church, on_delete=models.CASCADE, related_name="operating_hours"
    )
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["church", "day_of_week", "opens_at"]
        indexes = [models.Index(fields=["church", "day_of_week"])]

    def __str__(self):
        label = dict(self.DAY_CHOICES).get(self.day_of_week, "Unknown")
        return f"{self.church} - {label}"


class OperatingException(models.Model):
    church = models.ForeignKey(
        Church, on_delete=models.CASCADE, related_name="operating_exceptions"
    )
    date = models.DateField()
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date"]
        indexes = [models.Index(fields=["church", "date"])]

    def __str__(self):
        return f"{self.church} - {self.date}"


class ChurchStaff(models.Model):
    ROLE_ELDER = "ELDER"
    ROLE_ADMIN = "ADMIN"
    ROLE_STAFF = "STAFF"

    ROLE_CHOICES = [
        (ROLE_ELDER, "Elder"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_STAFF, "Staff"),
    ]

    church = models.ForeignKey(
        Church, on_delete=models.CASCADE, related_name="staff_members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="church_roles"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="church_staff_added",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("church", "user")
        indexes = [models.Index(fields=["church", "role"])]

    def __str__(self):
        return f"{self.user} - {self.role}"


class Team(models.Model):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="teams_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("church", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class TeamRole(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=80)
    rank = models.PositiveIntegerField(default=0)
    can_manage_chat = models.BooleanField(default=False)
    can_promote_members = models.BooleanField(default=False)

    class Meta:
        unique_together = ("team", "name")
        ordering = ["team", "-rank", "name"]

    def __str__(self):
        return f"{self.team} - {self.name}"


class TeamMembership(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="team_memberships"
    )
    role = models.ForeignKey(
        TeamRole,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="memberships",
    )
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    promoted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="team_promotions",
    )
    promoted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("team", "user")
        indexes = [models.Index(fields=["team", "user"])]

    def __str__(self):
        return f"{self.user} - {self.team}"


class TeamChatMessage(models.Model):
    team = models.ForeignKey(
        Team, on_delete=models.CASCADE, related_name="chat_messages"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="team_messages"
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.team} - {self.author}"


class Event(models.Model):
    ATTENDANCE_CONFIRM = "CONFIRM"
    ATTENDANCE_PARTICIPATE = "PARTICIPATE"

    ATTENDANCE_CHOICES = [
        (ATTENDANCE_CONFIRM, "Confirm presence"),
        (ATTENDANCE_PARTICIPATE, "Participate"),
    ]

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    speaker_name = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=200, blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    image_url = models.URLField(blank=True)
    attendance_mode = models.CharField(
        max_length=20, choices=ATTENDANCE_CHOICES, default=ATTENDANCE_CONFIRM
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events_created",
    )
    is_published = models.BooleanField(default=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-starts_at"]
        indexes = [models.Index(fields=["church", "starts_at"])]

    def __str__(self):
        return f"{self.title} - {self.church}"


class EventParticipation(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="participants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_participations",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("event", "user")
        indexes = [models.Index(fields=["event", "status"])]

    def __str__(self):
        return f"{self.user} - {self.event}"


class EventUpdate(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="updates")
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="event_updates_created",
    )
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event} - {self.title}"


class AuthToken(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_token"
    )
    key = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Token for {self.user}"
