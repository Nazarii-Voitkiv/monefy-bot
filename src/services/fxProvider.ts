import NodeCache from 'node-cache';

import { env } from '../config/env.js';
import { supabase } from '../db/client.js';

const cache = new NodeCache({ stdTTL: 60 * 60 });

export interface FxRate {
  rateDate: string;
  pln: number;
  uah: number;
  usd: number;
  isApprox: boolean;
}

export interface FxProvider {
  getDailyRates(date: string): Promise<FxRate>;
}

interface FxApiSuccessResponse {
  result: 'success';
  base_code: string;
  conversion_rates: Record<string, number>;
}

interface FxApiErrorResponse {
  result: 'error';
  error_type: string;
}

type FxApiResponse = FxApiSuccessResponse | FxApiErrorResponse;

function deserializeFxRate(row: {
  rateDate: string;
  pln: string;
  uah: string;
  usd: string;
}): FxRate {
  return {
    rateDate: row.rateDate,
    pln: Number(row.pln),
    uah: Number(row.uah),
    usd: Number(row.usd),
    isApprox: false
  };
}

function toNumericString(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

async function persistRate(rate: FxRate): Promise<void> {
  if (rate.isApprox) {
    return;
  }

  const { data: existing, error: selectErr } = await supabase
    .from('fx_rates')
    .select('rate_date')
    .eq('rate_date', rate.rateDate)
    .limit(1);

  if (selectErr) throw selectErr;
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from('fx_rates').insert({
    rate_date: rate.rateDate,
    base: 'USD',
    pln: toNumericString(rate.pln, 6),
    uah: toNumericString(rate.uah, 6),
    usd: toNumericString(rate.usd, 6)
  });

  if (error) throw error;
}

async function fetchStoredRate(date: string): Promise<FxRate | undefined> {
  const { data, error } = await supabase
    .from('fx_rates')
    .select('rate_date, pln, uah, usd')
    .eq('rate_date', date)
    .limit(1);

  if (error) throw error;
  const stored = data && data[0];
  if (!stored) return undefined;
  return deserializeFxRate({ rateDate: stored.rate_date, pln: stored.pln, uah: stored.uah, usd: stored.usd });
}

function buildEndpoint(date: string): string {
  const baseUrl = env.FX_API_URL.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const [year, month, day] = date.split('-');

  if (date >= today) {
    return `${baseUrl}/${env.FX_API_KEY}/latest/USD`;
  }

  return `${baseUrl}/${env.FX_API_KEY}/history/USD/${year}/${month}/${day}`;
}

async function fetchFromApi(date: string): Promise<FxRate> {
  const endpoint = buildEndpoint(date);
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Fx API error: ${response.status}`);
  }

  const payload = (await response.json()) as FxApiResponse;
  if (payload.result === 'error') {
    throw new Error(`Fx API returned unsuccessful response: ${payload.error_type}`);
  }

  const rates = payload.conversion_rates;
  const pln = rates.PLN;
  const uah = rates.UAH;
  const usd = rates.USD ?? 1;

  if (!pln || !uah) {
    throw new Error('Fx API returned invalid rates');
  }

  return {
    rateDate: date,
    pln,
    uah,
    usd,
    isApprox: false
  };
}

async function fetchFallbackRate(targetDate: string, originalError: Error): Promise<FxRate> {
  const today = new Date().toISOString().slice(0, 10);
  if (targetDate === today) {
    throw originalError;
  }

  const todayCacheKey = `fx:${today}`;
  const cachedToday = cache.get<FxRate>(todayCacheKey);
  if (cachedToday && !cachedToday.isApprox) {
    return {
      ...cachedToday,
      rateDate: targetDate,
      isApprox: true
    };
  }

  const storedToday = await fetchStoredRate(today);
  if (storedToday) {
    cache.set(todayCacheKey, storedToday);
    return {
      ...storedToday,
      rateDate: targetDate,
      isApprox: true
    };
  }

  try {
    const latest = await fetchFromApi(today);
    await persistRate(latest);
    cache.set(todayCacheKey, latest);
    return {
      ...latest,
      rateDate: targetDate,
      isApprox: true
    };
  } catch (fallbackError) {
    throw originalError;
  }
}

export class ExchangerateApiProvider implements FxProvider {
  async getDailyRates(date: string): Promise<FxRate> {
    const cacheKey = `fx:${date}`;
    const cached = cache.get<FxRate>(cacheKey);
    if (cached) {
      return cached;
    }

    const stored = await fetchStoredRate(date);
    if (stored) {
      const parsed = { ...stored, isApprox: false };
      cache.set(cacheKey, parsed);
      return parsed;
    }

    try {
      const fresh = await fetchFromApi(date);
      await persistRate(fresh);
      cache.set(cacheKey, fresh);
      return fresh;
    } catch (error) {
      const fallback = await fetchFallbackRate(date, error as Error);
      cache.set(cacheKey, fallback);
      return fallback;
    }
  }
}

export const fxProvider = new ExchangerateApiProvider();
