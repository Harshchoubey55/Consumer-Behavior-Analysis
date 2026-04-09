/**
 * Consumer Behavior Tracker
 * Captures user interactions and sends them to the analytics ingestion API.
 * Runs client-side only. Uses batching + localStorage queue for reliability.
 */

const ANALYTICS_API = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:3001';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

type EventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'search'
  | 'checkout_step'
  | 'purchase'
  | 'category_click'
  | 'session_start';

type TrackEvent = {
  event_type: EventType;
  session_id: string;
  user_id?: string;
  page_url?: string;
  page_type?: string;
  referrer?: string;
  product_id?: string;
  product_title?: string;
  product_price?: number;
  category?: string;
  quantity?: number;
  search_query?: string;
  checkout_step?: number;
  properties?: Record<string, unknown>;
  client_ts: string;
  device_type?: string;
};

// ─── Session Management ────────────────────────

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  const stored = sessionStorage.getItem('_ba_session_id');
  const storedTs = sessionStorage.getItem('_ba_session_ts');
  const now = Date.now();

  if (stored && storedTs && now - parseInt(storedTs) < SESSION_TIMEOUT_MS) {
    sessionStorage.setItem('_ba_session_ts', now.toString());
    return stored;
  }

  // New session
  const newId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessionStorage.setItem('_ba_session_id', newId);
  sessionStorage.setItem('_ba_session_ts', now.toString());
  return newId;
}

function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getPageType(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/product/')) return 'pdp';
  if (pathname.startsWith('/search')) return 'plp';
  if (pathname.startsWith('/cart')) return 'cart';
  if (pathname.startsWith('/checkout')) return 'checkout';
  return 'other';
}

// ─── Queue + Batch Flush ────────────────────────

let queue: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  if (queue.length === 0) return;
  const batch = [...queue];
  queue = [];

  try {
    await fetch(`${ANALYTICS_API}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true, // ensures delivery even on page unload
    });
  } catch (err) {
    // Silently fail — don't break the app
    console.debug('[tracker] Failed to flush events:', err);
    // Re-queue failed events
    queue = [...batch, ...queue];
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
  if (queue.length >= BATCH_SIZE) flush();
}

// ─── Real-time Risk Scoring ─────────────────────────────────────

const STATE_MAP_CLIENT: Record<string, string> = {
  'page_view:home':     'HOME',
  'page_view:plp':      'BROWSE',
  'page_view:pdp':      'VIEW_PRODUCT',
  'page_view:cart':     'VIEW_CART',
  'page_view:checkout': 'CHECKOUT',
  'product_view':       'VIEW_PRODUCT',
  'add_to_cart':        'ADD_CART',
  'remove_from_cart':   'REMOVE_CART',
  'search':             'SEARCH',
  'checkout_step':      'CHECKOUT',
  'purchase':           'PURCHASE',
};

function toState(eventType: string, pageType?: string): string {
  const key = pageType ? `${eventType}:${pageType}` : eventType;
  return STATE_MAP_CLIENT[key] || STATE_MAP_CLIENT[eventType] || eventType;
}

// Accumulate states for the current session
const sessionStates: string[] = [];
const sessionTimings: number[] = [];
let lastEventTime = 0;

type RiskResult = {
  risk_score: number;
  risk_tier: string;
  current_state: string;
  conversion_probability: number;
  explanation: string;
};

type RiskCallback = (result: RiskResult) => void;
const riskCallbacks: RiskCallback[] = [];

/**
 * Register a callback to receive real-time risk score updates.
 * Called after every event that changes the session state sequence.
 */
function onRiskUpdate(cb: RiskCallback) {
  riskCallbacks.push(cb);
}

async function scoreCurrentSession() {
  if (sessionStates.length < 2) return;
  try {
    const res = await fetch(`${ANALYTICS_API}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: getOrCreateSessionId(),
        event_sequence: sessionStates,
        timing_deltas_ms: sessionTimings,
        latest_context: {
          prior_cart_adds: sessionContext.cartAdds,
          prior_searches: sessionContext.searchCount,
          scroll_depth_pct: sessionContext.currentScrollDepth,
          scroll_velocity_avg: sessionContext.scrollVelocityAvg,
          micro_hesitations: sessionContext.microHesitations,
          session_duration_so_far_s: sessionContext.sessionStartTs > 0 ? Math.round((Date.now() - sessionContext.sessionStartTs)/1000) : 0,
        }
      }),
    });
    if (!res.ok) return;
    const result: RiskResult = await res.json();
    riskCallbacks.forEach(cb => cb(result));
  } catch {
    // Non-fatal — scoring is best-effort
  }
}

// ─── Session Context State ──────────────────────────────────────

type ProductSeen = {
  id: string;
  price: number;
  category?: string;
  ts: number;
};

// Running session context — updated as user browses
const sessionContext = {
  productsSeen: [] as ProductSeen[],
  searchCount: 0,
  cartAdds: 0,
  sessionStartTs: 0,
  currentProductEntryTs: 0,
  currentScrollDepth: 0,
  lastListingPosition: null as number | null,
  arrivedViaSearch: false,
  scrollVelocityAvg: 0,
  microHesitations: 0,
};

let lastScrollY = 0;
let lastScrollTs = 0;
let scrollDistances: number[] = [];

// Track scroll depth and velocity on current page
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => {
    const now = Date.now();
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.body.scrollHeight;
    
    // Depth
    if (total > 0) {
      sessionContext.currentScrollDepth = Math.round((scrolled / total) * 100);
    }
    
    // Velocity tracking (pixels per second)
    if (lastScrollTs > 0) {
        const dist = Math.abs(window.scrollY - lastScrollY);
        const timeDiff = now - lastScrollTs;
        if (timeDiff > 0 && timeDiff < 1000) { // filter massive jumps
            const velocity = (dist / timeDiff) * 1000;
            scrollDistances.push(velocity);
            if (scrollDistances.length > 20) scrollDistances.shift();
            
            const avg = scrollDistances.reduce((a, b) => a + b, 0) / scrollDistances.length;
            sessionContext.scrollVelocityAvg = Math.round(avg);
        }
    }
    lastScrollY = window.scrollY;
    lastScrollTs = now;
    
  }, { passive: true });
}

export function registerMicroHesitation() {
    sessionContext.microHesitations += 1;
}

function getDecisionContext(productId: string, productPrice: number, productCategory?: string) {
  const now = Date.now();
  const priorProducts = sessionContext.productsSeen.filter(p => p.id !== productId);
  const priorPrices = priorProducts.map(p => p.price);
  const medianPrice = priorPrices.length > 0
    ? priorPrices.slice().sort((a, b) => a - b)[Math.floor(priorPrices.length / 2)]
    : null;
  const minPrice = priorPrices.length > 0 ? Math.min(...priorPrices) : null;
  const maxPrice = priorPrices.length > 0 ? Math.max(...priorPrices) : null;
  const priceVsMedianPct = medianPrice
    ? Math.round(((productPrice - medianPrice) / medianPrice) * 100)
    : null;
  const priceRank = priorPrices.filter(p => p < productPrice).length + 1;
  const sameCategoryViews = priorProducts.filter(p => p.category === productCategory).length;
  const timeOnPageMs = sessionContext.currentProductEntryTs > 0
    ? now - sessionContext.currentProductEntryTs : 0;
  const sessionDurationS = sessionContext.sessionStartTs > 0
    ? Math.round((now - sessionContext.sessionStartTs) / 1000) : 0;
  const isReturnView = sessionContext.productsSeen.some(p => p.id === productId);

  return {
    // Prior session context
    prior_product_views: priorProducts.length,
    prior_cart_adds: sessionContext.cartAdds,
    prior_searches: sessionContext.searchCount,
    session_duration_so_far_s: sessionDurationS,
    // Price anchoring
    prices_seen_before: priorPrices,
    median_price_seen: medianPrice,
    min_price_seen: minPrice,
    max_price_seen: maxPrice,
    price_rank_in_session: priceRank,
    price_vs_median_pct: priceVsMedianPct,
    is_most_expensive_seen: maxPrice !== null && productPrice > maxPrice,
    is_cheapest_seen: minPrice !== null && productPrice < minPrice,
    // Engagement
    time_on_page_before_ms: timeOnPageMs,
    scroll_depth_pct: sessionContext.currentScrollDepth,
    scroll_velocity_avg: sessionContext.scrollVelocityAvg,
    micro_hesitations: sessionContext.microHesitations,
    // Navigation
    is_from_search: sessionContext.arrivedViaSearch,
    is_return_view: isReturnView,
    same_category_views_before: sameCategoryViews,
    listing_position: sessionContext.lastListingPosition,
    // Time
    hour_of_day: new Date().getHours(),
    day_of_week: new Date().getDay(),
  };
}

function track(
  event_type: EventType,
  data: Omit<TrackEvent, 'event_type' | 'session_id' | 'client_ts' | 'device_type'>
) {
  if (typeof window === 'undefined') return; // SSR guard

  const event: TrackEvent = {
    event_type,
    session_id: getOrCreateSessionId(),
    device_type: getDeviceType(),
    page_url: window.location.pathname + window.location.search,
    referrer: document.referrer || undefined,
    client_ts: new Date().toISOString(),
    ...data,
  };

  queue.push(event);
  scheduleFlush();

  // Update session state sequence for real-time risk scoring
  const now = Date.now();
  const state = toState(event_type, data.page_type as string | undefined);
  if (!sessionStates.length || sessionStates[sessionStates.length - 1] !== state) {
    sessionTimings.push(lastEventTime > 0 ? now - lastEventTime : 0);
    sessionStates.push(state);
    lastEventTime = now;
    // Score after every state change (async, non-blocking)
    scoreCurrentSession();
  }
}

// ─── Public API ────────────────────────

export const tracker = {
  /**
   * Track a page view. Call on every route change.
   */
  pageView(pathname: string) {
    track('page_view', {
      page_url: pathname,
      page_type: getPageType(pathname),
    });
  },

  /**
   * Track a product detail page view — with full decision context.
   * Captures what the user saw BEFORE this moment, not just the event itself.
   */
  productView(product: {
    id: string;
    title: string;
    price: number;
    category?: string;
    listingPosition?: number;
  }) {
    // Initialize session start time on first product view
    if (sessionContext.sessionStartTs === 0) {
      sessionContext.sessionStartTs = Date.now();
    }
    // Record listing position if provided
    if (product.listingPosition !== undefined) {
      sessionContext.lastListingPosition = product.listingPosition;
    }
    // Reset scroll depth, velocity, hesitations, and record page entry time
    sessionContext.currentScrollDepth = 0;
    sessionContext.scrollVelocityAvg = 0;
    sessionContext.microHesitations = 0;
    scrollDistances = [];
    sessionContext.currentProductEntryTs = Date.now();

    // Build full decision context BEFORE updating productsSeen
    const ctx = getDecisionContext(product.id, product.price, product.category);

    track('product_view', {
      page_type: 'pdp',
      product_id: product.id,
      product_title: product.title,
      product_price: product.price,
      category: product.category,
      properties: ctx,  // full decision context in properties
    });

    // Update session state AFTER tracking
    sessionContext.productsSeen.push({
      id: product.id,
      price: product.price,
      category: product.category,
      ts: Date.now(),
    });
    sessionContext.lastListingPosition = null;
  },

  /**
   * Track adding an item to cart — with decision context at time of add.
   */
  addToCart(product: {
    id: string;
    title: string;
    price: number;
    quantity?: number;
    category?: string;
  }) {
    const ctx = getDecisionContext(product.id, product.price, product.category);
    // Capture how long they were on the page before adding
    const timeOnPageMs = sessionContext.currentProductEntryTs > 0
      ? Date.now() - sessionContext.currentProductEntryTs : 0;

    track('add_to_cart', {
      page_type: 'pdp',
      product_id: product.id,
      product_title: product.title,
      product_price: product.price,
      quantity: product.quantity || 1,
      category: product.category,
      properties: {
        ...ctx,
        time_on_page_before_ms: timeOnPageMs,
        scroll_depth_pct: sessionContext.currentScrollDepth,
      },
    });

    sessionContext.cartAdds += 1;
  },

  /**
   * Track removing an item from cart.
   */
  removeFromCart(productId: string, productTitle?: string) {
    track('remove_from_cart', {
      page_type: 'cart',
      product_id: productId,
      product_title: productTitle,
    });
  },

  /**
   * Track a search query.
   */
  search(query: string) {
    sessionContext.searchCount += 1;
    sessionContext.arrivedViaSearch = true;
    track('search', {
      page_type: 'search',
      search_query: query,
    });
  },

  /**
   * Track a category navigation click.
   */
  categoryClick(category: string) {
    track('category_click', {
      category,
      page_type: 'plp',
    });
  },

  /**
   * Track checkout progression.
   * step: 1=address, 2=shipping, 3=payment, 4=complete
   */
  checkoutStep(step: number) {
    track('checkout_step', {
      page_type: 'checkout',
      checkout_step: step,
    });
  },

  /**
   * Track a completed purchase.
   */
  purchase(product: { id: string; price: number }) {
    track('purchase', {
      page_type: 'checkout',
      product_id: product.id,
      product_price: product.price,
      checkout_step: 4,
    });
  },

  /**
   * Flush queue immediately (e.g., before page unload).
   */
  flush,

  /**
   * Register a callback for real-time session risk score updates.
   * Called after every new behavioral state transition.
   * Use this to trigger interventions (e.g., show a discount) when risk is high.
   *
   * @example
   *   tracker.onRiskUpdate(({ risk_tier }) => {
   *     if (risk_tier === 'critical') showRetentionModal();
   *   });
   */
  onRiskUpdate,
};

// Auto-flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flush());
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
