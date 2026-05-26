import type { Page } from '@playwright/test';

export type WebVitalsMetrics = {
  lcp?: number;
  fcp?: number;
  cls?: number;
  ttfb?: number;
  tti?: number;
  domContentLoaded?: number;
  loadEvent?: number;
};

export type StoredVitalsEntry = {
  testTitle: string;
  url: string;
  metrics: WebVitalsMetrics;
  collectedAt: string;
  status: 'passed' | 'failed' | 'skipped';
};

const vitalsStore = new Map<string, StoredVitalsEntry[]>();

function storeKey(testTitle: string) {
  return testTitle;
}

export function storeVitalsForTest(
  testTitle: string,
  url: string,
  metrics: WebVitalsMetrics,
  status: StoredVitalsEntry['status'] = 'passed',
) {
  const key = storeKey(testTitle);
  const list = vitalsStore.get(key) ?? [];
  list.push({
    testTitle,
    url,
    metrics,
    collectedAt: new Date().toISOString(),
    status,
  });
  vitalsStore.set(key, list);
}

export function takeAllVitalsEntries(): StoredVitalsEntry[] {
  const all: StoredVitalsEntry[] = [];
  for (const entries of vitalsStore.values()) {
    all.push(...entries);
  }
  vitalsStore.clear();
  return all;
}

export function peekVitalsForTest(testTitle: string): StoredVitalsEntry[] {
  return vitalsStore.get(storeKey(testTitle)) ?? [];
}

export function takeVitalsForTest(testTitle: string): StoredVitalsEntry[] {
  const entries = vitalsStore.get(storeKey(testTitle)) ?? [];
  vitalsStore.delete(storeKey(testTitle));
  return entries;
}

export async function measureWebVitals(
  page: Page,
  url: string,
): Promise<WebVitalsMetrics> {
  if (page.url() !== url) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  }

  await page.waitForTimeout(500);

  const metrics = await page.evaluate(async () => {
    const result: Record<string, number> = {};

    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav) {
      result.ttfb = nav.responseStart - nav.requestStart;
      result.domContentLoaded =
        nav.domContentLoadedEventEnd - nav.startTime;
      result.loadEvent = nav.loadEventEnd - nav.startTime;
    }

    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');
    if (fcp) result.fcp = fcp.startTime;

    await new Promise<void>((resolve) => {
      let clsValue = 0;
      let lcpValue = 0;
      let ttiValue = 0;
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        result.cls = clsValue;
        result.lcp = lcpValue;
        if (ttiValue > 0) result.tti = ttiValue;
        resolve();
      };

      try {
        const lcpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries.at(-1) as PerformanceEntry | undefined;
          if (last) lcpValue = last.startTime;
        });
        lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        /* unsupported */
      }

      try {
        const clsObs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as PerformanceEntry[]) {
            const layoutShift = entry as PerformanceEntry & {
              value?: number;
              hadRecentInput?: boolean;
            };
            if (!layoutShift.hadRecentInput) {
              clsValue += layoutShift.value ?? 0;
            }
          }
        });
        clsObs.observe({ type: 'layout-shift', buffered: true });
      } catch {
        /* unsupported */
      }

      try {
        const longTaskObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0 && ttiValue === 0) {
            const last = entries.at(-1);
            if (last) ttiValue = last.startTime;
          }
        });
        longTaskObs.observe({ type: 'longtask', buffered: true });
      } catch {
        /* unsupported */
      }

      setTimeout(finish, 3000);
    });

    if (!result.lcp && result.fcp) {
      result.lcp = result.fcp;
    }

    return result;
  });

  return metrics;
}
