import type { InvitationView, Pawn } from "@abc-game/domain";
import type {
  JoinResponse,
  LobbyResponse,
  MatchCreatedResponse,
  QuizAnswerRequest,
  QuizAnswerResponse,
  QuizStartResponse,
} from "@abc-game/protocol";

// Erro devolvido pelo servidor: `code` é o motivo (ex.: "nickname_in_use").
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

// Fala com a API do saguão. Só faz requisições; não guarda estado de tela.
export class ApiClient {
  constructor(private readonly getToken: () => string | null) {}

  join(nickname: string): Promise<JoinResponse> {
    return this.request("POST", "/api/join", { nickname });
  }

  lobby(): Promise<LobbyResponse> {
    return this.request("GET", "/api/lobby");
  }

  invite(toPlayerId: string, pawn: Pawn): Promise<unknown> {
    return this.request("POST", "/api/invitations", { toPlayerId, pawn });
  }

  accept(invitationId: string, pawn: Pawn): Promise<MatchCreatedResponse> {
    return this.request("POST", `/api/invitations/${invitationId}/accept`, { pawn });
  }

  decline(invitationId: string): Promise<unknown> {
    return this.request("POST", `/api/invitations/${invitationId}/decline`);
  }

  cancel(invitationId: string): Promise<unknown> {
    return this.request("POST", `/api/invitations/${invitationId}/cancel`);
  }

  inviteLink(pawn: Pawn): Promise<InvitationView> {
    return this.request("POST", "/api/invitations/link", { pawn });
  }

  invitationInfo(invitationId: string): Promise<InvitationView> {
    return this.request("GET", `/api/invitations/${invitationId}`);
  }

  heartbeat(): Promise<unknown> {
    return this.request("POST", "/api/heartbeat");
  }

  quizStart(): Promise<QuizStartResponse> {
    return this.request("POST", "/api/quiz/start", {});
  }

  quizAnswer(body: QuizAnswerRequest): Promise<QuizAnswerResponse> {
    return this.request("POST", "/api/quiz/answer", body);
  }

  leave(): Promise<unknown> {
    return this.request("POST", "/api/leave");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken();
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, "network");
    }
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // resposta sem corpo
    }
    if (!response.ok) {
      const code = typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : "unknown";
      throw new ApiError(response.status, code);
    }
    return data as T;
  }
}
