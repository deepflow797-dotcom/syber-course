# Legal and asset notes

Restore (ريستور) is an independent Mauritanian electronics store project. This repository
is a storefront and dashboard implementation, not a claim of affiliation with Apple,
Samsung, Google, Bankily, Masrvi, Sedad, Click, WhatsApp/Meta, Visa, Mastercard or any
manufacturer or payment provider. All third-party names and marks belong to their owners.

## Assets and content

| Asset | Status / action before public launch |
| --- | --- |
| Restore name, logo and brand palette | Created for this project. Confirm trademark clearance in Mauritania before use. |
| Product photography in `assets/products/` | Imported demo catalog images. They may depict third-party products; obtain permission or replace them with original photos. Product design rights remain with the manufacturers. |
| Category, hero and promotional artwork | Generated or adapted for this Restore prototype. Review before publication. |
| Demo blog posts, reviews, press quotes and customer names | Fictional sample content, not real endorsements. Replace with genuine, consented content before launch. |
| Mauritania and France flag icons | Public national flag symbolism. |
| Montserrat font | SIL Open Font License 1.1; see `assets/fonts/`. |
| Icons | Inline SVG icons authored for this project. |

## Customer data and orders

- Checkout collects a name, phone number, optional email, city, address, notes and chosen
  payment method. This information is used to prepare a WhatsApp order message and to
  manage the sale.
- In local demo mode, this data stays in the browser. In Supabase mode it is stored in
  the `restore_orders` table and protected by the supplied RLS policies.
- Do not deploy with the demo WhatsApp number. Replace it with the store's real number
  and obtain consent for WhatsApp communication where required.
- No card numbers or payment credentials are collected by the site. Bankily/Masrvi/Sedad/
  Click transfers are confirmed manually over WhatsApp.
- Configure retention, access and deletion procedures appropriate for your business and
  local law. Keep the Supabase service-role key secret and never commit it.

## Pricing and claims

All prices are in MRU (new ouguiya). Demo catalog values were converted to MRU for the
prototype and must be reviewed before sale. Warranty, battery-health, shipping, review and
"certified renewed" claims should match your actual inspection and warranty policy. The
10% Bankily promotion and all coupons are configurable and must reflect the real offer.

## No warranty

This code is provided as a project template without a warranty of fitness for a particular
purpose. Review security, accessibility, tax, consumer-protection and privacy obligations
with a qualified professional before operating a live store.

## DOMPurify (vendored)
- File: `assets/vendor/purify.min.js`
- Version: 3.2.6 (downloaded from jsDelivr package distribution for local vendoring; not loaded from CDN at runtime)
- License: MPL-2.0 OR Apache-2.0
- Source: https://github.com/cure53/DOMPurify
- Used for: sanitizing rich HTML (`sanitizeRichHTML`) in storefront/dashboard rendering.
