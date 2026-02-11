// ============================================================================
// WEB VITALS - Finance Hub
// Performance monitoring for Core Web Vitals (LCP, FID, CLS, INP, TTFB)
// ============================================================================

import { onCLS, onLCP, onINP, onTTFB, onFCP, type Metric } from 'web-vitals';
import { logger } from './logger';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WebVitalsMetric {
  name: string;
  value: number;
  delta: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

type WebVitalsCallback = (metric: WebVitalsMetric) => void;

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

// Thresholds based on Google's recommendations
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },  // Largest Contentful Paint
  FCP: { good: 1800, poor: 3000 },  // First Contentful Paint
  CLS: { good: 0.1, poor: 0.25 },   // Cumulative Layout Shift
  INP: { good: 200, poor: 500 },    // Interaction to Next Paint
  TTFB: { good: 800, poor: 1800 },  // Time to First Byte
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Get rating for a metric value
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'needs-improvement';

  if (value <= threshold.good) return 'good';
  if (value > threshold.poor) return 'poor';
  return 'needs-improvement';
}

/**
 * Transform web-vitals Metric to our format
 */
function transformMetric(metric: Metric): WebVitalsMetric {
  return {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: getRating(metric.name, metric.value),
  };
}

// ----------------------------------------------------------------------------
// Logging & Reporting
// ----------------------------------------------------------------------------

/**
 * Log metric to console in development
 */
function logMetric(metric: WebVitalsMetric): void {
  logger.info(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`, {
    metric,
  });
}

/**
 * Send metric to analytics endpoint (if configured)
 */
function reportMetric(metric: WebVitalsMetric): void {
  // Only report in production
  if (import.meta.env.DEV) {
    logMetric(metric);
    return;
  }

  // Report to Sentry if available
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.metrics?.distribution(
      `web_vitals.${metric.name.toLowerCase()}`,
      metric.value,
      {
        tags: {
          rating: metric.rating,
        },
        unit: metric.name === 'CLS' ? '' : 'millisecond',
      }
    );
  }

  // Also log in development
  logMetric(metric);
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Initialize Web Vitals monitoring
 * Call this once in your app entry point
 */
export function initWebVitals(callback?: WebVitalsCallback): void {
  const handler = (metric: Metric) => {
    const transformed = transformMetric(metric);

    // Report to default handler
    reportMetric(transformed);

    // Call custom callback if provided
    callback?.(transformed);
  };

  // Register all Core Web Vitals
  onCLS(handler);      // Cumulative Layout Shift
  onLCP(handler);      // Largest Contentful Paint
  onFCP(handler);      // First Contentful Paint
  onINP(handler);      // Interaction to Next Paint
  onTTFB(handler);     // Time to First Byte
}

/**
 * Report a single metric manually (useful for custom performance marks)
 */
export function reportCustomMetric(name: string, value: number): void {
  const metric: WebVitalsMetric = {
    name,
    value,
    delta: value,
    id: `custom-${Date.now()}`,
    rating: 'good', // Custom metrics don't have standard ratings
  };

  reportMetric(metric);
}

/**
 * Mark a performance milestone
 */
export function markPerformance(markName: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(markName);
  }
}

/**
 * Measure time between two marks
 */
export function measurePerformance(measureName: string, startMark: string, endMark?: string): number | null {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      const measure = performance.measure(measureName, startMark, endMark);
      reportCustomMetric(measureName, measure.duration);
      return measure.duration;
    } catch {
      logger.warn(`Failed to measure performance: ${measureName}`);
      return null;
    }
  }
  return null;
}

// Global Sentry type declaration
declare global {
  interface Window {
    Sentry?: {
      metrics?: {
        distribution: (
          name: string,
          value: number,
          options?: { tags?: Record<string, string>; unit?: string }
        ) => void;
      };
    };
  }
}

export default initWebVitals;
