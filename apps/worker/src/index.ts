import { SpikeRoom } from "./SpikeRoom";
import { SPIKE_PAGE } from "./spikePage";

// Worker do SPIKE (etapa 2). O roteador só encaminha: a lógica fica na sala.
export { SpikeRoom };

interface Env {
  SPIKE_ROOM: DurableObjectNamespace<SpikeRoom>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length === 0) {
      return new Response(SPIKE_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // /ws/<sala> (WebSocket) e /stats/<sala> (HTTP) vão para a mesma sala.
    if ((parts[0] === "ws" || parts[0] === "stats") && parts[1]) {
      const stub = env.SPIKE_ROOM.get(env.SPIKE_ROOM.idFromName(parts[1]));
      const target = new URL(request.url);
      target.pathname = `/${parts[0]}`;
      return stub.fetch(new Request(target, request));
    }

    return new Response("Não encontrado", { status: 404 });
  },
};
