export type ApiErrorPayload = {
  code?: string;
  message?: string;
  correlationId?: string;
};

export type MeResponse = {
  channel: { status: string };
  customer: { displayName: string };
  business: { displayName: string };
  account: {
    status: string;
    balance: { minor: number; currency: string };
    version: number;
    asOf: string;
  };
  features: { push: boolean; pix: boolean; agreements: boolean };
  push: { activeSubscriptions: number };
  /** Optional for compatibility with older backend releases. */
  pix?: {
    enabled: boolean;
    key: string | null;
    copyPaste: string | null;
  } | null;
};

export type ActivityItem = {
  id: string;
  type: "DEBT_CREATED" | "PAYMENT_CONFIRMED" | "ADJUSTMENT" | string;
  impact: "INCREASES_BALANCE" | "DECREASES_BALANCE" | "NEUTRAL" | string;
  amount: { minor: number; currency: string };
  label: string;
  occurredAt: string;
};

export type ActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
  asOf: string;
};
export type PushConfig = { enabled: boolean; vapidPublicKey: string | null };
