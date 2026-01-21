from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

class Igreja(models.Model):
    nome = models.CharField(max_length=255)
    endereco = models.CharField(max_length=255)
    telefone = models.CharField(max_length=20)
    email = models.EmailField()
    
    def __str__(self):
        return self.nome
    
class Grupos(models.Model):
    nome = models.CharField(max_length=255)
    descricao = models.TextField()
    igreja = models.ForeignKey(Igreja, on_delete=models.CASCADE)
    
    def __str__(self):
        return self.nome
    

class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    igrejas = models.ManyToManyField(Igreja, blank=True) #para aparecer as igrejas que quer ser notificado
    telefone = models.CharField(max_length=20, null=True, blank=True)
    image = models.ImageField(upload_to='profile_images/', null=True, blank=True)
    bio = models.TextField(null=True, blank=True)

    is_admin = models.BooleanField(default=False)
    is_elder = models.BooleanField(default=False)
    
    grupos = models.ManyToManyField(Grupos, blank=True)
    
    def __str__(self):
        return self.user.username


class AuthToken(models.Model):
    key = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_token"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Token for {self.user_id}"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    
class Events(models.Model):
    titulo = models.CharField(max_length=255)
    descricao = models.TextField()
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField()
    igreja = models.ForeignKey(Igreja, on_delete=models.CASCADE)
    
    participantes = models.ManyToManyField(Profile, blank=True)

    def __str__(self):
        return self.titulo

class Atividades(models.Model):
    nome = models.CharField(max_length=255)
    descricao = models.TextField()
    data= models.DateTimeField()
    Grupo = models.ForeignKey(Grupos, on_delete=models.CASCADE)

    def __str__(self):
        return self.nome
    
class Comunicados(models.Model):
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()
    data_envio = models.DateTimeField(auto_now_add=True)
    igreja = models.ForeignKey(Igreja, on_delete=models.CASCADE)
    
    destinatarios = models.ManyToManyField(Profile, blank=True)

    def __str__(self):
        return self.titulo
    
class Avisos(models.Model):
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()
    data_envio = models.DateTimeField(auto_now_add=True)
    igreja = models.ForeignKey(Igreja, on_delete=models.CASCADE)
    
    destinatarios = models.ManyToManyField(Profile, blank=True)

    def __str__(self):
        return self.titulo
    
class PostagensGrupos(models.Model):
    grupo = models.ForeignKey(Grupos, on_delete=models.CASCADE)
    autor = models.ForeignKey(Profile, on_delete=models.CASCADE)
    conteudo = models.TextField()
    #pode ser imagem ou video
    arquivo = models.FileField(upload_to='postagens/', null=True, blank=True)
    # pode ser enquete
    enquete = models.JSONField(null=True, blank=True)
    # pode ser link
    link = models.URLField(null=True, blank=True)

    data_postagem = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Postagem de {self.autor} no grupo {self.grupo}"
    
class ComentariosPostagens(models.Model):
    postagem = models.ForeignKey(PostagensGrupos, on_delete=models.CASCADE)
    autor = models.ForeignKey(Profile, on_delete=models.CASCADE)
    conteudo = models.TextField()
    data_comentario = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comentário de {self.autor} na postagem {self.postagem.id}"
    

class NotificacoesGrupos(models.Model):
   # ao ser visto pelo usuario é deletado
    perfil = models.ForeignKey(Profile, on_delete=models.CASCADE)
    grupo = models.ForeignKey(Grupos, on_delete=models.CASCADE)
    mensagem = models.TextField()
    data_notificacao = models.DateTimeField(auto_now_add=True)
    lida = models.BooleanField(default=False)

    def __str__(self):
        return f"Notificação para {self.perfil} no grupo {self.grupo}"
    
class MensagensPrivadas(models.Model):
    remetente = models.ForeignKey(Profile, related_name='mensagens_enviadas', on_delete=models.CASCADE)
    destinatario = models.ForeignKey(Profile, related_name='mensagens_recebidas', on_delete=models.CASCADE)
    conteudo = models.TextField()
    data_envio = models.DateTimeField(auto_now_add=True)
    lida = models.BooleanField(default=False)

    def __str__(self):
        return f"Mensagem de {self.remetente} para {self.destinatario}"
    
class ArquivosIgreja(models.Model):
    igreja = models.ForeignKey(Igreja, on_delete=models.CASCADE)
    nome_arquivo = models.CharField(max_length=255)
    arquivo = models.FileField(upload_to='arquivos_igreja/')
    data_upload = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome_arquivo
    
class RecursosEducacionais(models.Model):
    titulo = models.CharField(max_length=255)
    descricao = models.TextField()
    arquivo = models.FileField(upload_to='recursos_educacionais/')
    data_upload = models.DateTimeField(auto_now_add=True)
    igreja = models.ForeignKey(Igreja, on_delete=models.CASCADE)

    def __str__(self):
        return self.titulo
    
