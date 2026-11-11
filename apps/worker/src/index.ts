import type { Env } from "./env";
import { errorResponse } from "./http/json";
import { LobbyObject } from "./LobbyObject";
import { D1QuizResultRepository } from "./infra/D1QuizResultRepository";
import { D1TrailResultRepository } from "./infra/D1TrailResultRepository";
import { RankingReader } from "./infra/RankingReader";
import { MatchObject } from "./MatchObject";
import { QuizObject } from "./QuizObject";

// O Worker só encaminha: nada de regra de jogo aqui.
export { LobbyObject, MatchObject, QuizObject };

// Um leitor de ranking por instância do Worker: guarda o ranking por alguns segundos.
let rankingReader: RankingReader | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket da partida: /api/match/<id>/ws?token=...
    const ws = /^\/api\/match\/([\w-]{1,64})\/ws$/.exec(url.pathname);
    if (ws) {
      const matchId = ws[1] as string;
      return env.MATCH.get(env.MATCH.idFromName(matchId)).fetch(request);
    }

    // Quiz: o roteador confere o token no saguão e entrega o jogador ao Quiz dele.
    const quiz = /^\/api\/quiz\/(start|answer)$/.exec(url.pathname);
    if (quiz && request.method === "POST") {
      const who = await env.LOBBY.get(env.LOBBY.idFromName("main")).fetch("https://lobby/internal/whoami", {
        method: "POST",
        headers: { authorization: request.headers.get("authorization") ?? "" },
      });
      if (!who.ok) return errorResponse("unauthorized", 401);
      const player = (await who.json()) as { id: string; nickname: string };
      const headers = new Headers({ "x-player-id": player.id, "x-player-nickname": player.nickname });
      const body = await request.text();
      return env.QUIZ.get(env.QUIZ.idFromName(player.id)).fetch(`https://quiz/${quiz[1]}`, { method: "POST", headers, body });
    }

    // Ranking público (somente leitura, sem login): usado pelo app e pelo telão.
    if (request.method === "GET" && url.pathname === "/api/ranking") {
      rankingReader ??= new RankingReader(new D1QuizResultRepository(env.DB), new D1TrailResultRepository(env.DB));
      return Response.json(await rankingReader.read(), { headers: { "cache-control": "public, max-age=5" } });
    }

    // Saguão (entrar, lista, convites). A rota interna não passa por aqui.
    if (url.pathname.startsWith("/api/")) {
      return env.LOBBY.get(env.LOBBY.idFromName("main")).fetch(request);
    }

    if (url.pathname === "/health") return new Response("ok");
    return errorResponse("not_found", 404);
  },
};
