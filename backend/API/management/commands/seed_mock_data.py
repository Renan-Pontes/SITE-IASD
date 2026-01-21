from datetime import timedelta, time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from API.models import (
    Church,
    ChurchStaff,
    Event,
    EventParticipation,
    EventUpdate,
    OperatingException,
    OperatingHour,
    Team,
    TeamMembership,
    TeamRole,
)


class Command(BaseCommand):
    help = "Seed mock data for local development."

    def handle(self, *args, **options):
        User = get_user_model()

        def ensure_user(email, name, password, is_staff=False, is_superuser=False):
            user, created = User.objects.get_or_create(
                username=email,
                defaults={"email": email, "first_name": name},
            )
            if created:
                user.set_password(password)
                user.is_staff = is_staff
                user.is_superuser = is_superuser
                user.save()
            else:
                updates = {}
                if not user.email:
                    updates["email"] = email
                if not user.first_name:
                    updates["first_name"] = name
                if is_staff and not user.is_staff:
                    updates["is_staff"] = True
                if is_superuser and not user.is_superuser:
                    updates["is_superuser"] = True
                if updates:
                    for field, value in updates.items():
                        setattr(user, field, value)
                    user.save(update_fields=list(updates.keys()))
            return user, created

        admin_user, admin_created = ensure_user(
            "admin@iasd.local", "Admin", "Admin123!", is_staff=True, is_superuser=True
        )
        elder_user, _ = ensure_user("elder@iasd.local", "Elder", "Elder123!")
        member_user, _ = ensure_user("membro@iasd.local", "Member", "Member123!")

        church, _ = Church.objects.get_or_create(
            name="IASD Central",
            defaults={
                "description": "Igreja Adventista do Setimo Dia - comunidade e servico.",
                "address": "Rua Esperanca, 120 - Centro",
                "phone": "(11) 3456-7890",
                "email": "contato@iasd.local",
                "timezone": "America/Sao_Paulo",
            },
        )

        if not church.description:
            church.description = "Igreja Adventista do Setimo Dia - comunidade e servico."
        if not church.address:
            church.address = "Rua Esperanca, 120 - Centro"
        if not church.phone:
            church.phone = "(11) 3456-7890"
        if not church.email:
            church.email = "contato@iasd.local"
        if not church.timezone:
            church.timezone = "America/Sao_Paulo"
        church.save()

        ChurchStaff.objects.get_or_create(
            church=church,
            user=admin_user,
            defaults={"role": ChurchStaff.ROLE_ADMIN, "added_by": admin_user},
        )
        ChurchStaff.objects.get_or_create(
            church=church,
            user=elder_user,
            defaults={"role": ChurchStaff.ROLE_ELDER, "added_by": admin_user},
        )

        hours = [
            (0, time(8, 0), time(18, 0), False, "Secretaria e atendimento pastoral."),
            (1, time(8, 0), time(18, 0), False, "Secretaria e atendimento pastoral."),
            (2, time(8, 0), time(18, 0), False, "Secretaria e atendimento pastoral."),
            (3, time(8, 0), time(18, 0), False, "Secretaria e atendimento pastoral."),
            (4, time(8, 0), time(18, 0), False, "Secretaria e atendimento pastoral."),
            (5, time(7, 30), time(20, 0), False, "Escola sabatina e culto."),
            (6, None, None, True, "Sem expediente."),
        ]

        for day_of_week, opens_at, closes_at, is_closed, notes in hours:
            OperatingHour.objects.get_or_create(
                church=church,
                day_of_week=day_of_week,
                opens_at=opens_at,
                closes_at=closes_at,
                defaults={"is_closed": is_closed, "notes": notes},
            )

        today = timezone.localdate()
        exceptions = [
            (today + timedelta(days=4), time(19, 30), time(22, 0), False, "Vigilia especial"),
            (today + timedelta(days=10), None, None, True, "Sem expediente"),
        ]

        for date_value, opens_at, closes_at, is_closed, reason in exceptions:
            OperatingException.objects.get_or_create(
                church=church,
                date=date_value,
                defaults={
                    "opens_at": opens_at,
                    "closes_at": closes_at,
                    "is_closed": is_closed,
                    "reason": reason,
                },
            )

        teams = [
            ("Exploradores", "Trilhas, lideranca e servico para adolescentes."),
            ("Musica", "Louvor, coral e escala de instrumentos."),
            ("Acao Solidaria", "Cestas, visitas e cuidado com a comunidade."),
            ("Midia", "Transmissao e comunicacao."),
            ("Infantil", "Atividades para criancas e familias."),
            ("Saude", "Promocao de qualidade de vida."),
        ]

        team_map = {}
        for name, description in teams:
            team, _ = Team.objects.get_or_create(
                church=church,
                name=name,
                defaults={"description": description, "created_by": admin_user},
            )
            if not team.description:
                team.description = description
                team.save(update_fields=["description"])
            team_map[name] = team

        for team in team_map.values():
            leader, _ = TeamRole.objects.get_or_create(
                team=team,
                name="Lider",
                defaults={"rank": 2, "can_manage_chat": True, "can_promote_members": True},
            )
            TeamRole.objects.get_or_create(
                team=team,
                name="Auxiliar",
                defaults={"rank": 1, "can_manage_chat": True, "can_promote_members": False},
            )
            TeamRole.objects.get_or_create(
                team=team,
                name="Membro",
                defaults={"rank": 0, "can_manage_chat": False, "can_promote_members": False},
            )

            if team.name == "Exploradores":
                membership, created = TeamMembership.objects.get_or_create(
                    team=team,
                    user=elder_user,
                    defaults={"role": leader},
                )
                if not created and membership.role is None:
                    membership.role = leader
                    membership.save(update_fields=["role"])

        def build_dt(days, hour, minute=0):
            now = timezone.localtime(timezone.now())
            target = now + timedelta(days=days)
            return target.replace(hour=hour, minute=minute, second=0, microsecond=0)

        events = [
            {
                "title": "Culto de Celebracao",
                "speaker": "Pr. Carlos Almeida",
                "location": "Templo principal",
                "starts_at": build_dt(1, 10, 30),
                "ends_at": build_dt(1, 12, 0),
                "image_url": "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=80",
                "description": "Mensagem especial e louvor.",
                "attendance_mode": Event.ATTENDANCE_CONFIRM,
            },
            {
                "title": "Encontro de Lideres",
                "speaker": "Anciao Marcos Silva",
                "location": "Sala 2",
                "starts_at": build_dt(3, 20, 0),
                "ends_at": build_dt(3, 21, 30),
                "image_url": "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80",
                "description": "Planejamento semanal das equipes.",
                "attendance_mode": Event.ATTENDANCE_CONFIRM,
            },
            {
                "title": "Feira de Saude",
                "speaker": "Equipe Saude",
                "location": "Praca Central",
                "starts_at": build_dt(6, 9, 0),
                "ends_at": build_dt(6, 13, 0),
                "image_url": "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1200&q=80",
                "description": "Acoes comunitarias e atendimento.",
                "attendance_mode": Event.ATTENDANCE_PARTICIPATE,
            },
            {
                "title": "Exploradores em Campo",
                "speaker": "Diretoria Exploradores",
                "location": "Parque do Lago",
                "starts_at": build_dt(10, 14, 0),
                "ends_at": build_dt(10, 18, 0),
                "image_url": "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
                "description": "Atividades ao ar livre.",
                "attendance_mode": Event.ATTENDANCE_PARTICIPATE,
            },
        ]

        event_map = {}
        for item in events:
            event, _ = Event.objects.get_or_create(
                church=church,
                title=item["title"],
                starts_at=item["starts_at"],
                defaults={
                    "ends_at": item["ends_at"],
                    "speaker_name": item["speaker"],
                    "location": item["location"],
                    "image_url": item["image_url"],
                    "description": item["description"],
                    "attendance_mode": item["attendance_mode"],
                    "created_by": admin_user,
                    "is_published": True,
                },
            )
            updates = {}
            if not event.ends_at:
                updates["ends_at"] = item["ends_at"]
            if not event.speaker_name:
                updates["speaker_name"] = item["speaker"]
            if not event.location:
                updates["location"] = item["location"]
            if not event.image_url:
                updates["image_url"] = item["image_url"]
            if not event.description:
                updates["description"] = item["description"]
            if event.attendance_mode != item["attendance_mode"]:
                updates["attendance_mode"] = item["attendance_mode"]
            if updates:
                for field, value in updates.items():
                    setattr(event, field, value)
                event.save(update_fields=list(updates.keys()))
            event_map[item["title"]] = event

        updates = [
            ("Culto de Celebracao", "Escala de recepcao", "Chegue 30 min antes para alinhamento."),
            ("Encontro de Lideres", "Materiais da reuniao", "Levar o relatorio das equipes."),
            ("Feira de Saude", "Voluntarios", "Lista aberta ate quarta-feira."),
        ]

        for event_title, title, content in updates:
            event = event_map.get(event_title)
            if not event:
                continue
            EventUpdate.objects.get_or_create(
                event=event,
                title=title,
                defaults={"content": content, "created_by": admin_user, "is_published": True},
            )

        for title in ["Culto de Celebracao", "Feira de Saude"]:
            event = event_map.get(title)
            if not event:
                continue
            EventParticipation.objects.update_or_create(
                event=event,
                user=member_user,
                defaults={
                    "status": EventParticipation.STATUS_CONFIRMED,
                    "confirmed_at": timezone.now(),
                },
            )

        self.stdout.write(self.style.SUCCESS("Mock data seeded successfully."))
        if admin_created:
            self.stdout.write(
                self.style.WARNING("Admin user created: admin@iasd.local / Admin123!")
            )
