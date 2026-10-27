import { supabase } from '../../supabase';

const FREE_SCAN_LIMIT = 10;
const PRO_SCAN_LIMIT = 150;
const USED_KEY = 'caneto_ai_scans_used';
const LIMIT_KEY = 'caneto_ai_scans_limit';
const RESET_KEY = 'caneto_ai_scans_reset_at';
const PLAN_KEY = 'caneto_plan_tier';

export type ScanQuota = {
  planTier: 'free' | 'pro';
  scansUsed: number;
  scansLimit: number;
  scansRemaining: number;
  isLimitReached: boolean;
};

function nextReset() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

export function readScanQuota(profile?: { planTier?: 'free' | 'pro'; aiScansUsedThisMonth?: number; aiScansLimit?: number; aiScansResetAt?: string } | null): ScanQuota {
  const planTier = profile?.planTier || (typeof localStorage !== 'undefined' ? localStorage.getItem(PLAN_KEY) as 'free' | 'pro' | null : null) || 'free';
  const defaultLimit = planTier === 'pro' ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT;
  let scansLimit = profile?.aiScansLimit || Number(typeof localStorage !== 'undefined' ? localStorage.getItem(LIMIT_KEY) : 0) || defaultLimit;
  let scansUsed = (profile?.aiScansUsedThisMonth ?? Number(typeof localStorage !== 'undefined' ? localStorage.getItem(USED_KEY) : 0)) || 0;
  let resetAt = profile?.aiScansResetAt || (typeof localStorage !== 'undefined' ? localStorage.getItem(RESET_KEY) : null);
  if (!resetAt || new Date(resetAt).getTime() <= Date.now()) {
    resetAt = nextReset();
    scansUsed = 0;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RESET_KEY, resetAt);
      localStorage.setItem(USED_KEY, '0');
    }
  }
  if (typeof localStorage !== 'undefined') {
    const localUsed = Number(localStorage.getItem(USED_KEY) || 0);
    scansUsed = Math.max(scansUsed, localUsed);
    localStorage.setItem(PLAN_KEY, planTier);
    localStorage.setItem(LIMIT_KEY, String(scansLimit));
  }
  if (!Number.isFinite(scansLimit) || scansLimit <= 0) scansLimit = defaultLimit;
  return {
    planTier, scansUsed, scansLimit,
    scansRemaining: Math.max(0, scansLimit - scansUsed),
    isLimitReached: scansUsed >= scansLimit,
  };
}

export function assertCanScan(profile?: Parameters<typeof readScanQuota>[0]) {
  const quota = readScanQuota(profile);
  if (quota.isLimitReached) {
    throw new Error(quota.planTier === 'pro'
      ? `A cota de ${quota.scansLimit} leituras com IA deste mês acabou.`
      : `A cota gratuita de ${quota.scansLimit} leituras com IA deste mês acabou.`);
  }
  return quota;
}

export async function consumeAiScan(userId: string) {
  const current = readScanQuota();
  const next = current.scansUsed + 1;
  if (typeof localStorage !== 'undefined') localStorage.setItem(USED_KEY, String(next));
  const { data, error } = await supabase.rpc('increment_user_ai_scan', { p_user_id: userId });
  if (!error && typeof data === 'number' && data > 0 && typeof localStorage !== 'undefined') {
    localStorage.setItem(USED_KEY, String(Math.max(next, data)));
  }
  return readScanQuota();
}
