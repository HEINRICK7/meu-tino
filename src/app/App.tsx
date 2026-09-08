import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { api, ApiError } from "../shared/api/client";
import type { ActivityItem, MeResponse } from "../shared/api/types";
import { formatDate, formatMinorAmount } from "../shared/formatting/money";
import styles from "./App.module.css";

type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

type SessionContextValue = {
  me: MeResponse | null;
  status: SessionStatus;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SessionContextValue;
}) => <SessionContextProvider value={value}>{children}</SessionContextProvider>;

import { createContext, useContext } from "react";
const SessionContextStore = createContext<SessionContextValue | null>(null);
function SessionContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SessionContextValue;
}) {
  return (
    <SessionContextStore.Provider value={value}>
      {children}
    </SessionContextStore.Provider>
  );
}
function useSession() {
  const value = useContext(SessionContextStore);
  if (!value) throw new Error("useSession must be used inside SessionContext");
  return value;
}

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      setMe(await api.getMe());
      setStatus("authenticated");
    } catch (error) {
      setMe(null);
      setStatus(
        error instanceof ApiError && error.status === 401
          ? "anonymous"
          : "unavailable",
      );
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setMe(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const session = useMemo(
    () => ({ me, status, refresh, logout }),
    [logout, me, refresh, status],
  );

  return (
    <SessionContext value={session}>
      <Routes>
        <Route path="/i/:token" element={<ActivationPage />} />
        <Route element={<SessionBoundary />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route
              path="activity/:activityId"
              element={<ActivityDetailPage />}
            />
          </Route>
        </Route>
        <Route path="*" element={<PublicPage />} />
      </Routes>
    </SessionContext>
  );
}

function SessionBoundary() {
  const { status } = useSession();
  if (status === "loading") return <LoadingPage label="Abrindo seu espaço…" />;
  if (status === "unavailable") return <UnavailablePage />;
  if (status === "anonymous") return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

function AppShell() {
  const { me, logout } = useSession();
  const location = useLocation();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleInstall);
  }, []);

  if (!me) return null;

  return (
    <div className={styles.appFrame}>
      <header className={styles.topbar}>
        <Link
          className={styles.brand}
          to="/"
          aria-label="Ir para o início do Meu TINO"
        >
          <LogoMark />
          <span>
            <strong>Meu TINO</strong>
            <small>{me.business.displayName}</small>
          </span>
        </Link>
        <button
          className={styles.textButton}
          type="button"
          onClick={() => void logout()}
        >
          Sair
        </button>
      </header>

      <main className={styles.main}>
        <Outlet context={{ installEvent, setInstallEvent }} />
      </main>

      <nav className={styles.bottomNav} aria-label="Navegação principal">
        <Link
          className={
            location.pathname === "/" ? styles.navItemActive : styles.navItem
          }
          to="/"
        >
          <HomeIcon />
          <span>Início</span>
        </Link>
        <Link
          className={
            location.pathname.startsWith("/activity")
              ? styles.navItemActive
              : styles.navItem
          }
          to="/activity"
        >
          <ActivityIcon />
          <span>Extrato</span>
        </Link>
      </nav>
    </div>
  );
}

function HomePage() {
  const { me } = useSession();
  const { installEvent, setInstallEvent } = useAppShellContext();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityState, setActivityState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    let active = true;
    void api
      .listActivity({ limit: 4 })
      .then((response) => {
        if (!active) return;
        setActivity(response.items);
        setActivityState("ready");
      })
      .catch(() => active && setActivityState("error"));
    return () => {
      active = false;
    };
  }, []);

  if (!me) return null;
  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Sua caderneta, com clareza</p>
          <h1>Oi, {firstName(me.customer.displayName)}.</h1>
          <p className={styles.heroCopy}>
            Aqui você acompanha o que foi registrado no{" "}
            {me.business.displayName}.
          </p>
        </div>
        <div className={styles.heroStamp} aria-hidden="true">
          <span>tino</span>
          <strong>✓</strong>
        </div>
      </section>

      <section className={styles.balanceCard} aria-labelledby="balance-title">
        <div className={styles.balanceTopline}>
          <span id="balance-title">Saldo da caderneta</span>
          <span className={styles.livePill}>
            <span /> Atualizado
          </span>
        </div>
        <p className={styles.balanceValue}>
          {formatMinorAmount(
            me.account.balance.minor,
            me.account.balance.currency,
          )}
        </p>
        <div className={styles.balanceMeta}>
          <span>
            {me.account.status === "OPEN" ? "Em aberto" : me.account.status}
          </span>
          <span>em {formatDate(me.account.asOf)}</span>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <InstallCard
          installEvent={installEvent}
          onInstalled={() => setInstallEvent(null)}
        />
        <PushCard enabled={me.features.push} />
      </section>

      <section className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Movimentações recentes</p>
          <h2>O que aconteceu</h2>
        </div>
        <Link className={styles.inlineLink} to="/activity">
          Ver tudo <ArrowIcon />
        </Link>
      </section>

      {activityState === "loading" && <ActivitySkeleton />}
      {activityState === "error" && (
        <InlineError message="Não conseguimos carregar o extrato agora." />
      )}
      {activityState === "ready" && activity.length === 0 && <EmptyActivity />}
      {activityState === "ready" && activity.length > 0 && (
        <ActivityList items={activity} compact />
      )}
    </>
  );
}

function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void api
      .listActivity({ limit: 50 })
      .then((result) => {
        setItems(result.items);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}>Histórico</p>
        <h1>Seu extrato</h1>
        <p>Uma visão simples de cada compra e pagamento confirmado.</p>
      </section>
      {state === "loading" && <ActivitySkeleton rows={5} />}
      {state === "error" && (
        <InlineError message="Não conseguimos carregar o extrato agora." />
      )}
      {state === "ready" && items.length === 0 && <EmptyActivity />}
      {state === "ready" && items.length > 0 && <ActivityList items={items} />}
    </>
  );
}

function ActivityDetailPage() {
  const { activityId } = useParams();
  const [activity, setActivity] = useState<ActivityItem | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!activityId) return;
    void api
      .getActivity(activityId)
      .then((result) => {
        setActivity(result);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [activityId]);

  return (
    <>
      <Link className={styles.backLink} to="/activity">
        <ArrowLeftIcon /> Voltar ao extrato
      </Link>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}>Detalhe da movimentação</p>
        <h1>Registro da caderneta</h1>
      </section>
      {state === "loading" && <ActivitySkeleton rows={1} />}
      {state === "error" && (
        <InlineError message="Essa movimentação não está disponível." />
      )}
      {state === "ready" && activity && (
        <ActivityDetailCard activity={activity} />
      )}
    </>
  );
}

function ActivationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [state, setState] = useState<"activating" | "success" | "error">(
    "activating",
  );
  const [message, setMessage] = useState("Validando seu convite…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Este convite não está completo.");
      return;
    }
    void api
      .activate(token)
      .then(async () => {
        window.history.replaceState({}, document.title, "/");
        await refresh();
        setState("success");
        setMessage("Tudo certo. Abrindo seu espaço…");
        window.setTimeout(() => navigate("/", { replace: true }), 500);
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(
          error instanceof ApiError && error.status === 410
            ? "Este convite expirou. Peça um novo link ao comerciante."
            : "Não foi possível ativar este convite.",
        );
      });
  }, [navigate, refresh, token]);

  return (
    <div className={styles.centerPage}>
      <LogoMark large />
      <p className={styles.eyebrow}>Meu TINO</p>
      <h1>{state === "success" ? "Bem-vindo." : "Seu espaço começa aqui."}</h1>
      <p className={styles.centerCopy}>{message}</p>
      {state === "activating" && <Spinner />}
      {state === "error" && (
        <Link className={styles.primaryButton} to="/welcome">
          Voltar ao início
        </Link>
      )}
    </div>
  );
}

function PublicPage() {
  const { status } = useSession();
  if (status === "loading") return <LoadingPage label="Abrindo o Meu TINO…" />;
  if (status === "unavailable") return <UnavailablePage />;
  return (
    <div className={styles.centerPage}>
      <LogoMark large />
      <p className={styles.eyebrow}>Meu TINO</p>
      <h1>Acompanhe sua caderneta sem complicação.</h1>
      <p className={styles.centerCopy}>
        Abra o link que o comerciante enviou pelo WhatsApp para entrar no seu
        espaço.
      </p>
      <div className={styles.infoNote}>
        <ShieldIcon /> Seu acesso é pessoal e protegido por um convite de uso
        único.
      </div>
      <p className={styles.mutedNote}>
        Ainda não recebeu o convite? Fale diretamente com o seu comerciante.
      </p>
    </div>
  );
}

function UnavailablePage() {
  return (
    <div className={styles.centerPage}>
      <LogoMark large />
      <p className={styles.eyebrow}>Conexão indisponível</p>
      <h1>Seu espaço está seguro.</h1>
      <p className={styles.centerCopy}>
        Não conseguimos falar com o Meu TINO agora. Tente novamente em alguns
        instantes.
      </p>
      <button
        className={styles.primaryButton}
        type="button"
        onClick={() => window.location.reload()}
      >
        Tentar novamente
      </button>
    </div>
  );
}

function LoadingPage({ label }: { label: string }) {
  return (
    <div className={styles.centerPage}>
      <LogoMark large />
      <Spinner />
      <p className={styles.centerCopy}>{label}</p>
    </div>
  );
}

function InstallCard({
  installEvent,
  onInstalled,
}: {
  installEvent: BeforeInstallPromptEvent | null;
  onInstalled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  if (!installEvent)
    return (
      <article className={styles.utilityCard}>
        <div className={styles.utilityIcon}>
          <PhoneIcon />
        </div>
        <div>
          <p className={styles.cardKicker}>Sempre por perto</p>
          <h3>Adicione à tela inicial</h3>
          <p>Abra o Meu TINO como um app, sem procurar no WhatsApp.</p>
        </div>
      </article>
    );
  const install = async () => {
    setLoading(true);
    await installEvent.prompt();
    await installEvent.userChoice;
    onInstalled();
    setLoading(false);
  };
  return (
    <article className={styles.utilityCard}>
      <div className={styles.utilityIcon}>
        <PhoneIcon />
      </div>
      <div>
        <p className={styles.cardKicker}>Sempre por perto</p>
        <h3>Leve o Meu TINO com você</h3>
        <p>Um toque e sua caderneta fica na tela inicial.</p>
        <button
          className={styles.smallButton}
          type="button"
          onClick={() => void install()}
          disabled={loading}
        >
          {loading ? "Abrindo…" : "Instalar agora"}
        </button>
      </div>
    </article>
  );
}

function PushCard({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<
    "idle" | "loading" | "active" | "denied" | "disabled" | "error"
  >("idle");
  const requestPush = async () => {
    if (!enabled) {
      setState("disabled");
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const config = await api.getPushConfig();
      if (!config.enabled || !config.vapidPublicKey) {
        setState("disabled");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(config.vapidPublicKey),
      });
      await api.registerPushSubscription(subscription.toJSON());
      setState("active");
    } catch {
      setState("error");
    }
  };
  const copy = {
    idle: [
      "Receba avisos importantes",
      "Ative as notificações para saber quando sua caderneta mudar.",
      "Ativar notificações",
    ],
    loading: ["Preparando seus avisos", "Só um instante…", "Aguarde"],
    active: [
      "Notificações ativas",
      "Você será avisado quando houver uma atualização.",
      "Ativo",
    ],
    denied: [
      "Notificações pausadas",
      "Você pode liberar os avisos nas configurações do navegador.",
      "Entendi",
    ],
    disabled: [
      "Avisos em preparação",
      "Este recurso ainda não está disponível para este espaço.",
      "Em breve",
    ],
    error: [
      "Não foi possível ativar",
      "Sua caderneta continua disponível por aqui.",
      "Tentar novamente",
    ],
  }[state];
  return (
    <article className={styles.utilityCard}>
      <div className={`${styles.utilityIcon} ${styles.pushIcon}`}>
        <BellIcon />
      </div>
      <div>
        <p className={styles.cardKicker}>{copy[0]}</p>
        <h3>{copy[1]}</h3>
        <button
          className={styles.smallButton}
          type="button"
          onClick={() => void requestPush()}
          disabled={
            state === "loading" ||
            state === "active" ||
            state === "denied" ||
            state === "disabled"
          }
        >
          {copy[2]}
        </button>
      </div>
    </article>
  );
}

function ActivityList({
  items,
  compact = false,
}: {
  items: ActivityItem[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.activityListCompact : styles.activityList}>
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const isPayment =
    item.type === "PAYMENT_CONFIRMED" || item.impact === "DECREASES_BALANCE";
  return (
    <Link className={styles.activityRow} to={`/activity/${item.id}`}>
      <span
        className={`${styles.activityIcon} ${isPayment ? styles.paymentActivity : styles.debtActivity}`}
      >
        {isPayment ? <ArrowDownIcon /> : <ArrowUpIcon />}
      </span>
      <span className={styles.activityText}>
        <strong>{item.label}</strong>
        <small>{formatDate(item.occurredAt)}</small>
      </span>
      <span className={isPayment ? styles.paymentAmount : styles.debtAmount}>
        {isPayment ? "−" : "+"}
        {formatMinorAmount(item.amount.minor, item.amount.currency)}
      </span>
      <ArrowIcon />
    </Link>
  );
}

function ActivityDetailCard({ activity }: { activity: ActivityItem }) {
  const isPayment =
    activity.type === "PAYMENT_CONFIRMED" ||
    activity.impact === "DECREASES_BALANCE";
  return (
    <article className={styles.detailCard}>
      <span
        className={`${styles.detailIcon} ${isPayment ? styles.paymentActivity : styles.debtActivity}`}
      >
        {isPayment ? <ArrowDownIcon /> : <ArrowUpIcon />}
      </span>
      <p className={styles.cardKicker}>
        {isPayment ? "Pagamento confirmado" : "Compra registrada"}
      </p>
      <h2>{activity.label}</h2>
      <p
        className={
          isPayment ? styles.paymentAmountLarge : styles.debtAmountLarge
        }
      >
        {isPayment ? "−" : "+"}
        {formatMinorAmount(activity.amount.minor, activity.amount.currency)}
      </p>
      <p className={styles.detailDate}>{formatDate(activity.occurredAt)}</p>
    </article>
  );
}

function ActivitySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeletonList}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.skeletonRow} key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
function EmptyActivity() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyMark}>✦</div>
      <h3>Seu extrato está tranquilo.</h3>
      <p>
        Quando houver uma compra ou pagamento confirmado, ele aparecerá aqui.
      </p>
    </div>
  );
}
function InlineError({ message }: { message: string }) {
  return (
    <div className={styles.inlineError}>
      <WarningIcon />
      <span>{message}</span>
    </div>
  );
}
function useAppShellContext() {
  return (
    useOutletContext as typeof import("react-router-dom").useOutletContext
  )() as {
    installEvent: BeforeInstallPromptEvent | null;
    setInstallEvent: (event: BeforeInstallPromptEvent | null) => void;
  };
}
import { useOutletContext } from "react-router-dom";
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "você";
}
function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
function Spinner() {
  return <span className={styles.spinner} aria-label="Carregando" />;
}
function LogoMark({ large = false }: { large?: boolean }) {
  return (
    <span
      className={large ? styles.logoMarkLarge : styles.logoMark}
      aria-hidden="true"
    >
      <span>T</span>
      <i />
    </span>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9Z" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4v16M5 8h10a3 3 0 0 1 0 6H5m0 0h11a3 3 0 0 1 0 6H5" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 5-7 7 7 7M8 12h11" />
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5m-5 5 5-5 5 5" />
    </svg>
  );
}
function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14m5-5-5 5-5-5" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <path d="M10 18h4M10 6h4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 9 16H3l9-16Z" />
      <path d="M12 9v5m0 3h.01" />
    </svg>
  );
}
