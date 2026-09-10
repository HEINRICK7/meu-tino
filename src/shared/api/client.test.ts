import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";

describe("customer channel API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the customer session in an HttpOnly-cookie request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          channel: { status: "ACTIVE" },
          customer: { displayName: "Maria" },
          business: { displayName: "Mercadinho" },
          account: {
            status: "OPEN",
            balance: { minor: 1250, currency: "BRL" },
            version: 1,
            asOf: "2026-09-08T12:00:00Z",
          },
          features: { push: false, pix: false, agreements: false },
          push: { activeSubscriptions: 0 },
          pix: {
            enabled: true,
            key: "loja@example.com",
            copyPaste: "000201PIX",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getMe()).resolves.toMatchObject({
      pix: {
        enabled: true,
        key: "loja@example.com",
        copyPaste: "000201PIX",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock.mock.calls[0][1].headers.get("Accept")).toBe(
      "application/json",
    );
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });

  it("bypasses HTTP caches for authoritative activity reads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [], nextCursor: null, asOf: "2026-09-08" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "activity-id",
            type: "PAYMENT_CONFIRMED",
            impact: "DECREASES_BALANCE",
            amount: { minor: 1250, currency: "BRL" },
            label: "Pagamento",
            occurredAt: "2026-09-08T12:00:00Z",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.listActivity({ limit: 1 });
    await api.getActivity("activity-id");

    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
  });

  it("activates an invite through the public contract with idempotency", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ACTIVE" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.activate("invite-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/customer-channel/activation",
    );
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ token: "invite-token" }),
      }),
    );
    expect(init.headers.get("Accept")).toBe("application/json");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("Idempotency-Key")).toEqual(expect.any(String));
  });

  it("normalizes the backend snake_case VAPID key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ enabled: true, vapid_public_key: "public-key" }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getPushConfig()).resolves.toEqual({
      enabled: true,
      vapidPublicKey: "public-key",
    });
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
