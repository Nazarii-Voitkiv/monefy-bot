'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';

import type {
  CategoriesResponse,
  DashboardPeriod,
  DashboardResponse,
  FrontendCategory,
  FrontendTransaction,
  SortOrder,
  TransactionSortBy,
  TransactionsResponse,
  TransactionTypeFilter} from '../types/index';

type AuthState = 'booting' | 'authenticating' | 'locked' | 'ready' | 'error';
type NoticeTone = 'error' | 'success';
type EditorMode = 'create' | 'edit' | null;

interface FiltersState {
  amountMax: string;
  amountMin: string;
  categoryId: string;
  currency: '' | 'PLN' | 'UAH' | 'USD';
  dateFrom: string;
  dateTo: string;
  period: '' | DashboardPeriod;
  search: string;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
  type: TransactionTypeFilter;
}

interface TransactionFormState {
  amount: string;
  categoryId: string;
  currency: 'PLN' | 'UAH' | 'USD';
  note: string;
  sign: 1 | -1;
  txnAt: string;
}

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'Сьогодні', value: 'today' },
  { label: 'Тиждень', value: 'week' },
  { label: 'Місяць', value: 'month' },
  { label: '30 днів', value: 'last30' }
];

const EMPTY_FILTERS: FiltersState = {
  amountMax: '',
  amountMin: '',
  categoryId: '',
  currency: '',
  dateFrom: '',
  dateTo: '',
  period: 'month',
  search: '',
  sortBy: 'date',
  sortOrder: 'desc',
  type: 'all'
};

function getDefaultTxnAt(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const EMPTY_TRANSACTION_FORM: TransactionFormState = {
  amount: '',
  categoryId: '',
  currency: 'USD',
  note: '',
  sign: -1,
  txnAt: getDefaultTxnAt()
};

function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('uk-UA', {
    currency,
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function setTelegramCssVariables(): void {
  const telegram = window.Telegram?.WebApp;
  if (!telegram) {
    return;
  }

  telegram.ready();
  telegram.expand();

  const root = document.documentElement;
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

function buildQueryString(filters: FiltersState, page: number, limit: number): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  params.set('sortBy', filters.sortBy);
  params.set('sortOrder', filters.sortOrder);
  params.set('type', filters.type);

  if (filters.period) {
    params.set('period', filters.period);
  }

  if (filters.categoryId) {
    params.set('categoryId', filters.categoryId);
  }

  if (filters.currency) {
    params.set('currency', filters.currency);
  }

  if (filters.search.trim()) {
    params.set('search', filters.search.trim());
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
  }

  if (filters.amountMin) {
    params.set('amountMin', filters.amountMin);
  }

  if (filters.amountMax) {
    params.set('amountMax', filters.amountMax);
  }

  return params.toString();
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

function DailyFlowChart({
  items
}: {
  items: DashboardResponse['dailySeries'];
}) {
  const width = 860;
  const height = 240;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const maxValue = Math.max(
    ...items.flatMap((item) => [item.expensesUsd, item.incomesUsd]),
    1
  );
  const visibleLabels = items;

  const toY = (value: number): number =>
    paddingTop + chartHeight - (value / maxValue) * chartHeight;

  const toX = (index: number): number =>
    items.length === 1
      ? width / 2
      : paddingX + (index / (items.length - 1)) * chartWidth;

  const incomesPath = items
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(item.incomesUsd)}`)
    .join(' ');

  const expensesPath = items
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(item.expensesUsd)}`)
    .join(' ');

  return (
    <section className="panel">
      <div className="sectionHeading">
        <div>
          <h3>Графік по днях</h3>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="emptyState">Ще немає даних для графіка.</p>
      ) : (
        <div className="lineChartCard">
          <div className="chartLegend">
            <span className="legendChip income">Доходи</span>
            <span className="legendChip expense">Витрати</span>
          </div>

          <div className="chartViewport">
            <div className="chartCanvas">
              <div className="chartFrame">
                <svg
                  aria-label="Графік руху по днях"
                  className="lineChart"
                  role="img"
                  viewBox={`0 0 ${width} ${height}`}
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = paddingTop + chartHeight - ratio * chartHeight;
                    return (
                      <line
                        className="chartGridLine"
                        key={ratio}
                        x1={paddingX}
                        x2={width - paddingX}
                        y1={y}
                        y2={y}
                      />
                    );
                  })}

                  <path className="chartLine incomeLine" d={incomesPath} />
                  <path className="chartLine expenseLine" d={expensesPath} />

                  {items.map((item, index) => (
                    <g key={item.date}>
                      <circle className="chartPoint incomePoint" cx={toX(index)} cy={toY(item.incomesUsd)} r="4" />
                      <circle className="chartPoint expensePoint" cx={toX(index)} cy={toY(item.expensesUsd)} r="4" />
                    </g>
                  ))}
                </svg>
              </div>

              <div className="chartXAxis">
                {visibleLabels.map((item) => (
                  <span className="chartAxisLabel" key={`${item.date}-axis`}>
                    <span className="chartAxisMonth">{item.date.slice(5, 7)}</span>
                    <span className="chartAxisDay">{item.date.slice(8, 10)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function pickFirstCategory(
  categories: FrontendCategory[],
  sign: 1 | -1
): string {
  const expectedKind = sign === 1 ? 'income' : 'expense';
  return String(categories.find((category) => category.kind === expectedKind)?.id ?? '');
}

export function MiniAppShell() {
  const [scriptReady, setScriptReady] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('booting');
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionsResponse | null>(null);
  const [categories, setCategories] = useState<FrontendCategory[]>([]);
  const [filtersDraft, setFiltersDraft] = useState<FiltersState>(EMPTY_FILTERS);
  const [filtersApplied, setFiltersApplied] = useState<FiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loadingData, setLoadingData] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: NoticeTone } | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(EMPTY_TRANSACTION_FORM);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKind, setNewCategoryKind] = useState<'expense' | 'income'>('expense');
  const [savingCategory, setSavingCategory] = useState(false);
  const [renamingCategoryId, setRenamingCategoryId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.Telegram?.WebApp) {
      setScriptReady(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-telegram-web-app="true"]'
    );
    const handleLoad = () => setScriptReady(true);

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      const fallback = window.setTimeout(() => setScriptReady(true), 500);

      return () => {
        existingScript.removeEventListener('load', handleLoad);
        window.clearTimeout(fallback);
      };
    }

    const script = document.createElement('script');
    script.async = true;
    script.dataset.telegramWebApp = 'true';
    script.src = 'https://telegram.org/js/telegram-web-app.js?61';
    script.addEventListener('load', handleLoad, { once: true });
    document.head.appendChild(script);

    const fallback = window.setTimeout(() => setScriptReady(true), 500);
    return () => {
      script.removeEventListener('load', handleLoad);
      window.clearTimeout(fallback);
    };
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

        if (initData) {
          const response = await fetch('/api/auth/telegram', {
            body: JSON.stringify({ initData }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
          });
          await parseResponse<{ ok: true }>(response);
          if (!cancelled) {
            setAuthState('ready');
          }
          return;
        }

        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (response.ok) {
          await parseResponse<{ ok: true }>(response);
          if (!cancelled) {
            setAuthState('ready');
          }
          return;
        }

        if (!cancelled) {
          setAuthState('locked');
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Authentication failed');
          setAuthState('locked');
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
    const queryString = buildQueryString(filtersApplied, page, 20);

    async function loadData(): Promise<void> {
      setLoadingData(true);
      setAuthError(null);

      try {
        const [dashboardResponse, transactionsResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/dashboard?${queryString}`, { cache: 'no-store' }),
          fetch(`/api/transactions?${queryString}`, { cache: 'no-store' }),
          fetch('/api/categories', { cache: 'no-store' })
        ]);

        const [dashboardPayload, transactionsPayload, categoriesPayload] = await Promise.all([
          parseResponse<DashboardResponse>(dashboardResponse),
          parseResponse<TransactionsResponse>(transactionsResponse),
          parseResponse<CategoriesResponse>(categoriesResponse)
        ]);

        if (!cancelled) {
          setDashboard(dashboardPayload);
          setTransactions(transactionsPayload);
          setCategories(categoriesPayload.items);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Failed to load dashboard');
          setAuthState('error');
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [authState, filtersApplied, page]);

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    setTransactionForm((current) => {
      if (current.categoryId) {
        return current;
      }

      return {
        ...current,
        categoryId: pickFirstCategory(categories, current.sign)
      };
    });
  }, [categories]);

  function resetNotice(): void {
    setNotice(null);
  }

  async function reloadAll(nextPage = page): Promise<void> {
    const queryString = buildQueryString(filtersApplied, nextPage, 20);
    const [dashboardResponse, transactionsResponse, categoriesResponse] = await Promise.all([
      fetch(`/api/dashboard?${queryString}`, { cache: 'no-store' }),
      fetch(`/api/transactions?${queryString}`, { cache: 'no-store' }),
      fetch('/api/categories', { cache: 'no-store' })
    ]);

    const [dashboardPayload, transactionsPayload, categoriesPayload] = await Promise.all([
      parseResponse<DashboardResponse>(dashboardResponse),
      parseResponse<TransactionsResponse>(transactionsResponse),
      parseResponse<CategoriesResponse>(categoriesResponse)
    ]);

    setDashboard(dashboardPayload);
    setTransactions(transactionsPayload);
    setCategories(categoriesPayload.items);
    if (transactionsPayload.page !== nextPage) {
      setPage(transactionsPayload.page);
    }
  }

  function openCreateModal(): void {
    setEditorMode('create');
    setEditingTransactionId(null);
    setTransactionForm({
      ...EMPTY_TRANSACTION_FORM,
      categoryId: pickFirstCategory(categories, -1),
      txnAt: getDefaultTxnAt()
    });
    resetNotice();
  }

  function openEditModal(transaction: FrontendTransaction): void {
    setEditorMode('edit');
    setEditingTransactionId(transaction.id);
    setTransactionForm({
      amount: String(transaction.amount),
      categoryId: String(transaction.categoryId),
      currency: transaction.currency,
      note: transaction.note ?? '',
      sign: transaction.sign,
      txnAt: toDatetimeLocal(transaction.txnAt)
    });
    resetNotice();
  }

  function closeEditor(): void {
    setEditorMode(null);
    setEditingTransactionId(null);
    setTransactionForm(EMPTY_TRANSACTION_FORM);
  }

  async function handleApplyFilters(): Promise<void> {
    startTransition(() => {
      setPage(1);
      setFiltersApplied({ ...filtersDraft });
    });
  }

  async function handleResetFilters(): Promise<void> {
    startTransition(() => {
      setPage(1);
      setFiltersDraft(EMPTY_FILTERS);
      setFiltersApplied(EMPTY_FILTERS);
    });
  }

  async function handleSendCode(): Promise<void> {
    setSendingCode(true);
    setAuthError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/auth/browser/request-code', { method: 'POST' });
      const payload = await parseResponse<{ expiresInSeconds: number }>(response);
      setNotice({
        text: `A login code was sent to Telegram. It expires in ${Math.floor(payload.expiresInSeconds / 60)} minutes.`,
        tone: 'success'
      });
    } catch (error) {
      setNotice(null);
      setAuthError(error instanceof Error ? error.message : 'Failed to send login code');
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode(): Promise<void> {
    setVerifyingCode(true);
    setAuthError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/auth/browser/verify-code', {
        body: JSON.stringify({ code: loginCode }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });

      await parseResponse<{ ok: true }>(response);
      setLoginCode('');
      setNotice(null);
      setAuthState('ready');
    } catch (error) {
      setNotice(null);
      setAuthError(error instanceof Error ? error.message : 'Failed to verify login code');
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    setDashboard(null);
    setTransactions(null);
    setCategories([]);
    setLoginCode('');
    setAuthState('locked');
  }

  async function handleSaveTransaction(): Promise<void> {
    setSavingTransaction(true);
    resetNotice();

    try {
      const endpoint =
        editorMode === 'edit' && editingTransactionId
          ? `/api/transactions/${editingTransactionId}`
          : '/api/transactions';
      const method = editorMode === 'edit' ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        body: JSON.stringify({
          amount: Number(transactionForm.amount),
          categoryId: Number(transactionForm.categoryId),
          currency: transactionForm.currency,
          note: transactionForm.note,
          sign: transactionForm.sign,
          txnAt: new Date(transactionForm.txnAt).toISOString()
        }),
        headers: { 'Content-Type': 'application/json' },
        method
      });

      await parseResponse(response);
      await reloadAll();
      setNotice({
        text: editorMode === 'edit' ? 'Транзакцію оновлено.' : 'Транзакцію додано.',
        tone: 'success'
      });
      closeEditor();
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Не вдалося зберегти транзакцію.',
        tone: 'error'
      });
    } finally {
      setSavingTransaction(false);
    }
  }

  async function handleDeleteTransaction(id: number): Promise<void> {
    if (!window.confirm('Видалити цю транзакцію?')) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      await parseResponse<{ ok: true }>(response);
      await reloadAll(page);
      setNotice({ text: 'Транзакцію видалено.', tone: 'success' });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Не вдалося видалити транзакцію.',
        tone: 'error'
      });
    }
  }

  async function handleAddCategory(): Promise<void> {
    setSavingCategory(true);
    resetNotice();

    try {
      const response = await fetch('/api/categories', {
        body: JSON.stringify({
          kind: newCategoryKind,
          name: newCategoryName
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });
      await parseResponse(response);
      setNewCategoryName('');
      await reloadAll(page);
      setNotice({ text: 'Категорію додано.', tone: 'success' });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Не вдалося додати категорію.',
        tone: 'error'
      });
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleRenameCategory(id: number): Promise<void> {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        body: JSON.stringify({ name: renameValue }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH'
      });
      await parseResponse(response);
      setRenamingCategoryId(null);
      setRenameValue('');
      await reloadAll(page);
      setNotice({ text: 'Категорію оновлено.', tone: 'success' });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Не вдалося оновити категорію.',
        tone: 'error'
      });
    }
  }

  async function handleDeleteCategory(id: number): Promise<void> {
    if (!window.confirm('Видалити цю категорію?')) {
      return;
    }

    try {
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      await parseResponse(response);
      await reloadAll(page);
      setNotice({ text: 'Категорію видалено.', tone: 'success' });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Не вдалося видалити категорію.',
        tone: 'error'
      });
    }
  }

  if (authState === 'booting' || authState === 'authenticating') {
    return (
      <main className="shell authShell">
        <section className="heroCard authCard">
          <span className="eyebrow">Dashboard</span>
          <h1>Loading dashboard…</h1>
          <p>Please wait while your private workspace is being prepared.</p>
        </section>
      </main>
    );
  }

  if (authState === 'locked') {
    return (
      <main className="shell authShell">
        <section className="heroCard authCard">
          <h1>Private Access</h1>
          <p>Request a one-time code in Telegram and use it here to unlock your browser session.</p>

          <div className="authActions">
            <button className="primaryButton" disabled={sendingCode} onClick={() => void handleSendCode()} type="button">
              {sendingCode ? 'Sending…' : 'Send code in Telegram'}
            </button>
            <input
              className="textInput"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              value={loginCode}
            />
            <button
              className="secondaryButton"
              disabled={verifyingCode || loginCode.length !== 6}
              onClick={() => void handleVerifyCode()}
              type="button"
            >
              {verifyingCode ? 'Verifying…' : 'Verify code'}
            </button>
          </div>

          {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
          {authError ? <p className="notice error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  if (authState === 'error') {
    return (
      <main className="shell authShell">
        <section className="heroCard authCard">
          <span className="eyebrow">Error</span>
          <h1>Dashboard unavailable</h1>
          <p>{authError ?? 'Please refresh and try again.'}</p>
          <button
            className="primaryButton"
            onClick={() => {
              setAuthState('booting');
              setScriptReady(true);
            }}
            type="button"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
      <main className="shell adminShell">
      <section className="heroCard adminHero">
        <div className="heroHeading">
          <h1>Дашборд</h1>
          <p>Твої фінанси</p>
        </div>
        <div className="heroActions">
          <button className="primaryButton" onClick={openCreateModal} type="button">
            Додати транзакцію
          </button>
          <button className="secondaryButton" onClick={() => void handleLogout()} type="button">
            Вийти
          </button>
        </div>
      </section>

      {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}

      <section className="panel summaryPanel">
        <div className="sectionHeading">
          <div>
            <h3>Огляд</h3>
            <span>{dashboard?.rangeLabel ?? 'Усі дати'}</span>
          </div>
          <span>{dashboard ? `${dashboard.totalTransactions} записів` : '...'}</span>
        </div>
        <section className="summaryGrid">
          <SummaryCard
            label="Доходи"
            tone="positive"
            value={dashboard ? formatMoney(dashboard.summary.incomesUsd) : '...'}
          />
          <SummaryCard
            label="Витрати"
            tone="negative"
            value={dashboard ? formatMoney(dashboard.summary.expensesUsd) : '...'}
          />
          <SummaryCard
            label="Баланс"
            tone="neutral"
            value={dashboard ? formatMoney(dashboard.summary.totalUsd) : '...'}
          />
        </section>
        {dashboard ? <DailyFlowChart items={dashboard.dailySeries} /> : null}
      </section>

      <section className="panel">
        <div className="sectionHeading">
          <div>
            <h3>Фільтри</h3>
            <span>Контролюй таблицю і summary одним набором фільтрів.</span>
          </div>
        </div>

        <div className="filterLayout">
          <div className="filterGroup wide">
            <label>Швидкий період</label>
            <div className="periodChips">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  className={filtersDraft.period === option.value ? 'isActive' : ''}
                  key={option.value}
                  onClick={() =>
                    setFiltersDraft((current) => ({
                      ...current,
                      dateFrom: '',
                      dateTo: '',
                      period: option.value
                    }))
                  }
                  type="button"
                >
                  {option.label}
                </button>
              ))}
              <button
                className={filtersDraft.period === '' ? 'isActive' : ''}
                onClick={() =>
                  setFiltersDraft((current) => ({
                    ...current,
                    period: ''
                  }))
                }
                type="button"
              >
                Без пресета
              </button>
            </div>
          </div>

          <div className="filterGroup">
            <label>Тип</label>
            <select
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, type: event.target.value as TransactionTypeFilter }))
              }
              value={filtersDraft.type}
            >
              <option value="all">Усі</option>
              <option value="expense">Витрати</option>
              <option value="income">Доходи</option>
            </select>
          </div>

          <div className="filterGroup">
            <label>Категорія</label>
            <select
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, categoryId: event.target.value }))
              }
              value={filtersDraft.categoryId}
            >
              <option value="">Усі</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filterGroup">
            <label>Валюта</label>
            <select
              onChange={(event) =>
                setFiltersDraft((current) => ({
                  ...current,
                  currency: event.target.value as FiltersState['currency']
                }))
              }
              value={filtersDraft.currency}
            >
              <option value="">Усі</option>
              <option value="USD">USD</option>
              <option value="PLN">PLN</option>
              <option value="UAH">UAH</option>
            </select>
          </div>

          <div className="filterGroup wide">
            <label>Пошук у нотатках</label>
            <input
              className="textInput"
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Наприклад: таксі, обід, подарунок"
              value={filtersDraft.search}
            />
          </div>

          <div className="filterGroup">
            <label>Дата від</label>
            <input
              className="textInput"
              onChange={(event) =>
                setFiltersDraft((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                  period: ''
                }))
              }
              type="date"
              value={filtersDraft.dateFrom}
            />
          </div>

          <div className="filterGroup">
            <label>Дата до</label>
            <input
              className="textInput"
              onChange={(event) =>
                setFiltersDraft((current) => ({
                  ...current,
                  dateTo: event.target.value,
                  period: ''
                }))
              }
              type="date"
              value={filtersDraft.dateTo}
            />
          </div>

          <div className="filterGroup">
            <label>Сума від</label>
            <input
              className="textInput"
              min="0"
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, amountMin: event.target.value }))
              }
              step="0.01"
              type="number"
              value={filtersDraft.amountMin}
            />
          </div>

          <div className="filterGroup">
            <label>Сума до</label>
            <input
              className="textInput"
              min="0"
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, amountMax: event.target.value }))
              }
              step="0.01"
              type="number"
              value={filtersDraft.amountMax}
            />
          </div>

          <div className="filterGroup">
            <label>Сортування</label>
            <select
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, sortBy: event.target.value as TransactionSortBy }))
              }
              value={filtersDraft.sortBy}
            >
              <option value="date">Дата</option>
              <option value="amount">Сума</option>
              <option value="amountUsd">USD екв.</option>
              <option value="category">Категорія</option>
              <option value="currency">Валюта</option>
            </select>
          </div>

          <div className="filterGroup">
            <label>Порядок</label>
            <select
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, sortOrder: event.target.value as SortOrder }))
              }
              value={filtersDraft.sortOrder}
            >
              <option value="desc">Спадання</option>
              <option value="asc">Зростання</option>
            </select>
          </div>
        </div>

        <div className="toolbar">
          <button className="primaryButton" onClick={() => void handleApplyFilters()} type="button">
            Застосувати
          </button>
          <button className="secondaryButton" onClick={() => void handleResetFilters()} type="button">
            Скинути
          </button>
        </div>
      </section>

      <div className="adminGrid">
        <section className="panel">
          <div className="sectionHeading">
            <div>
              <h3>Транзакції</h3>
              <span>
                {transactions ? `Сторінка ${transactions.page} з ${transactions.totalPages}` : 'Завантаження...'}
              </span>
            </div>
          </div>

          {loadingData && !transactions ? (
            <p className="emptyState">Підвантажую таблицю…</p>
          ) : transactions && transactions.items.length > 0 ? (
            <>
              <div className="transactionsTable">
                {transactions.items.map((transaction) => (
                  <article className="transactionCard" key={transaction.id}>
                    <div className="transactionCardMain">
                      <div>
                        <strong>{transaction.categoryName}</strong>
                        <p>
                          {formatDateTime(transaction.txnAt)}
                          {transaction.note ? ` · ${transaction.note}` : ''}
                        </p>
                      </div>
                      <div className="transactionCardAmount">
                        <span className={transaction.sign === 1 ? 'positiveText' : 'negativeText'}>
                          {formatAmount(transaction)}
                        </span>
                        <small>{formatMoney(transaction.amountUsd)}</small>
                      </div>
                    </div>

                    <div className="transactionMeta">
                      <span>{transaction.currency}</span>
                      <span>{transaction.isRateApprox ? '≈ курс' : 'точний курс'}</span>
                      <span>{transaction.rateDate}</span>
                    </div>

                    <div className="rowActions">
                      <button className="secondaryButton" onClick={() => openEditModal(transaction)} type="button">
                        Редагувати
                      </button>
                      <button className="dangerButton" onClick={() => void handleDeleteTransaction(transaction.id)} type="button">
                        Видалити
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="pager">
                <button
                  disabled={!transactions || transactions.page <= 1}
                  onClick={() => startTransition(() => setPage((current) => Math.max(1, current - 1)))}
                  type="button"
                >
                  Назад
                </button>
                <button
                  disabled={!transactions || transactions.page >= transactions.totalPages}
                  onClick={() =>
                    startTransition(() =>
                      setPage((current) => (transactions ? Math.min(transactions.totalPages, current + 1) : current))
                    )
                  }
                  type="button"
                >
                  Далі
                </button>
              </div>
            </>
          ) : (
            <p className="emptyState">За цими фільтрами записів немає.</p>
          )}
        </section>

        <section className="panel">
          <div className="sectionHeading">
            <div>
              <h3>Категорії</h3>
              <span>Створюй, перейменовуй і чисть зайве.</span>
            </div>
          </div>

          <div className="categoryComposer">
            <input
              className="textInput"
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Нова категорія"
              value={newCategoryName}
            />
            <select onChange={(event) => setNewCategoryKind(event.target.value as 'expense' | 'income')} value={newCategoryKind}>
              <option value="expense">Витрата</option>
              <option value="income">Дохід</option>
            </select>
            <button className="primaryButton" disabled={savingCategory || !newCategoryName.trim()} onClick={() => void handleAddCategory()} type="button">
              Додати
            </button>
          </div>

          <div className="categoryList">
            {categories.map((category) => (
              <article className="categoryRow" key={category.id}>
                <div className="categoryInfo">
                  {renamingCategoryId === category.id ? (
                    <input
                      className="textInput"
                      onChange={(event) => setRenameValue(event.target.value)}
                      value={renameValue}
                    />
                  ) : (
                    <>
                      <strong>{category.name}</strong>
                      <p>
                        {category.kind === 'income' ? 'Дохід' : 'Витрата'} · {category.usageCount} записів
                      </p>
                    </>
                  )}
                </div>

                <div className="rowActions">
                  {renamingCategoryId === category.id ? (
                    <>
                      <button className="primaryButton" onClick={() => void handleRenameCategory(category.id)} type="button">
                        Зберегти
                      </button>
                      <button
                        className="secondaryButton"
                        onClick={() => {
                          setRenamingCategoryId(null);
                          setRenameValue('');
                        }}
                        type="button"
                      >
                        Скасувати
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="secondaryButton"
                        onClick={() => {
                          setRenamingCategoryId(category.id);
                          setRenameValue(category.name);
                        }}
                        type="button"
                      >
                        Перейменувати
                      </button>
                      <button
                        className="dangerButton"
                        disabled={category.usageCount > 0}
                        onClick={() => void handleDeleteCategory(category.id)}
                        type="button"
                      >
                        Видалити
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {dashboard ? (
        <div className="breakdownGrid">
          <section className="panel">
            <div className="sectionHeading">
              <h3>Доходи по категоріях</h3>
            </div>
            <div className="bars">
              {dashboard.breakdown.incomes.length > 0 ? (
                dashboard.breakdown.incomes.map((item) => (
                  <div className="barRow" key={`income-${item.name}`}>
                    <div className="barMeta">
                      <span>{item.name}</span>
                      <strong>{formatMoney(item.total)}</strong>
                    </div>
                    <div className="barTrack">
                      <div
                        className="barFill"
                        style={{
                          width: `${(item.total / dashboard.breakdown.incomes[0].total) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">Доходів по цих фільтрах ще немає.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="sectionHeading">
              <h3>Витрати по категоріях</h3>
            </div>
            <div className="bars">
              {dashboard.breakdown.expenses.length > 0 ? (
                dashboard.breakdown.expenses.map((item) => (
                  <div className="barRow" key={`expense-${item.name}`}>
                    <div className="barMeta">
                      <span>{item.name}</span>
                      <strong>{formatMoney(item.total)}</strong>
                    </div>
                    <div className="barTrack">
                      <div
                        className="barFill"
                        style={{
                          width: `${(item.total / dashboard.breakdown.expenses[0].total) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">Витрат по цих фільтрах ще немає.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {editorMode ? (
        <div className="modalBackdrop" role="presentation">
          <section className="modalCard">
            <div className="sectionHeading">
              <div>
                <h3>{editorMode === 'edit' ? 'Редагувати транзакцію' : 'Нова транзакція'}</h3>
                <span>Повний контроль над сумою, датою, категорією і нотаткою.</span>
              </div>
              <button className="secondaryButton" onClick={closeEditor} type="button">
                Закрити
              </button>
            </div>

            <div className="formGrid">
              <div className="filterGroup">
                <label>Тип</label>
                <select
                  onChange={(event) =>
                    setTransactionForm((current) => {
                      const nextSign = Number(event.target.value) as 1 | -1;
                      const currentCategory = current.categoryId ? categoriesById.get(Number(current.categoryId)) : null;
                      const nextCategoryId =
                        currentCategory?.kind === (nextSign === 1 ? 'income' : 'expense')
                          ? current.categoryId
                          : pickFirstCategory(categories, nextSign);

                      return {
                        ...current,
                        categoryId: nextCategoryId,
                        sign: nextSign
                      };
                    })
                  }
                  value={transactionForm.sign}
                >
                  <option value={-1}>Витрата</option>
                  <option value={1}>Дохід</option>
                </select>
              </div>

              <div className="filterGroup">
                <label>Сума</label>
                <input
                  className="textInput"
                  min="0"
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  step="0.01"
                  type="number"
                  value={transactionForm.amount}
                />
              </div>

              <div className="filterGroup">
                <label>Валюта</label>
                <select
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      currency: event.target.value as TransactionFormState['currency']
                    }))
                  }
                  value={transactionForm.currency}
                >
                  <option value="USD">USD</option>
                  <option value="PLN">PLN</option>
                  <option value="UAH">UAH</option>
                </select>
              </div>

              <div className="filterGroup">
                <label>Категорія</label>
                <select
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  value={transactionForm.categoryId}
                >
                  <option value="">Оберіть категорію</option>
                  {categories
                    .filter((category) => category.kind === (transactionForm.sign === 1 ? 'income' : 'expense'))
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="filterGroup">
                <label>Дата і час</label>
                <input
                  className="textInput"
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, txnAt: event.target.value }))
                  }
                  type="datetime-local"
                  value={transactionForm.txnAt}
                />
              </div>

              <div className="filterGroup wide">
                <label>Нотатка</label>
                <textarea
                  className="textInput textArea"
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Опційно"
                  rows={3}
                  value={transactionForm.note}
                />
              </div>
            </div>

            <div className="toolbar">
              <button
                className="primaryButton"
                disabled={
                  savingTransaction ||
                  !transactionForm.amount ||
                  !transactionForm.categoryId ||
                  !transactionForm.txnAt
                }
                onClick={() => void handleSaveTransaction()}
                type="button"
              >
                {savingTransaction ? 'Зберігаю…' : 'Зберегти'}
              </button>
              <button className="secondaryButton" onClick={closeEditor} type="button">
                Скасувати
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
