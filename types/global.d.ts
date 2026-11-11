/* Ambient types for the storefront runtime (browser globals set by plain <script> tags before the ES modules load). */
export {};

/** Bilingual text as stored everywhere in state (ar + fr). */
export interface Bilingual { ar: string; fr: string }

export interface ProductVariant {
  id: string; title?: string; o1?: string; o2?: string; o3?: string;
  price: number; compare?: number; available: boolean; battery?: number; stock?: number; sku?: string; color?: string; storage?: string;
}
export interface Product {
  id?: string; handle: string; title: string | Bilingual; vendor?: string; brand?: string; type?: string;
  price: number; compare?: number; discount?: number; stock: number; lowStock?: boolean; active?: boolean;
  image?: string; images?: string[]; variants?: ProductVariant[]; collections?: string[]; sku?: string; condition?: string;
  battery?: number | null; specs?: Record<string, unknown>; description?: Bilingual; updatedAt?: string; [k: string]: unknown;
}
export interface Collection { handle: string; title: Bilingual | string; visible?: boolean; sortOrder?: number; [k: string]: unknown }
export interface Coupon { id?: string; code: string; type: "percent" | "fixed"; value: number; minTotal?: number; expiresAt?: string; usageLimit?: number | null; active?: boolean }
export interface City { id: string; name: Bilingual; fee: number; days?: Bilingual; active?: boolean }
export interface PaymentMethod { id: string; name: Bilingual; color?: string; active?: boolean; discount?: number; note?: Bilingual }
export interface OrderItem { handle: string; qty: number; variantId?: string; unitPrice?: number; title?: string }
export interface Order {
  id: string; items: OrderItem[]; total: number; subtotal?: number; shipping?: number; discount?: number; status: string;
  customer?: { name?: string; phone?: string; city?: string; address?: string }; payment?: { id: string } | string;
  createdAt?: string; updatedAt?: string; serverValidated?: boolean; validationMode?: string; customerId?: string; customerAuthId?: string; [k: string]: unknown;
}
export interface StaffSession { username?: string; email?: string; role: string; token?: string; expiresAt?: number; mustChange?: boolean; [k: string]: unknown }
export interface StoreSettings { storeName: Bilingual; coupons?: Coupon[]; cities?: City[]; payments?: PaymentMethod[]; freeShippingOver?: number; lowStockThreshold?: number; hours?: Record<string, unknown>; timezone?: string; [k: string]: unknown }
export interface StoreState { version: number; updatedAt: string; settings: StoreSettings; products: Product[]; collections: Collection[]; catalogSource?: string; [k: string]: unknown }

export interface RestoreConfig {
  mode: "local" | "remote" | "auto" | "supabase" | string; demoEnabled?: boolean; supabaseUrl?: string; supabaseAnonKey?: string;
  createOrderFunction?: string; createStaffFunction?: string; requireServerOrders?: boolean; ordersTable?: string;
  catalogMetaTable?: string; [k: string]: unknown;
}
export interface BrandCountry { code?: string; name?: Bilingual; flag?: string; dial?: string; currencyCode?: string; currency?: Bilingual; currencyName?: Bilingual }
export interface BrandConfig { key?: string; country?: BrandCountry; address?: Bilingual; timezone?: string; font?: string; name?: Bilingual; legalName?: Bilingual; tagline?: Bilingual; phone?: string; whatsapp?: string; email?: string; domain?: string; city?: Bilingual; logo?: string; logoWhite?: string; couponPrefix?: string; [k: string]: unknown }

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
