import { describe, expect, it } from "vitest";
import { buildInviteUrl, inviteMessage, readInviteId, whatsappUrl } from "./inviteLink";

describe("inviteLink", () => {
  it("monta e lê o link de convite", () => {
    const url = buildInviteUrl("https://exemplo.dev", "a1b2-c3");
    expect(url).toBe("https://exemplo.dev/?convite=a1b2-c3");
    expect(readInviteId(new URL(url).search)).toBe("a1b2-c3");
  });

  it("ignora convite ausente ou com formato estranho", () => {
    expect(readInviteId("")).toBeNull();
    expect(readInviteId("?outra=1")).toBeNull();
    expect(readInviteId("?convite=<script>")).toBeNull();
    expect(readInviteId(`?convite=${"x".repeat(80)}`)).toBeNull();
  });

  it("o link do WhatsApp não leva número de telefone e traz a mensagem com o link", () => {
    const url = buildInviteUrl("https://exemplo.dev", "id1");
    const wa = whatsappUrl(inviteMessage("Ana", url));
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.slice("https://wa.me/?text=".length))).toContain(url);
    expect(wa).not.toMatch(/wa\.me\/\d/);
  });
});
