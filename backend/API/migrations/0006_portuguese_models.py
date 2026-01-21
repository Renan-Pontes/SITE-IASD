from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("API", "0005_event_unique_published_start"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Igreja",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("nome", models.CharField(max_length=255)),
                ("endereco", models.CharField(max_length=255)),
                ("telefone", models.CharField(max_length=20)),
                ("email", models.EmailField(max_length=254)),
            ],
        ),
        migrations.CreateModel(
            name="Grupos",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("nome", models.CharField(max_length=255)),
                ("descricao", models.TextField()),
                (
                    "igreja",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.igreja"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Profile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("telefone", models.CharField(blank=True, max_length=20, null=True)),
                (
                    "image",
                    models.ImageField(blank=True, null=True, upload_to="profile_images/"),
                ),
                ("bio", models.TextField(blank=True, null=True)),
                ("is_admin", models.BooleanField(default=False)),
                ("is_elder", models.BooleanField(default=False)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "igrejas",
                    models.ManyToManyField(blank=True, to="API.igreja"),
                ),
                (
                    "grupos",
                    models.ManyToManyField(blank=True, to="API.grupos"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Events",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("titulo", models.CharField(max_length=255)),
                ("descricao", models.TextField()),
                ("data_inicio", models.DateTimeField()),
                ("data_fim", models.DateTimeField()),
                (
                    "igreja",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.igreja"),
                ),
                (
                    "participantes",
                    models.ManyToManyField(blank=True, to="API.profile"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Atividades",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("nome", models.CharField(max_length=255)),
                ("descricao", models.TextField()),
                ("data", models.DateTimeField()),
                (
                    "Grupo",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.grupos"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Comunicados",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("titulo", models.CharField(max_length=255)),
                ("mensagem", models.TextField()),
                ("data_envio", models.DateTimeField(auto_now_add=True)),
                (
                    "igreja",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.igreja"),
                ),
                (
                    "destinatarios",
                    models.ManyToManyField(blank=True, to="API.profile"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Avisos",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("titulo", models.CharField(max_length=255)),
                ("mensagem", models.TextField()),
                ("data_envio", models.DateTimeField(auto_now_add=True)),
                (
                    "igreja",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.igreja"),
                ),
                (
                    "destinatarios",
                    models.ManyToManyField(blank=True, to="API.profile"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PostagensGrupos",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("conteudo", models.TextField()),
                (
                    "arquivo",
                    models.FileField(blank=True, null=True, upload_to="postagens/"),
                ),
                ("enquete", models.JSONField(blank=True, null=True)),
                ("link", models.URLField(blank=True, null=True)),
                ("data_postagem", models.DateTimeField(auto_now_add=True)),
                (
                    "autor",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.profile"),
                ),
                (
                    "grupo",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.grupos"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ComentariosPostagens",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("conteudo", models.TextField()),
                ("data_comentario", models.DateTimeField(auto_now_add=True)),
                (
                    "autor",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.profile"),
                ),
                (
                    "postagem",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.postagensgrupos"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="NotificacoesGrupos",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("mensagem", models.TextField()),
                ("data_notificacao", models.DateTimeField(auto_now_add=True)),
                ("lida", models.BooleanField(default=False)),
                (
                    "grupo",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.grupos"),
                ),
                (
                    "perfil",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.profile"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MensagensPrivadas",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("conteudo", models.TextField()),
                ("data_envio", models.DateTimeField(auto_now_add=True)),
                ("lida", models.BooleanField(default=False)),
                (
                    "destinatario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="mensagens_recebidas",
                        to="API.profile",
                    ),
                ),
                (
                    "remetente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="mensagens_enviadas",
                        to="API.profile",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ArquivosIgreja",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("nome_arquivo", models.CharField(max_length=255)),
                ("arquivo", models.FileField(upload_to="arquivos_igreja/")),
                ("data_upload", models.DateTimeField(auto_now_add=True)),
                (
                    "igreja",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.igreja"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="RecursosEducacionais",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("titulo", models.CharField(max_length=255)),
                ("descricao", models.TextField()),
                ("arquivo", models.FileField(upload_to="recursos_educacionais/")),
                ("data_upload", models.DateTimeField(auto_now_add=True)),
                (
                    "igreja",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="API.igreja"),
                ),
            ],
        ),
    ]
