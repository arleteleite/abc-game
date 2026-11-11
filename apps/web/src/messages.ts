// Textos de erro mostrados ao jogador. Os códigos vêm do servidor.
const TEXTS: Readonly<Record<string, string>> = {
  too_short: "O apelido está muito curto (mínimo de 2 caracteres).",
  too_long: "O apelido está muito longo (máximo de 16 caracteres).",
  invalid_characters: "Use só letras, números, espaço, ponto, hífen ou sublinhado.",
  blocked_term: "Esse apelido não pode ser usado. Escolha outro.",
  nickname_in_use: "Já existe alguém com esse apelido agora. Escolha outro.",
  network: "Sem conexão com o servidor. Confira seu sinal e tente de novo.",
  unauthorized: "Sua sessão acabou. Entre de novo.",
  target_unavailable: "Esse jogador não está mais disponível.",
  player_busy: "Você ou o outro jogador já está em uma partida.",
  expired: "O convite expirou.",
  not_available: "Esse convite não está mais disponível.",
  same_pawn: "Esse peão já é do adversário. Escolha outro.",
  own_invitation: "Esse convite é seu. Envie o link para outra pessoa.",
  unknown_invitation: "Esse convite não existe mais ou o link está errado.",
  sender_gone: "Quem convidou saiu.",
  match_unavailable: "Não foi possível criar a partida agora. Tente de novo.",
};

export const errorText = (code: string): string => TEXTS[code] ?? "Algo deu errado. Tente de novo.";
