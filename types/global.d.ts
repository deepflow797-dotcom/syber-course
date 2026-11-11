/* Ambient types for the storefront runtime (browser globals set by plain <script> tags before the ES modules load). */
export {};

/** Bilingual text as stored everywhere in state (ar + fr). */
export interface Bilingual {
  ar: string;
  fr: string;
}

export interface ProductVariant {
  id: string;
  title?: string;
  o1?: string;
  o2?: string;
  o3?: string;
  price: number;
  compare?: number;
  available: boolean;
  battery?: number;
  stock?: number;
  sku?: string;
  color?: string;
  storage?: string;
}
export interface Product {
  id?: string;
  handle: string;
  title: string | Bilingual;
  vendor?: string;
  brand?: string;
  type?: string;
  price: number;
  compare?: number;
  discount?: number;
  stock: number;
  lowStock?: boolean;
  active?: boolean;
  image?: string;
  images?: string[];
  variants?: ProductVariant[];
  collections?: string[];
  sku?: string;
  condition?: string;
  battery?: number | null;
  specs?: Record<string, unknown>;
  description?: Bilingual;
  updatedAt?: string;
  [k: string]: unknown;
}
export interface Collection {
  handle: string;
  title: Bilingual | string;
  visible?: boolean;
  sortOrder?: number;
  [k: string]: unknown;
}
export interface Coupon {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minTotal?: number;
  expiresAt?: string;
  usageLimit?: number | null;
  active?: boolean;
}
export interface City {
  id: string;
  name: Bilingual;
  fee: number;
  days?: Bilingual;
  active?: boolean;
}
export interface PaymentMethod {
  id: string;
  name: Bilingual;
  color?: string;
  active?: boolean;
  discount?: number;
  note?: Bilingual;
}
export interface OrderItem {
  handle: string;
  qty: number;
  variantId?: string;
  unitPrice?: number;
  title?: string;
}
export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  shipping?: number;
  discount?: number;
  status: string;
  customer?: { name?: string; phone?: string; city?: string; address?: string };
  payment?: { id: string } | string;
  createdAt?: string;
  updatedAt?: string;
  serverValidated?: boolean;
  validationMode?: string;
  customerId?: string;
  customerAuthId?: string;
  [k: string]: unknown;
}
export interface StaffSession {
  username?: string;
  email?: string;
  role: string;
  token?: string;
  expiresAt?: number;
  mustChange?: boolean;
  [k: string]: unknown;
}
export interface StoreSettings {
  storeName: Bilingual;
  coupons?: Coupon[];
  cities?: City[];
  payments?: PaymentMethod[];
  freeShippingOver?: number;
  lowStockThreshold?: number;
  hours?: Record<string, unknown>;
  timezone?: string;
  [k: string]: unknown;
}
export interface StoreState {
  version: number;
  updatedAt: string;
  settings: StoreSettings;
  products: Product[];
  collections: Collection[];
  catalogSource?: string;
  [k: string]: unknown;
}

export interface RestoreConfig {
  mode: "local" | "remote" | "auto" | "supabase" | string;
  demoEnabled?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  createOrderFunction?: string;
  createStaffFunction?: string;
  requireServerOrders?: boolean;
  ordersTable?: string;
  catalogMetaTable?: string;
  [k: string]: unknown;
}
export interface BrandCountry {
  code?: string;
  name?: Bilingual;
  flag?: string;
  dial?: string;
  currencyCode?: string;
  currency?: Bilingual;
  currencyName?: Bilingual;
}
export interface BrandConfig {
  key?: string;
  country?: BrandCountry;
  address?: Bilingual;
  timezone?: string;
  font?: string;
  name?: Bilingual;
  legalName?: Bilingual;
  tagline?: Bilingual;
  phone?: string;
  whatsapp?: string;
  email?: string;
  domain?: string;
  city?: Bilingual;
  logo?: string;
  logoWhite?: string;
  couponPrefix?: string;
  [k: string]: unknown;
}

declare global {
  interface Window {
    STORE: { products: any[]; collections: any[]; home: Record<string, unknown>; [k: string]: unknown };
    RESTORE_CONFIG: RestoreConfig;
    BRAND: BrandConfig;
    RESTORE: Record<string, any>;
    DOMPurify?: { sanitize(html: string, cfg?: Record<string, unknown>): string };
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
  // eslint-disable-next-line no-var
  var DOMPurify: Window["DOMPurify"];
  // eslint-disable-next-line no-var
  var STORE: Window["STORE"];
  // eslint-disable-next-line no-var
  var RESTORE_CONFIG: RestoreConfig;
  // eslint-disable-next-line no-var
  var BRAND: BrandConfig;
}

/* ============================================================================================
   Phase 5.2 — the two module contexts.
   Every `install(ctx)` module of `ui/dashboard` and `ui/storefront` receives one of these objects.
   They are assembled at runtime by Object.assign (see dashboard.js / ui/storefront.js), so the
   interfaces below are the contract each module may rely on. Unknown members stay `any` on purpose:
   the goal is catching typos on the members we do declare, not freezing the surface.
   ============================================================================================ */

/** Managers / staff account (local draft or Supabase staff row). */
declare global {
  /* Managers / staff account (local draft or Supabase staff row). */
  interface Manager {
    id: string;
    authId?: string;
    username?: string;
    email?: string;
    name?: Bilingual | string;
    displayName?: Bilingual | string;
    role: "owner" | "manager" | string;
    whatsapp?: string;
    avatar?: string;
    active?: boolean;
    mustChange?: boolean;
    passwordHash?: string;
    createdAt?: string;
    updatedAt?: string;
    [k: string]: unknown;
  }

  /** Toast helper: the dashboard keeps the hide timer on the function object. */
  interface ToastFn {
    (message: string, type?: "good" | "error" | string): void;
    timer?: ReturnType<typeof setTimeout>;
  }

  interface DashboardCtx {
    /* scaffolding */
    app: HTMLElement;
    modalRoot: HTMLElement;
    route: string;
    dashLang: "ar" | "fr";
    searchTerm: string;
    dirty: boolean;
    session: StaffSession | null;
    model: any;
    editBuffer: any;
    pendingProductIndex: number | null;
    editorKind: string | null;
    pendingManagerId?: string | null;
    orderBadgeSeen: number;
    reportRange?: string;
    REMOTE: boolean;
    DEMO_ALLOWED: boolean;
    CFG: RestoreConfig;
    R: Record<string, any>;

    /* registered by the modules (the ones the type checker must see by name) */
    /** `root.querySelector` — the concrete element type is chosen by the caller (dashboard markup is static). */
    $: (selector: string, root?: ParentNode) => any;
    $$: (selector: string, root?: ParentNode) => any[];
    /** `document.getElementById`, already typed as an input for the dashboard forms. */
    byId?: (id: string) => HTMLElement | null;
    esc(value: unknown): string;
    dt(ar: string, fr: string): string;
    icon(name: string): string;
    lng(value: unknown): string;
    L(value: unknown): string;
    clone<T>(value: T): T;
    money(value: unknown): string;
    fmtDate(value: unknown): string;
    fmtDateTime(value: unknown): string;
    toast: ToastFn;
    getPath(obj: any, path: string): any;
    setPath(obj: any, path: string, value: any): void;
    renderRoute(): void;
    /** Toggles the sidebar / publish buttons; the dashboard passes plain elements here. */
    setBusy?(node: any, busy: boolean): void;
    saveDraftNow(): void;
    saveDraftSoon(): void;
    closeModal(): void;
    openModal(
      title: string,
      body: string,
      options?: { wide?: boolean; footer?: string; onMount?: (root: HTMLElement) => void }
    ): void;
    tablesMode(): boolean;
    updateCounts(): void;
    [k: string]: any;
  }

  interface StorefrontCtx {
    R: Record<string, any>;
    state: StoreState;
    SET: any;
    PRODUCTS: Product[];
    BY_HANDLE: Map<string, Product>;
    ICON: Record<string, string>;
    PDP: any;
    t(key: string, vars?: Record<string, unknown>): string;
    esc(value: unknown): string;
    L(value: unknown): string;
    money(value: unknown): string;
    toast(message: string, type?: string): void;
    hydrateIcons(root?: ParentNode): void;
    observeReveals(): void;
    [k: string]: any;
  }
}
