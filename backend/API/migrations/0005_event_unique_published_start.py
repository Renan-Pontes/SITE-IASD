from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("API", "0004_event_attendance_mode"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="event",
            constraint=models.UniqueConstraint(
                fields=("church", "starts_at"),
                condition=Q(is_published=True),
                name="unique_published_event_start_per_church",
            ),
        ),
    ]
