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

  it("creates a customer-scoped Pix payment intent with an idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentIntent: {
            id: "intent-id",
            customerId: "customer-id",
            amountMinor: 1250,
            currency: "BRL",
            pixTxid: "TINOTEST123",
            pixKey: "loja@example.com",
            copyPaste: "000201PIX",
            status: "PENDING",
            createdAt: "2026-09-08T12:00:00Z",
            expiresAt: "2026-09-08T12:30:00Z",
            updatedAt: "2026-09-08T12:00:00Z",
          },
          replayed: false,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.createPaymentIntent(1250)).resolves.toMatchObject({
      paymentIntent: { amountMinor: 1250, pixTxid: "TINOTEST123" },
    });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/v1/me/payment-intents");
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ amount_minor: 1250 }),
        cache: "no-store",
      }),
    );
    expect(init.headers.get("Idempotency-Key")).toEqual(expect.any(String));
  });

  it("allows the PWA to replay the same logical Pix intent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentIntent: { amountMinor: 1250 },
          replayed: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.createPaymentIntent(1250, {
      idempotencyKey: "pix-intent-replay",
    });

    expect(fetchMock.mock.calls[0][1].headers.get("Idempotency-Key")).toBe(
      "pix-intent-replay",
    );
  });
});
