export const UNITS = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'] as const;
export type Unit = (typeof UNITS)[number];
export type Duration = Record<Unit, number>;

export const UNIT_LABELS: Record<Unit, { en: string; th: string }> = {
  years: { en: 'YEARS', th: 'ปี' },
  months: { en: 'MONTHS', th: 'เดือน' },
  days: { en: 'DAYS', th: 'วัน' },
  hours: { en: 'HOURS', th: 'ชั่วโมง' },
  minutes: { en: 'MINUTES', th: 'นาที' },
  seconds: { en: 'SECONDS', th: 'วินาที' },
};

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock time of an instant in a timezone, encoded as a UTC timestamp (so calendar maths is simple). */
export function wallClock(instant: number, tz: string): number {
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
}

/** "2025-02-14T18:30" typed by the admin, interpreted in `tz`. Returned as wall-clock UTC encoding. */
export function parseLocal(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value ?? '');
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Add calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29), like real calendars do. */
function addMonths(wall: number, months: number): number {
  const d = new Date(wall);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(ty, tm));
  return Date.UTC(ty, tm, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

const MS: Record<'days' | 'hours' | 'minutes' | 'seconds', number> = { days: 86400_000, hours: 3600_000, minutes: 60_000, seconds: 1000 };

/**
 * Exact calendar difference between two wall-clock times, using only the enabled units.
 * Hidden units fold into the next smaller enabled one (years hidden → shown as more months, etc.).
 */
export function diff(fromWall: number, toWall: number, enabled: Partial<Record<Unit, boolean>>): Duration {
  const out: Duration = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (toWall <= fromWall) return out;
  const on = UNITS.filter((u) => enabled[u]);
  const units = on.length ? on : (['seconds'] as Unit[]);
  let cursor = fromWall;
  if (units.includes('years') || units.includes('months')) {
    // Whole calendar months between the two times (binary search keeps it exact for any span).
    let lo = 0;
    let hi = Math.ceil((toWall - fromWall) / (28 * 86400_000)) + 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (addMonths(fromWall, mid) <= toWall) lo = mid; else hi = mid - 1;
    }
    if (units.includes('years')) out.years = Math.floor(lo / 12);
    if (units.includes('months')) out.months = lo - out.years * 12;
    // With months hidden only whole years advance the cursor; the leftover months flow into days.
    cursor = addMonths(fromWall, out.years * 12 + out.months);
  }
  let rest = toWall - cursor;
  for (const u of ['days', 'hours', 'minutes', 'seconds'] as const) {
    if (!units.includes(u)) continue;
    out[u] = Math.floor(rest / MS[u]);
    rest -= out[u] * MS[u];
  }
  return out;
}

export interface TimerConfig {
  mode: 'exact' | 'live' | 'custom' | 'countdown';
  start: string;
  end: string;
  timezone: string;
  units: Record<Unit, boolean>;
  custom: Record<Unit, number>;
}

/** The value the timer should show at `now`, plus whether a countdown has reached its target. */
export function timerValue(cfg: TimerConfig, now = Date.now()): { value: Duration; reached: boolean; valid: boolean } {
  const tz = cfg.timezone || 'Asia/Bangkok';
  const nowWall = wallClock(now, tz);
  const empty: Duration = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (cfg.mode === 'custom') {
    const c = cfg.custom ?? empty;
    // Anchor at "now" so folding hidden units uses real calendar lengths.
    let end = addMonths(nowWall, (Number(c.years) || 0) * 12 + (Number(c.months) || 0));
    end += (Number(c.days) || 0) * MS.days + (Number(c.hours) || 0) * MS.hours + (Number(c.minutes) || 0) * MS.minutes + (Number(c.seconds) || 0) * MS.seconds;
    return { value: diff(nowWall, end, cfg.units), reached: false, valid: true };
  }
  if (cfg.mode === 'countdown') {
    const target = parseLocal(cfg.end || cfg.start);
    if (target == null) return { value: empty, reached: false, valid: false };
    return { value: diff(nowWall, target, cfg.units), reached: nowWall >= target, valid: true };
  }
  const start = parseLocal(cfg.start);
  if (start == null) return { value: empty, reached: false, valid: false };
  const endWall = cfg.end ? parseLocal(cfg.end) : null;
  const to = endWall != null ? Math.min(endWall, nowWall) : nowWall;
  return { value: diff(start, to, cfg.units), reached: endWall != null && nowWall >= endWall, valid: true };
}
