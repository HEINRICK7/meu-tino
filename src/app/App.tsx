import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { api, ApiError, createIdempotencyKey } from "../shared/api/client";
import type { ActivityItem, MeResponse } from "../shared/api/types";
import { formatDate, formatMinorAmount } from "../shared/formatting/money";
import styles from "./App.module.css";

type SessionStatus =
  "loading" | "authenticated" | "anonymous" | "forbidden" | "unavailable";

type SessionContextValue = {
  me: MeResponse | null;
  status: SessionStatus;
  error: ApiError | null;
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
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setMe(await api.getMe());
      setStatus("authenticated");
    } catch (error) {
      setMe(null);
      setError(error instanceof ApiError ? error : null);
      if (error instanceof ApiError && error.status === 401) {
        setStatus("anonymous");
      } else if (error instanceof ApiError && error.status === 403) {
        setStatus("forbidden");
      } else {
        setStatus("unavailable");
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear the local view even when the server is already unavailable.
    } finally {
      setMe(null);
      setError(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const session = useMemo(
    () => ({ me, status, error, refresh, logout }),
    [error, logout, me, refresh, status],
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
  const { status, error, refresh } = useSession();
  if (status === "loading") return <LoadingPage label="Abrindo seu espaço…" />;
  if (status === "forbidden") {
    return (
      <ForbiddenPage correlationId={error?.correlationId} onRetry={refresh} />
    );
  }
  if (status === "unavailable") {
    return (
      <UnavailablePage correlationId={error?.correlationId} onRetry={refresh} />
    );
  }
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
  const { me, refresh } = useSession();
  const { installEvent, setInstallEvent } = useAppShellContext();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityState, setActivityState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [activityError, setActivityError] = useState<unknown>(null);
  const [activityReload, setActivityReload] = useState(0);

  useEffect(() => {
    let active = true;
    setActivityState("loading");
    setActivityError(null);
    void api
      .listActivity({ limit: 4 })
      .then((response) => {
        if (!active) return;
        setActivity(response.items);
        setActivityState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setActivityError(error);
        setActivityState("error");
      });
    return () => {
      active = false;
    };
  }, [activityReload]);

  const retryActivity = () => {
    if (isUnauthenticatedError(activityError)) {
      void refresh().then(() => setActivityReload((value) => value + 1));
      return;
    }
    setActivityReload((value) => value + 1);
  };

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
        <div className={styles.heroBusiness}>
          <TinoBadge name="mercadinho" className={styles.heroBadge} />
          <span>{me.business.displayName}</span>
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
      {activityState === "error" && activityError && (
        <ActivityErrorNotice error={activityError} onRetry={retryActivity} />
      )}
      {activityState === "ready" && activity.length === 0 && <EmptyActivity />}
      {activityState === "ready" && activity.length > 0 && (
        <ActivityList items={activity} compact />
      )}
    </>
  );
}

function ActivityPage() {
  const { refresh } = useSession();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<unknown>(null);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else {
        setState("loading");
        setItems([]);
        setNextCursor(null);
        setRequestError(null);
        setLoadMoreError(null);
      }
      try {
        const result = await api.listActivity({
          limit: 20,
          cursor: cursor ?? undefined,
        });
        if (append) {
          setItems((current) => [...current, ...result.items]);
        } else {
          setItems(result.items);
        }
        setNextCursor(result.nextCursor);
        setState("ready");
      } catch (error: unknown) {
        if (append) {
          setLoadMoreError(error);
        } else {
          setRequestError(error);
          setState("error");
        }
      } finally {
        if (append) setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage, reloadKey]);

  const retryActivity = () => {
    if (isUnauthenticatedError(requestError)) {
      void refresh().then(() => setReloadKey((value) => value + 1));
      return;
    }
    setReloadKey((value) => value + 1);
  };

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    void loadPage(nextCursor, true);
  };

  const retryLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    if (isUnauthenticatedError(loadMoreError)) {
      void refresh().then(() => void loadPage(nextCursor, true));
      return;
    }
    void loadPage(nextCursor, true);
  };

  return (
    <>
      <section className={styles.pageIntro}>
        <p className={styles.eyebrow}>Histórico</p>
        <h1>Seu extrato</h1>
        <p>Uma visão simples de cada compra e pagamento confirmado.</p>
      </section>
      {state === "loading" && <ActivitySkeleton rows={5} />}
      {state === "error" && requestError && (
        <ActivityErrorNotice error={requestError} onRetry={retryActivity} />
      )}
      {state === "ready" && items.length === 0 && <EmptyActivity />}
      {state === "ready" && items.length > 0 && <ActivityList items={items} />}
      {state === "ready" && items.length > 0 && nextCursor && (
        <div className={styles.loadMoreRow}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
      {loadMoreError && (
        <ActivityErrorNotice error={loadMoreError} onRetry={retryLoadMore} />
      )}
    </>
  );
}

function ActivityDetailPage() {
  const { activityId } = useParams();
  const { refresh } = useSession();
  const [activity, setActivity] = useState<ActivityItem | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [requestError, setRequestError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activityId) {
      setRequestError(new Error("Missing activity id"));
      setState("error");
      return;
    }
    setState("loading");
    setRequestError(null);
    void api
      .getActivity(activityId)
      .then((result) => {
        setActivity(result);
        setState("ready");
      })
      .catch((error: unknown) => {
        setRequestError(error);
        setState("error");
      });
  }, [activityId, reloadKey]);

  const retryActivity = () => {
    if (isUnauthenticatedError(requestError)) {
      void refresh().then(() => setReloadKey((value) => value + 1));
      return;
    }
    setReloadKey((value) => value + 1);
  };

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
      {state === "error" && requestError && (
        <ActivityErrorNotice
          detail
          error={requestError}
          onRetry={retryActivity}
        />
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
  const [state, setState] = useState<"activating" | "error">("activating");
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);
  const activationRequest = useRef<{
    token: string;
    idempotencyKey: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError(new ApiError(400, "INVALID_REQUEST", "Convite incompleto."));
      return;
    }

    const currentRequest =
      activationRequest.current?.token === token
        ? activationRequest.current
        : {
            token,
            idempotencyKey: createIdempotencyKey(),
          };
    activationRequest.current = currentRequest;
    setState("activating");
    setError(null);

    void api
      .activate(token, { idempotencyKey: currentRequest.idempotencyKey })
      .then(async () => {
        // Navigating with replace removes the invite token from browser history.
        navigate("/", { replace: true });
        await refresh();
      })
      .catch((error: unknown) => {
        setState("error");
        setError(error);
      });
  }, [navigate, refresh, retryKey, token]);

  const issue = error ? describeActivationError(error) : null;

  return (
    <div className={styles.centerPage} data-state={issue?.kind ?? state}>
      <LogoMark large />
      <WelcomeIllustration />
      <p className={styles.eyebrow}>Meu TINO</p>
      <h1>Seu espaço começa aqui.</h1>
      <p className={styles.centerCopy}>
        {state === "activating" ? "Validando seu convite…" : issue?.message}
      </p>
      {state === "activating" && <Spinner />}
      {state === "error" && issue?.retryable && (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => setRetryKey((value) => value + 1)}
        >
          <TinoIcon name="refresh" /> Tentar novamente
        </button>
      )}
      {state === "error" && !issue?.retryable && (
        <Link className={styles.primaryButton} to="/welcome">
          Voltar ao início
        </Link>
      )}
      {issue?.correlationId && (
        <p className={styles.correlationNote}>
          Código de atendimento: {issue.correlationId}
        </p>
      )}
    </div>
  );
}

function PublicPage() {
  const { status, error, refresh } = useSession();
  if (status === "loading") return <LoadingPage label="Abrindo o Meu TINO…" />;
  if (status === "forbidden") {
    return (
      <ForbiddenPage correlationId={error?.correlationId} onRetry={refresh} />
    );
  }
  if (status === "unavailable") {
    return (
      <UnavailablePage correlationId={error?.correlationId} onRetry={refresh} />
    );
  }
  return (
    <div className={styles.centerPage} data-state="unauthenticated">
      <LogoMark large />
      <WelcomeIllustration />
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

function UnavailablePage({
  correlationId,
  onRetry,
}: {
  correlationId?: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <div className={styles.centerPage} data-state="unavailable">
      <LogoMark large />
      <TinoBadge
        name="conexao-indisponivel"
        className={styles.unavailableBadge}
      />
      <p className={styles.eyebrow}>Conexão indisponível</p>
      <h1>Seu espaço está seguro.</h1>
      <p className={styles.centerCopy}>
        Não conseguimos falar com o Meu TINO agora. Tente novamente em alguns
        instantes.
      </p>
      <button
        className={styles.primaryButton}
        type="button"
        onClick={() => void onRetry()}
      >
        <TinoIcon name="refresh" /> Tentar novamente
      </button>
      {correlationId && (
        <p className={styles.correlationNote}>
          Código de atendimento: {correlationId}
        </p>
      )}
    </div>
  );
}

function ForbiddenPage({
  correlationId,
  onRetry,
}: {
  correlationId?: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <div className={styles.centerPage} data-state="forbidden">
      <LogoMark large />
      <p className={styles.eyebrow}>Acesso indisponível</p>
      <h1>Seu espaço precisa de atenção.</h1>
      <p className={styles.centerCopy}>
        Este acesso não está liberado no momento. Fale com o comerciante para
        verificar sua caderneta.
      </p>
      <button
        className={styles.primaryButton}
        type="button"
        onClick={() => void onRetry()}
      >
        <TinoIcon name="refresh" /> Tentar novamente
      </button>
      {correlationId && (
        <p className={styles.correlationNote}>
          Código de atendimento: {correlationId}
        </p>
      )}
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
        <TinoBadge name="mercadinho" className={styles.utilityBadge} />
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
      <TinoBadge name="mercadinho" className={styles.utilityBadge} />
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
      <TinoBadge name="notificacoes" className={styles.utilityBadge} />
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
      <TinoBadge
        name={isPayment ? "pagamento-recebido" : "compra-fiada"}
        className={styles.activityBadge}
      />
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
      <TinoBadge
        name={isPayment ? "pagamento-recebido" : "compra-fiada"}
        className={styles.detailBadge}
      />
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
      <TinoBadge name="ver-extrato" className={styles.emptyBadge} />
      <h3>Seu extrato está tranquilo.</h3>
      <p>
        Quando houver uma compra ou pagamento confirmado, ele aparecerá aqui.
      </p>
    </div>
  );
}

function isUnauthenticatedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

type UserFacingIssue = {
  kind: string;
  message: string;
  retryable: boolean;
  correlationId?: string;
};

function describeActivationError(error: unknown): UserFacingIssue {
  if (!(error instanceof ApiError)) {
    return {
      kind: "unavailable",
      message: "Não foi possível validar o convite. Tente novamente.",
      retryable: true,
    };
  }

  const correlationId = error.correlationId;
  if (error.status === 400) {
    return {
      kind: "invalid",
      message: "Este convite não é válido. Peça um novo link ao comerciante.",
      retryable: false,
      correlationId,
    };
  }
  if (error.status === 401) {
    return {
      kind: "unauthenticated",
      message: "Não foi possível validar este convite. Abra o link novamente.",
      retryable: false,
      correlationId,
    };
  }
  if (error.status === 403) {
    return {
      kind: "forbidden",
      message: "Este convite não pode ser usado neste momento.",
      retryable: false,
      correlationId,
    };
  }
  if (error.status === 410) {
    return {
      kind: "expired",
      message: "Este convite expirou. Peça um novo link ao comerciante.",
      retryable: false,
      correlationId,
    };
  }
  if (error.status === 409 || error.status === 429) {
    return {
      kind: "retry",
      message: "Não foi possível concluir a ativação agora. Tente novamente.",
      retryable: true,
      correlationId,
    };
  }
  if (error.status >= 500) {
    return {
      kind: "unavailable",
      message: "O convite não pôde ser validado agora. Tente novamente.",
      retryable: true,
      correlationId,
    };
  }
  return {
    kind: "invalid",
    message: "Este convite não pôde ser validado.",
    retryable: false,
    correlationId,
  };
}

function ActivityErrorNotice({
  error,
  onRetry,
  detail = false,
}: {
  error: unknown;
  onRetry: () => void;
  detail?: boolean;
}) {
  const issue = describeActivityError(error, detail);
  return (
    <InlineError
      correlationId={issue.correlationId}
      kind={issue.kind}
      message={issue.message}
      onRetry={issue.retryable ? onRetry : undefined}
    />
  );
}

function describeActivityError(
  error: unknown,
  detail: boolean,
): UserFacingIssue {
  const correlationId =
    error instanceof ApiError ? error.correlationId : undefined;
  if (error instanceof ApiError && error.status === 401) {
    return {
      kind: "unauthenticated",
      message: "Sua sessão expirou. Atualize para tentar novamente.",
      retryable: true,
      correlationId,
    };
  }
  if (error instanceof ApiError && error.status === 403) {
    return {
      kind: "forbidden",
      message: "Seu acesso não está liberado neste momento.",
      retryable: false,
      correlationId,
    };
  }
  if (
    error instanceof ApiError &&
    (error.status === 404 || error.status === 410)
  ) {
    return {
      kind: "unavailable",
      message: detail
        ? "Essa movimentação não está disponível."
        : "O extrato não está disponível.",
      retryable: false,
      correlationId,
    };
  }
  if (error instanceof ApiError && error.status >= 500) {
    return {
      kind: "unavailable",
      message: "Não conseguimos carregar o extrato agora. Tente novamente.",
      retryable: true,
      correlationId,
    };
  }
  return {
    kind: "retry",
    message: "Não conseguimos carregar o extrato agora. Tente novamente.",
    retryable: true,
    correlationId,
  };
}

function InlineError({
  correlationId,
  kind = "error",
  message,
  onRetry,
}: {
  correlationId?: string;
  kind?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.inlineError} data-state={kind} role="alert">
      <WarningIcon />
      <div className={styles.errorContent}>
        <span>{message}</span>
        {correlationId && (
          <small className={styles.correlationNote}>
            Código de atendimento: {correlationId}
          </small>
        )}
      </div>
      {onRetry && (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
function useAppShellContext() {
  return useOutletContext<{
    installEvent: BeforeInstallPromptEvent | null;
    setInstallEvent: (event: BeforeInstallPromptEvent | null) => void;
  }>();
}
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
  return large ? (
    <img
      className={styles.logoMarkLarge}
      src="/tino/brand/meu-tino-logo.webp"
      alt="Meu TINO"
      width="340"
      height="64"
    />
  ) : (
    <img
      className={styles.logoMark}
      src="/tino/brand/tino-logo.webp"
      alt="Meu TINO"
      width="129"
      height="38"
    />
  );
}

function WelcomeIllustration() {
  return (
    <picture className={styles.welcomeIllustration}>
      <source
        type="image/webp"
        srcSet="/tino/illustrations/boas-vindas-320.webp 320w, /tino/illustrations/boas-vindas-640.webp 640w, /tino/illustrations/boas-vindas-960.webp 960w"
        sizes="(max-width: 680px) calc(100vw - 48px), 360px"
      />
      <img
        src="/tino/illustrations/boas-vindas.png"
        alt=""
        width="960"
        height="640"
      />
    </picture>
  );
}

type TinoIconName =
  | "home"
  | "file-text"
  | "chevron-right"
  | "chevron-left"
  | "arrow-up"
  | "arrow-down"
  | "bell"
  | "download"
  | "shield-check"
  | "info"
  | "refresh";

function TinoIcon({
  name,
  className,
  decorative = true,
}: {
  name: TinoIconName;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      className={`${styles.svgIcon} ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <use href={`/tino/icons/sprite.svg#tino-${name}`} />
    </svg>
  );
}

function TinoBadge({
  name,
  alt = "",
  className,
}: {
  name: string;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={`/tino/badges/${name}.svg`}
      alt={alt}
      width="128"
      height="128"
      loading="lazy"
    />
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function HomeIcon() {
  return <TinoIcon name="home" />;
}
function ActivityIcon() {
  return <TinoIcon name="file-text" />;
}
function ArrowIcon() {
  return <TinoIcon name="chevron-right" />;
}
function ArrowLeftIcon() {
  return <TinoIcon name="chevron-left" />;
}
function ArrowUpIcon() {
  return <TinoIcon name="arrow-up" />;
}
function ArrowDownIcon() {
  return <TinoIcon name="arrow-down" />;
}
function BellIcon() {
  return <TinoIcon name="bell" />;
}
function PhoneIcon() {
  return <TinoIcon name="download" />;
}
function ShieldIcon() {
  return <TinoIcon name="shield-check" />;
}
function WarningIcon() {
  return <TinoIcon name="info" />;
}
