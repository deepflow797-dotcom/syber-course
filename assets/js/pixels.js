/* Restore — analytics bootstrap.
   Loaded as an external script so the storefront can stay free of inline
   JavaScript under a strict Content-Security-Policy. The pixel IDs are passed
   as data attributes by assets/js/app.js. */
(() => {
  "use strict";

  const script = document.currentScript || document.querySelector("script[data-restore-pixels]");
  if (!script) return;
  const read = (name) =>
    String(script.dataset[name] || "")
      .replace(/[^A-Za-z0-9_.-]/g, "")
      .slice(0, 80);

  const metaId = read("meta");
  const tiktokId = read("tiktok");
  const gaId = read("ga");

  if (metaId && !window.fbq) {
    const fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    const vendor = document.createElement("script");
    vendor.async = true;
    vendor.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(vendor);
    fbq("init", metaId);
    fbq("track", "PageView");
  }

  if (tiktokId && !window.ttq) {
    const ttq = (window.ttq = window.ttq || []);
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie"
    ];
    ttq.setAndDefer = function (target, method) {
      target[method] = function () {
        target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let index = 0; index < ttq.methods.length; index += 1) ttq.setAndDefer(ttq, ttq.methods[index]);
    ttq.load = function (id) {
      const source = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = source;
      ttq._t = ttq._t || {};
      ttq._t[id] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[id] = document.createElement("script");
      const vendor = document.createElement("script");
      vendor.type = "text/javascript";
      vendor.async = true;
      vendor.src = `${source}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
      const first = document.getElementsByTagName("script")[0];
      first.parentNode.insertBefore(vendor, first);
    };
    ttq.load(tiktokId);
    ttq.page();
  }

  if (gaId && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", gaId, { anonymize_ip: true });
    const vendor = document.createElement("script");
    vendor.async = true;
    vendor.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(vendor);
  }
})();
