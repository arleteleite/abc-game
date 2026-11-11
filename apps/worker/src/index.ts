import type { Env } from "./env";
import { errorResponse } from "./http/json";
import { LobbyObject } from "./LobbyObject";
import { MatchObject } from "./MatchObject";

// O Worker só encaminha: nada de regra de jogo aqui.
export { LobbyObject, MatchObject };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket da partida: /api/match/<id>/ws?token=...
    const ws = /^\/api\/match\/([\w-]{1,64})\/ws$/.exec(url.pathname);
    if (ws) {
      const matchId = ws[1] as string;
      return env.MATCH.get(env.MATCH.idFromName(matchId)).fetch(request);
    }

    // Saguão (entrar, lista, convites). A rota interna não passa por aqui.
    if (url.pathname.startsWith("/api/")) {
      return env.LOBBY.get(env.LOBBY.idFromName("main")).fetch(request);
    }

    if (url.pathname === "/health") return new Response("ok");
    return errorResponse("not_found", 404);
  },
};
