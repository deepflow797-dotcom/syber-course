// @ts-check
/* app.js → Static pages
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderPage, renderBlog, renderBlogPost, renderAccount });
  function renderPage() {
    const slug = new URLSearchParams(location.search).get("slug") || "about-us";
    const page = ctx.R.getPage(slug);
    const root = document.getElementById("page-root");
    if (!root) return;
    const crumb = document.querySelector(".breadcrumb");
    if (!page) {
      document.title = `${ctx.t("pageNotFound")} | ${ctx.L(ctx.SET.storeName)}`;
      if (crumb)
        crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><span>${ctx.esc(ctx.t("pageNotFound"))}</span>`;
      root.innerHTML = `<div class="empty-state page-missing"><h1>${ctx.esc(ctx.t("pageNotFound"))}</h1><p>${ctx.esc(ctx.t("productNotFoundText"))}</p><a class="btn btn-primary" href="index.html">${ctx.esc(ctx.t("goHome"))}</a></div>`;
      return;
    }
    document.title = `${ctx.L(page.seoTitle) || ctx.L(page.title)} | ${ctx.L(ctx.SET.storeName)}`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription)
      metaDescription.setAttribute("content", ctx.L(page.seoDescription) || String(ctx.L(page.body)).slice(0, 160));
    if (crumb)
      crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><span>${ctx.esc(ctx.L(page.title))}</span>`;
    const paragraphs = String(ctx.L(page.body))
      .split("\n")
      .filter(Boolean)
      .map((line) => `<p>${ctx.esc(line)}</p>`)
      .join("");
    const contact =
      slug === "contact"
        ? `<div class="page-contact-actions">
      <a class="btn btn-primary" href="https://wa.me/${ctx.esc(ctx.SET.whatsapp)}" target="_blank" rel="noopener">${ctx.ICON.whatsapp} ${ctx.esc(ctx.t("orderWhatsApp"))}</a>
      <a class="btn btn-outline" href="mailto:${ctx.esc(ctx.SET.email)}">${ctx.ICON.mail} ${ctx.esc(ctx.SET.email)}</a>
    </div>`
        : "";
    root.innerHTML = `<span class="eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))}</span><h1>${ctx.esc(ctx.L(page.title))}</h1>${paragraphs}${contact}
      <p class="page-meta">${ctx.esc(ctx.L(ctx.SET.city))}, ${ctx.esc(ctx.L(ctx.SET.country.name))} · <span class="phone-ltr">${ctx.esc(ctx.SET.phoneDisplay)}</span></p>`;
    ctx.observeReveals();
  }

  function renderBlog() {
    const root = document.getElementById("blog-root");
    if (!root) return;
    const posts = (ctx.S.blog || [])
      .filter((post) => post.published !== false)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    document.title = `${ctx.t("blog")} | ${ctx.L(ctx.SET.storeName)}`;
    root.innerHTML = `<div class="container">
      <div class="blog-head"><span class="eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))}</span><h1>${ctx.esc(ctx.t("blog"))}</h1><p>${ctx.esc(ctx.t("latestArticles"))}</p></div>
      <div class="blog-grid">
        ${
          posts
            .map(
              (post) => `<a class="blog-card reveal" href="blog-post.html?slug=${encodeURIComponent(post.slug)}">
          <div class="blog-card-img"><img src="${ctx.esc(post.image || "assets/img/category-iphone.svg")}" alt="${ctx.esc(ctx.L(post.title))}" loading="lazy"></div>
          <div class="blog-card-body"><time>${ctx.esc(ctx.R.formatDate(post.date))}</time><h2>${ctx.esc(ctx.L(post.title))}</h2><p>${ctx.esc(ctx.L(post.excerpt))}</p><span class="read-more">${ctx.esc(ctx.t("readMore"))} ${ctx.ICON.arrowRight}</span></div>
        </a>`
            )
            .join("") || `<div class="empty-state u-span-full"><h2>${ctx.esc(ctx.t("noProducts"))}</h2></div>`
        }
      </div>
    </div>`;
    ctx.observeReveals();
  }

  function renderBlogPost() {
    const root = document.getElementById("blog-root");
    if (!root) return;
    const slug = new URLSearchParams(location.search).get("slug");
    const post = (ctx.S.blog || []).find((item) => item.slug === slug && item.published !== false);
    if (!post) {
      document.title = `${ctx.t("pageNotFound")} | ${ctx.L(ctx.SET.storeName)}`;
      root.innerHTML = `<div class="container"><div class="empty-state"><h1>${ctx.esc(ctx.t("pageNotFound"))}</h1><a class="btn btn-primary" href="blog.html">${ctx.esc(ctx.t("blog"))}</a></div></div>`;
      return;
    }
    document.title = `${ctx.L(post.title)} | ${ctx.L(ctx.SET.storeName)}`;
    root.innerHTML = `<div class="container">
      <div class="breadcrumb"><a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><a href="blog.html">${ctx.esc(ctx.t("blog"))}</a><span>/</span><span>${ctx.esc(ctx.L(post.title))}</span></div>
      <article class="blog-post">
        <span class="eyebrow">${ctx.esc(ctx.R.formatDate(post.date))}</span>
        <h1>${ctx.esc(ctx.L(post.title))}</h1>
        <p class="blog-excerpt">${ctx.esc(ctx.L(post.excerpt))}</p>
        <img class="blog-hero" src="${ctx.esc(post.image || "assets/img/category-iphone.svg")}" alt="${ctx.esc(ctx.L(post.title))}">
        ${String(ctx.L(post.body))
          .split("\n")
          .filter(Boolean)
          .map((line) => `<p>${ctx.esc(line)}</p>`)
          .join("")}
        <a class="btn btn-outline" href="blog.html">${ctx.esc(ctx.t("blog"))}</a>
      </article>
    </div>`;
  }

  function renderAccount() {
    const root = document.getElementById("account-root");
    if (!root) return;
    document.title = `${ctx.t("myAccount")} | ${ctx.L(ctx.SET.storeName)}`;
    const cust = ctx.R.getCustomer();
    const orders = ctx.R.getOrders();
    const myOrders = cust ? ctx.R.getCustomerOrders() : [];

    const trackCard = `
      <section class="account-card">
        <span class="eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))}</span>
        <h2>${ctx.esc(ctx.t("trackOrder"))}</h2>
        <p>${ctx.esc(ctx.t("trackOrderText"))}</p>
        <div class="field"><label for="acc-order">${ctx.esc(ctx.t("orderId"))}</label><input id="acc-order" placeholder="RS-261022-A1B2" dir="ltr"></div>
        <div class="field"><label for="acc-phone">${ctx.esc(ctx.t("phone"))}</label><input id="acc-phone" inputmode="tel" placeholder="46 00 00 00" dir="ltr"></div>
        <button class="btn btn-primary btn-block" type="button" id="acc-track">${ctx.esc(ctx.t("trackOrder"))}</button>
        <div id="acc-result"></div>
        ${
          myOrders.length
            ? `<h3 class="account-subtitle">${ctx.esc(ctx.t("recentOrders"))}</h3>
        <div class="account-orders">${myOrders
          .slice(0, 5)
          .map((order) => {
            const status = ctx.R.statusMeta(order.status);
            return `<div class="account-order"><div><strong>${ctx.esc(order.id)}</strong><small>${ctx.esc(ctx.R.formatDate(order.createdAt))} · ${ctx.esc(order.items?.length || 0)} ${ctx.esc(ctx.t("products"))}</small></div><span class="status-pill u-status-text" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.L(status.label))}</span><b>${ctx.money(order.total)}</b></div>`;
          })
          .join("")}</div>`
            : `<p class="muted">${ctx.esc(ctx.t("noOrders"))}</p>`
        }
      </section>`;

    if (!cust) {
      root.innerHTML = `<div class="account-layout">
        <section class="account-card account-auth-card">
          <div class="account-auth-tabs">
            <button class="active" type="button" data-auth-tab="login">${ctx.esc(ctx.t("signIn"))}</button>
            <button type="button" data-auth-tab="register">${ctx.esc(ctx.t("createAccount"))}</button>

          </div>
          <form id="login-form" class="account-auth-form">
            <div class="field"><label>${ctx.esc(ctx.t("email"))}</label><input type="email" id="login-email" required dir="ltr" placeholder="you@example.com" autocomplete="email"></div>
            <div class="field"><label>${ctx.esc(ctx.t("password"))}</label><input type="password" id="login-password" required minlength="6" autocomplete="current-password"></div>
            <button class="btn btn-primary btn-block" type="submit">${ctx.esc(ctx.t("signIn"))}</button>
          </form>
          <form id="register-form" class="account-auth-form" hidden>
            <div class="field"><label>${ctx.esc(ctx.t("fullName"))}</label><input id="reg-name" required autocomplete="name"></div>
            <div class="field"><label>${ctx.esc(ctx.t("email"))}</label><input type="email" id="reg-email" required dir="ltr" autocomplete="email"></div>
            <div class="field"><label>${ctx.esc(ctx.t("phone"))}</label><input id="reg-phone" inputmode="tel" dir="ltr" placeholder="46 00 00 00" autocomplete="tel"></div>
            <div class="field"><label>${ctx.esc(ctx.t("password"))}</label><input type="password" id="reg-password" required minlength="8" autocomplete="new-password"></div>
            <button class="btn btn-primary btn-block" type="submit">${ctx.esc(ctx.t("createAccount"))}</button>
          </form>
          
          </div>
        </section>
        ${trackCard}
      </div>`;

      root.querySelectorAll("[data-auth-tab]").forEach((node) => {
        const button = /** @type {HTMLElement} */ (node);
        button.addEventListener("click", () => {
          const tab = button.dataset.authTab;
          root.querySelectorAll("[data-auth-tab]").forEach((b) => b.classList.toggle("active", b === button));
          /** @type {HTMLElement} */ (root.querySelector("#login-form")).hidden = tab !== "login";
          /** @type {HTMLElement} */ (root.querySelector("#register-form")).hidden = tab !== "register";

          root.querySelector("#auth-error")?.remove();
        });
      });

      const showAuthError = (message) => {
        let box = root.querySelector("#auth-error");
        if (!box) {
          box = document.createElement("p");
          box.id = "auth-error";
          box.className = "account-auth-error";
          root.querySelector(".account-auth-card").appendChild(box);
        }
        box.textContent = message;
      };

      /** @type {HTMLFormElement} */ (root.querySelector("#login-form")).addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = /** @type {HTMLButtonElement | undefined} */ (/** @type {SubmitEvent} */ (event).submitter);
        if (button) button.disabled = true;
        const email = readValue("#login-email");
        const password = readValue("#login-password");
        try {
          // Try admin login first (works with username or email)
          try {
            await ctx.R.login(email, password);
            const session = ctx.R.currentSession();
            if (session?.role === "owner" || session?.role === "manager") {
              ctx.toast(
                ctx.t("signedIn") + " - " + (session.role === "owner" ? ctx.t("owner") : ctx.t("manager")),
                "good"
              );
              setTimeout(() => {
                window.location.href = "dashboard.html";
              }, 500);
              return;
            }
          } catch {}
          // Fallback to customer login
          await ctx.R.customerLogin(email, password);
          ctx.toast(ctx.t("signedIn"), "good");
          ctx.renderCustomerAccount();
          renderAccount();
        } catch (error) {
          showAuthError(error.message || ctx.t("loginFailed"));
        } finally {
          if (button) button.disabled = false;
        }
      });

      // Dashboard login handler
      root.querySelector("#dash-login-btn")?.addEventListener("click", async () => {
        const button = /** @type {HTMLButtonElement} */ (root.querySelector("#dash-login-btn"));
        button.disabled = true;
        try {
          // Accept a username or a full e-mail address.
          const identifier = readValue("#dash-email").trim();
          const password = readValue("#dash-password");
          await ctx.R.login(identifier, password);
          ctx.toast(ctx.t("signedIn") + " (" + ctx.t("dashboardLogin") + ")", "good");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 500);
        } catch (error) {
          showAuthError(error.message || ctx.t("loginFailed"));
        } finally {
          button.disabled = false;
        }
      });

      /** @type {HTMLFormElement} */ (root.querySelector("#register-form")).addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          const button = /** @type {HTMLButtonElement | undefined} */ (/** @type {SubmitEvent} */ (event).submitter);
          if (button) button.disabled = true;
          try {
            const wishlist = [...ctx.readWish()];
            await ctx.R.customerRegister({
              name: readValue("#reg-name"),
              email: readValue("#reg-email"),
              phone: readValue("#reg-phone"),
              password: readValue("#reg-password"),
              wishlist
            });
            ctx.toast(ctx.t("accountCreated"), "good");
            ctx.renderCustomerAccount();
            renderAccount();
          } catch (error) {
            showAuthError(error.message || ctx.t("registerFailed"));
          } finally {
            if (button) button.disabled = false;
          }
        }
      );
    } else {
      const initial = String(cust.name || "U")
        .trim()
        .slice(0, 1)
        .toUpperCase();
      const wishlist = (cust.wishlist || [])
        .map((handle) => ctx.BY_HANDLE.get(handle))
        .filter(Boolean)
        .slice(0, 6);
      const myReviews = ctx.R.customerReviews().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const statusLabel = {
        pending: ctx.t("reviewStatusPending"),
        approved: ctx.t("reviewStatusApproved"),
        rejected: ctx.t("reviewStatusRejected")
      };
      root.innerHTML = `<div class="account-layout">
        <section class="account-card">
          <div class="account-profile">
            <span class="account-avatar lg">${ctx.esc(initial)}</span>
            <div class="grow"><h1>${ctx.esc(cust.name)}</h1><p dir="ltr">${ctx.esc(cust.email)}${cust.phone ? ` · ${ctx.esc(cust.phone)}` : ""}</p></div>
            <button class="btn btn-outline btn-sm" type="button" id="account-logout">${ctx.ICON.logout} ${ctx.esc(ctx.t("logout"))}</button>
          </div>
          <h3 class="account-subtitle">${ctx.esc(ctx.t("myWishlist"))} <span class="muted">(${(cust.wishlist || []).length})</span></h3>
          ${wishlist.length ? `<div class="account-wishlist">${wishlist.map((product) => `<a class="account-wish-item" href="product.html?handle=${encodeURIComponent(product.handle)}"><img src="${ctx.esc(product.image)}" alt="${ctx.esc(product.title)}"><span>${ctx.esc(product.title)}</span></a>`).join("")}</div>` : `<p class="muted">${ctx.esc(ctx.t("emptyWish"))}</p>`}
          <a class="text-link" href="wishlist.html">${ctx.esc(ctx.t("viewWishlist"))} ${ctx.ICON.arrowRight}</a>
          <h3 class="account-subtitle">${ctx.esc(ctx.t("myReviews"))}</h3>
          ${myReviews.length ? `<div class="account-reviews">${myReviews.map((review) => `<div class="account-review"><div class="grow"><strong>${ctx.esc(ctx.L(review.title))}</strong><small>${ctx.esc(review.productHandle)} · ${ctx.esc(ctx.R.formatDate(review.createdAt))}</small></div><span class="badge-soft ${review.status === "approved" ? "green" : review.status === "rejected" ? "red" : "orange"}">${ctx.esc(statusLabel[review.status] || review.status)}</span></div>`).join("")}</div>` : `<p class="muted">${ctx.esc(ctx.t("noReviews"))}</p>`}
        </section>
        ${trackCard}
      </div>`;
      root.querySelector("#account-logout")?.addEventListener("click", () => {
        ctx.R.customerLogout();
        ctx.renderCustomerAccount();
        ctx.toast(ctx.t("signedOut"), "good");
        renderAccount();
      });
    }

    /**
     * Value of an input of this panel.
     * @param {string} selector
     * @param {ParentNode} [scope]
     */
    const readValue = (selector, scope = root) => /** @type {HTMLInputElement} */ (scope.querySelector(selector)).value;

    const findOrder = () => {
      const code = readValue("#acc-order", document).trim().toUpperCase();
      const phone = readValue("#acc-phone", document).replace(/\D/g, "").slice(-8);
      const found = orders.find(
        (order) =>
          (!code || order.id.toUpperCase() === code) &&
          (!phone || String(order.customer?.phone).replace(/\D/g, "").endsWith(phone))
      );
      const box = document.getElementById("acc-result");
      if (!found) {
        box.innerHTML = `<div class="account-result error">${ctx.esc(ctx.t("orderNotFound"))}</div>`;
        return;
      }
      const status = ctx.R.statusMeta(found.status);
      box.innerHTML = `<div class="account-result"><div class="result-head"><strong>${ctx.esc(found.id)}</strong><span class="status-pill u-status-text" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.L(status.label))}</span></div><p>${ctx.esc(found.customer?.name || "")} · ${ctx.money(found.total)}</p><ul>${(found.items || []).map((item) => `<li>${ctx.esc(item.title)} × ${item.qty}</li>`).join("")}</ul></div>`;
    };
    document.getElementById("acc-track")?.addEventListener("click", findOrder);
    document.getElementById("acc-order")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") findOrder();
    });
  }
}
