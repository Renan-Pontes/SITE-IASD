from django.conf import settings
from django.http import HttpResponse


class SimpleCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/") and request.method == "OPTIONS":
            response = HttpResponse()
        else:
            response = self.get_response(request)

        if request.path.startswith("/api/"):
            origin = request.headers.get("Origin")
            allow_all = getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False)
            allowed = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []))

            if allow_all:
                response["Access-Control-Allow-Origin"] = "*" if not origin else origin
                if origin:
                    response["Vary"] = "Origin"
            elif origin and origin in allowed:
                response["Access-Control-Allow-Origin"] = origin
                response["Vary"] = "Origin"

            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"

        return response
