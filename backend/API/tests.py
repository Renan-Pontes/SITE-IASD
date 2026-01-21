import json

from django.contrib.auth import get_user_model
from django.test import TestCase

from API.models import Igreja, Grupos, Profile


class AuthFlowTests(TestCase):
    def setUp(self):
        self.igreja = Igreja.objects.create(
            nome="IASD Central",
            endereco="Rua Esperanca, 120 - Centro",
            telefone="(11) 3456-7890",
            email="contato@iasd.local",
        )

    def test_register_creates_profile_and_token(self):
        payload = {
            "username": "novo@iasd.local",
            "password": "StrongPass123!",
            "email": "novo@iasd.local",
            "Igreja_Participante": [self.igreja.id],
        }
        response = self.client.post(
            "/api/register/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("token", data)
        self.assertTrue(Profile.objects.filter(user__username="novo@iasd.local").exists())

    def test_login_returns_token(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="user@iasd.local",
            password="StrongPass123!",
            email="user@iasd.local",
        )
        Profile.objects.get_or_create(user=user)

        response = self.client.post(
            "/api/login/",
            data=json.dumps({"username": "user@iasd.local", "password": "StrongPass123!"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    def test_grupos_requires_auth(self):
        grupo = Grupos.objects.create(
            nome="Musica",
            descricao="Louvor e coral",
            igreja=self.igreja,
        )
        response = self.client.get("/api/grupos/")
        self.assertEqual(response.status_code, 401)

        User = get_user_model()
        user = User.objects.create_user(
            username="member@iasd.local",
            password="StrongPass123!",
            email="member@iasd.local",
        )
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.grupos.add(grupo)

        login_response = self.client.post(
            "/api/login/",
            data=json.dumps({"username": "member@iasd.local", "password": "StrongPass123!"}),
            content_type="application/json",
        )
        token = login_response.json()["token"]

        authed_response = self.client.get("/api/grupos/", HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(authed_response.status_code, 200)
        self.assertEqual(len(authed_response.json()), 1)
