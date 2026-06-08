// Cliente HTTP minimalista sobre fetch, com JWT + refresh automático.

// ⚠️ ANTES DE DEPLOYAR: troque pela sua URL do backend no PythonAnywhere.
// Ex.: "https://renan.pythonanywhere.com" (sem barra no fim).
const API_PROD = "https://SEU-USUARIO.pythonanywhere.com";

// Em dev: vazio (usa o proxy do Vite -> :8000).
// Em produção (Vercel): aponta direto pro PythonAnywhere — não precisa de env
// var no Vercel. Mas se VITE_API_URL estiver definida, ela tem prioridade.
const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : API_PROD);
const ACCESS_KEY = "iasd_access";
const REFRESH_KEY = "iasd_refresh";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(extrairMensagem(data) || `Erro ${status}`);
    this.status = status;
    this.data = data;
  }
}

function extrairMensagem(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  // Pega o primeiro erro de validação do DRF.
  const primeiro = Object.values(data)[0];
  if (Array.isArray(primeiro)) return String(primeiro[0]);
  if (typeof primeiro === "string") return primeiro;
  return "";
}

async function refreshToken(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  const resp = await fetch(`${BASE}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!resp.ok) return false;
  const data = await resp.json();
  tokens.set(data.access, data.refresh);
  return true;
}

interface Opts {
  method?: string;
  body?: any;
  auth?: boolean;
  raw?: boolean; // body já é FormData
}

async function request<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const access = tokens.access;
    if (access) headers["Authorization"] = `Bearer ${access}`;
    let body = opts.body;
    if (body && !opts.raw) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch(`${BASE}${path}`, { method: opts.method || "GET", headers, body });
  };

  let resp = await doFetch();
  if (resp.status === 401 && tokens.refresh) {
    if (await refreshToken()) {
      resp = await doFetch();
    } else {
      tokens.clear();
    }
  }

  if (resp.status === 204) return undefined as T;
  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;
  if (!resp.ok) throw new ApiError(resp.status, data);
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any) => request<T>(p, { method: "POST", body }),
  patch: <T = any>(p: string, body?: any) => request<T>(p, { method: "PATCH", body }),
  put: <T = any>(p: string, body?: any) => request<T>(p, { method: "PUT", body }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
};

// Upload de arquivo (multipart). O navegador define o boundary do Content-Type.
export async function uploadArquivo<T = any>(path: string, file: File, campo = "foto") {
  const fd = new FormData();
  fd.append(campo, file);
  return request<T>(path, { method: "POST", body: fd, raw: true });
}

// POST multipart com FormData arbitrário (texto + vários arquivos).
export async function postForm<T = any>(path: string, fd: FormData) {
  return request<T>(path, { method: "POST", body: fd, raw: true });
}

// Baixa um arquivo (ex.: .ics) enviando o token, salvando como download.
export async function baixarComAuth(path: string, nomeArquivo: string) {
  const headers: Record<string, string> = {};
  if (tokens.access) headers["Authorization"] = `Bearer ${tokens.access}`;
  const resp = await fetch(`${BASE}${path}`, { headers });
  if (!resp.ok) throw new ApiError(resp.status, null);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Autenticação
export async function login(email: string, senha: string) {
  const data = await request<{ access: string; refresh: string }>("/api/auth/login/", {
    method: "POST",
    body: { username: email, password: senha },
  });
  tokens.set(data.access, data.refresh);
  return data;
}

export async function registrar(payload: {
  nome: string;
  email: string;
  password: string;
  telefone?: string;
}) {
  const data = await request<{ access: string; refresh: string }>(
    "/api/auth/register/",
    { method: "POST", body: payload },
  );
  tokens.set(data.access, data.refresh);
  return data;
}

export function logout() {
  tokens.clear();
}
