'use client';

import { startTransition, useEffect, useState } from 'react';

import type {
  ClientTab,
  DashboardPeriod,
  DashboardResponse,
  FrontendTransaction,
  TransactionsResponse
} from '../types/index';

type AuthState = 'booting' | 'authenticating' | 'locked' | 'ready' | 'error';

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'Сьогодні', value: 'today' },
  { label: 'Тиждень', value: 'week' },
  { label: 'Місяць', value: 'month' },
  { label: '30 днів', value: 'last30' }
];

function formatUsd(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency'
  }).format(value);
}

function formatAmount(transaction: FrontendTransaction): string {
  return new Intl.NumberFormat('uk-UA', {
    currency: transaction.currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency'
  }).format(transaction.amount * transaction.sign);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

function setTelegramCssVariables(): void {
  const telegram = window.Telegram?.WebApp;
  if (!telegram) {
    return;
  }

  telegram.ready();
  telegram.expand();

  const root = document.documentElement;
  const theme = telegram.themeParams;
  if (theme?.bg_color) {
    root.style.setProperty('--app-bg', theme.bg_color);
  }
  if (theme?.text_color) {
    root.style.setProperty('--text-main', theme.text_color);
  }
  if (theme?.hint_color) {
    root.style.setProperty('--text-muted', theme.hint_color);
  }
  if (theme?.button_color) {
    root.style.setProperty('--accent', theme.button_color);
  }

  const safeArea = telegram.contentSafeAreaInset ?? telegram.safeAreaInset;
  root.style.setProperty('--tg-safe-top', `${safeArea?.top ?? 0}px`);
  root.style.setProperty('--tg-safe-bottom', `${safeArea?.bottom ?? 0}px`);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed');
  }
  return payload;
}

function SummaryCard({
  label,
  tone,
  value
}: {
  label: string;
  tone: 'neutral' | 'negative' | 'positive';
  value: string;
}) {
  return (
    <article className={`summaryCard tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function BreakdownList({
  items,
  title
}: {
  items: DashboardResponse['breakdown']['expenses'];
  title: string;
}) {
  const maxTotal = items.reduce((current, item) => Math.max(current, item.total), 0);

  return (
    <section className="panel">
      <div className="sectionHeading">
        <h3>{title}</h3>
      </div>
      <div className="bars">
        {items.length === 0 ? (
          <p className="emptyState">За цей період тут поки порожньо.</p>
        ) : (
          items.map((item) => (
            <div className="barRow" key={`${title}-${item.name}`}>
              <div className="barMeta">
                <span>{item.name}</span>
                <strong>{formatUsd(item.total)}</strong>
              </div>
              <div className="barTrack">
                <div
                  className="barFill"
                  style={{ width: `${maxTotal > 0 ? (item.total / maxTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TransactionsList({
  items,
  title
}: {
  items: FrontendTransaction[];
  title: string;
}) {
  return (
    <section className="panel">
      <div className="sectionHeading">
        <h3>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="emptyState">Транзакцій поки немає.</p>
      ) : (
        <div className="transactions">
          {items.map((item) => (
            <article className="transactionRow" key={item.id}>
              <div>
                <p>{item.categoryName}</p>
                <span>
                  {formatDate(item.txnAt)}
                  {item.note ? ` · ${item.note}` : ''}
                </span>
              </div>
              <div className={`transactionAmount ${item.sign === 1 ? 'positive' : 'negative'}`}>
                <strong>{formatAmount(item)}</strong>
                <span>{formatUsd(item.amountUsd)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function MiniAppShell() {
  const [scriptReady, setScriptReady] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('booting');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClientTab>('overview');
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [history, setHistory] = useState<TransactionsResponse | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.Telegram?.WebApp) {
      setScriptReady(true);
      return;
    }

    const fallback = window.setTimeout(() => {
      setScriptReady(true);
    }, 250);

    return () => window.clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!scriptReady) {
      return;
    }

    let cancelled = false;

    async function authenticate(): Promise<void> {
      setAuthState('authenticating');
      setAuthError(null);

      try {
        setTelegramCssVariables();
        const initData = window.Telegram?.WebApp?.initData ?? '';
        if (!initData && process.env.NODE_ENV === 'production') {
          if (!cancelled) {
            setAuthState('locked');
          }
          return;
        }

        const response = await fetch('/api/auth/telegram', {
          body: JSON.stringify({ initData }),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST'
        });

        await parseResponse<{ ok: true }>(response);
        if (!cancelled) {
          setAuthState('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Authentication failed');
          setAuthState(process.env.NODE_ENV === 'production' ? 'locked' : 'error');
        }
      }
    }

    void authenticate();

    return () => {
      cancelled = true;
    };
  }, [scriptReady]);

  useEffect(() => {
    if (authState !== 'ready') {
      return;
    }

    let cancelled = false;

    async function loadDashboard(): Promise<void> {
      setLoadingDashboard(true);
      try {
        const response = await fetch(`/api/dashboard?period=${period}`, {
          cache: 'no-store'
        });
        const payload = await parseResponse<DashboardResponse>(response);
        if (!cancelled) {
          setDashboard(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Failed to load dashboard');
          setAuthState('error');
        }
      } finally {
        if (!cancelled) {
          setLoadingDashboard(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authState, period]);

  useEffect(() => {
    if (authState !== 'ready') {
      return;
    }

    let cancelled = false;

    async function loadHistory(): Promise<void> {
      setLoadingHistory(true);
      try {
        const response = await fetch(`/api/transactions?page=${historyPage}&limit=20`, {
          cache: 'no-store'
        });
        const payload = await parseResponse<TransactionsResponse>(response);
        if (!cancelled) {
          setHistory(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Failed to load history');
          setAuthState('error');
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [authState, historyPage]);

  if (authState === 'booting' || authState === 'authenticating') {
    return (
      <main className="shell">
        <section className="heroCard">
          <span className="eyebrow">Monefy Dashboard</span>
          <h1>Піднімаю приватний дашборд…</h1>
          <p>Зачекай кілька секунд, поки я підтягну Telegram-сесію і твої дані.</p>
        </section>
      </main>
    );
  }

  if (authState === 'locked') {
    return (
      <main className="shell">
        <section className="heroCard">
          <span className="eyebrow">Private Access</span>
          <h1>Цей дашборд відкривається тільки з Telegram-бота.</h1>
          <p>
            Запусти бота, натисни кнопку меню або команду <code>/start</code> і відкрий Mini App звідти.
          </p>
          {authError ? <p className="errorText">{authError}</p> : null}
        </section>
      </main>
    );
  }

  if (authState === 'error') {
    return (
      <main className="shell">
        <section className="heroCard">
          <span className="eyebrow">Помилка</span>
          <h1>Не вдалося завантажити приватний кабінет.</h1>
          <p>{authError ?? 'Спробуй перезавантажити Mini App.'}</p>
          <button
            className="primaryButton"
            onClick={() => {
              setAuthState('booting');
              setScriptReady(true);
            }}
            type="button"
          >
            Спробувати ще раз
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="heroCard">
        <span className="eyebrow">Private Telegram Mini App</span>
        <div className="heroRow">
          <div>
            <h1>Твої фінанси без шуму.</h1>
            <p>
              Охайний огляд витрат, доходів і останніх рухів за {dashboard?.rangeLabel ?? 'обраний період'}.
            </p>
          </div>
          <div className="tabPills">
            <button
              className={activeTab === 'overview' ? 'isActive' : ''}
              onClick={() => setActiveTab('overview')}
              type="button"
            >
              Огляд
            </button>
            <button
              className={activeTab === 'history' ? 'isActive' : ''}
              onClick={() => setActiveTab('history')}
              type="button"
            >
              Історія
            </button>
          </div>
        </div>
      </section>

      {activeTab === 'overview' ? (
        <>
          <section className="panel filterPanel">
            <div className="sectionHeading">
              <h3>Період</h3>
              {dashboard ? <span>{dashboard.rangeLabel}</span> : null}
            </div>
            <div className="periodChips">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  className={period === option.value ? 'isActive' : ''}
                  key={option.value}
                  onClick={() => {
                    startTransition(() => {
                      setPeriod(option.value);
                    });
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="summaryGrid">
            <SummaryCard
              label="Доходи"
              tone="positive"
              value={dashboard ? formatUsd(dashboard.summary.incomesUsd) : '...'}
            />
            <SummaryCard
              label="Витрати"
              tone="negative"
              value={dashboard ? formatUsd(dashboard.summary.expensesUsd) : '...'}
            />
            <SummaryCard
              label="Баланс"
              tone="neutral"
              value={dashboard ? formatUsd(dashboard.summary.totalUsd) : '...'}
            />
          </section>

          {loadingDashboard && !dashboard ? (
            <section className="panel">
              <p className="emptyState">Підвантажую дашборд…</p>
            </section>
          ) : (
            <>
              <div className="twoColumn">
                <BreakdownList
                  items={dashboard?.breakdown.expenses ?? []}
                  title="Витрати по категоріях"
                />
                <BreakdownList
                  items={dashboard?.breakdown.incomes ?? []}
                  title="Доходи по категоріях"
                />
              </div>
              <TransactionsList
                items={dashboard?.recentTransactions ?? []}
                title="Останні транзакції"
              />
            </>
          )}
        </>
      ) : (
        <section className="panel historyPanel">
          <div className="sectionHeading">
            <h3>Історія транзакцій</h3>
            {history ? (
              <span>
                Сторінка {history.page} / {history.totalPages}
              </span>
            ) : null}
          </div>
          {loadingHistory && !history ? (
            <p className="emptyState">Підвантажую історію…</p>
          ) : (
            <>
              <TransactionsList items={history?.items ?? []} title="Усі записи" />
              <div className="pager">
                <button
                  disabled={!history || history.page <= 1}
                  onClick={() => {
                    startTransition(() => {
                      setHistoryPage((current) => Math.max(1, current - 1));
                    });
                  }}
                  type="button"
                >
                  Назад
                </button>
                <button
                  disabled={!history || history.page >= history.totalPages}
                  onClick={() => {
                    startTransition(() => {
                      setHistoryPage((current) =>
                        history ? Math.min(history.totalPages, current + 1) : current
                      );
                    });
                  }}
                  type="button"
                >
                  Далі
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
