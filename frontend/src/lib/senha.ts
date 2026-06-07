// Validação de força de senha (amigável: 8 chars, 1 letra, 1 número — sem exigir
// caractere especial, para não complicar a vida dos anciões).

export function validarSenha(s: string): { ok: boolean; motivo: string } {
  if (s.length < 8) return { ok: false, motivo: "Mínimo de 8 caracteres" };
  if (!/[a-zA-Z]/.test(s)) return { ok: false, motivo: "Inclua ao menos 1 letra" };
  if (!/[0-9]/.test(s)) return { ok: false, motivo: "Inclua ao menos 1 número" };
  return { ok: true, motivo: "Senha boa" };
}
