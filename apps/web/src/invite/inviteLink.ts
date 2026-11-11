// Link de convite (WhatsApp). O identificador do convite vai na própria URL:
//   https://<endereço>/?convite=<id>
// Ninguém precisa informar telefone: o WhatsApp abre a lista de contatos para a pessoa escolher.

const PARAM = "convite";

export function buildInviteUrl(origin: string, invitationId: string): string {
  return `${origin}/?${PARAM}=${encodeURIComponent(invitationId)}`;
}

/** Lê o convite da URL (ex.: "?convite=abc"). Devolve null se não houver ou se o formato for estranho. */
export function readInviteId(search: string): string | null {
  const value = new URLSearchParams(search).get(PARAM);
  return value && /^[\w-]{1,64}$/.test(value) ? value : null;
}

export function inviteMessage(nickname: string, url: string): string {
  return `${nickname} te desafiou para a Trilha ABC+! Abra o link e aceite o desafio (vale por 3 minutos): ${url}`;
}

/** Abre o WhatsApp com a mensagem pronta (sem número: a pessoa escolhe o contato). */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
