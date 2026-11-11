// @ts-check
/* state.js → Product reviews (moderated)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, {
    normalizeReview,
    loadLocalReviews,
    setReviewCache,
    persistLocalReviews,
    refreshReviews,
    publicReviewsFor,
    getProductReviews,
    getPendingReviews,
    getAllCustomerReviews,
    customerReviews,
    submitReview,
    moderateReview,
    deleteCustomerReview
  });
  const REVIEW_STATUSES = ["pending", "approved", "rejected"];

  /** Legacy rows used `approved` instead of `status`. */
  function reviewStatus(review) {
    if (REVIEW_STATUSES.includes(review.status)) return review.status;
    return review.approved === false ? "rejected" : "approved";
  }

  /** Text field with a fallback chain of legacy column names. */
  const firstText = (...values) => values.find((value) => value != null && value !== "") ?? "";

  function reviewAuthor(review) {
    return {
      customerId: firstText(review.customerId, review.customer_id),
      customerName: firstText(review.customerName, review.customer_name, review.name, "Client"),
      email: ctx.normalizeEmail(review.email || "")
    };
  }

  function reviewBody(review) {
    return {
      rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
      title: review.title ?? "",
      body: review.body ?? review.comment ?? ""
    };
  }

  function reviewMeta(review) {
    return {
      status: reviewStatus(review),
      verified: review.verified !== false,
      createdAt: firstText(review.createdAt, review.created_at, ctx.nowISO()),
      updatedAt: firstText(review.updatedAt, review.updated_at)
    };
  }

  function normalizeReview(review = {}) {
    return {
      id: review.id || ctx.uid("rev"),
      productHandle: firstText(review.productHandle, review.product_handle, review.handle),
      ...reviewAuthor(review),
      ...reviewBody(review),
      ...reviewMeta(review)
    };
  }
  function loadLocalReviews() {
    const rows = ctx.readJSON(ctx.LS_REVIEWS, []);
    return (Array.isArray(rows) ? rows : []).map(normalizeReview).slice(0, ctx.MAX_REMOTE_REVIEWS);
  }
  function setReviewCache(rows, broadcast = true) {
    const next = (Array.isArray(rows) ? rows : []).map(normalizeReview).slice(0, ctx.MAX_REMOTE_REVIEWS);
    const before = ctx.reviewCache.map((review) => `${review.id}:${review.status}`).join("|");
    const after = next.map((review) => `${review.id}:${review.status}`).join("|");
    ctx.reviewCache = next;
    if (broadcast && before !== after) {
      ctx.channel?.postMessage({ type: "reviews" });
      window.dispatchEvent(new CustomEvent("restore:reviews"));
    }
    return ctx.reviewCache;
  }
  function persistLocalReviews(rows, broadcast = true) {
    const normalized = (Array.isArray(rows) ? rows : []).map(normalizeReview).slice(0, ctx.MAX_REMOTE_REVIEWS);
    ctx.writeJSON(ctx.LS_REVIEWS, normalized);
    setReviewCache(normalized, broadcast);
    return normalized;
  }
  async function refreshReviews() {
    if (!ctx.REMOTE) {
      setReviewCache(loadLocalReviews(), true);
      return ctx.reviewCache;
    }
    try {
      const staff = ctx.session?.mode === "supabase" && (await ctx.remoteSessionValid());
      const query = staff
        ? `?select=*&order=created_at.desc&limit=${ctx.MAX_REMOTE_REVIEWS}`
        : `?status=eq.approved&select=*&order=created_at.desc&limit=${ctx.MAX_REMOTE_REVIEWS}`;
      const rows = await ctx.supa(`/rest/v1/${ctx.CFG.reviewsTable}${query}`, {}, staff);
      if (Array.isArray(rows))
        setReviewCache(
          rows.map((row) =>
            normalizeReview({
              ...row,
              productHandle: row.product_handle,
              customerId: row.customer_id,
              customerName: row.customer_name,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            })
          ),
          true
        );
    } catch (error) {
      console.warn("Restore: review sync failed", error);
      setReviewCache(loadLocalReviews(), false);
    }
    return ctx.reviewCache;
  }
  function publicReviewsFor(handle) {
    const editorReviews = (ctx.state.reviews || [])
      .filter((review) => (review.handle === handle || review.productHandle === handle) && review.approved !== false)
      .map((review) => normalizeReview({ ...review, status: "approved", productHandle: handle }));
    const moderated = ctx.reviewCache.filter(
      (review) => review.productHandle === handle && review.status === "approved"
    );
    const seen = new Set();
    return [...moderated, ...editorReviews].filter((review) => {
      const key = review.id || `${review.customerName}:${String(review.title)}:${review.createdAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function getProductReviews(handle) {
    return publicReviewsFor(handle).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function getPendingReviews() {
    return ctx.reviewCache.filter((review) => review.status === "pending");
  }
  function getAllCustomerReviews() {
    return ctx.clone(ctx.reviewCache);
  }
  function customerReviews() {
    if (!ctx.currentCustomer) return [];
    const ids = [ctx.currentCustomer.id, ctx.currentCustomer.authId, ctx.customerAuth?.user?.id].filter(Boolean);
    return ctx.reviewCache.filter(
      (review) =>
        ids.includes(review.customerId) ||
        (ctx.currentCustomer.email && review.email === ctx.normalizeEmail(ctx.currentCustomer.email))
    );
  }
  const trimmed = (value, max) =>
    String(value || "")
      .trim()
      .slice(0, max);

  /** Throws the first validation error of a review draft. */
  function assertReviewDraft(draft) {
    const knownProduct = ctx.state.products.some((product) => product.handle === draft.productHandle);
    if (!draft.productHandle || !knownProduct) throw new Error("المنتج غير موجود");
    if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5)
      throw new Error("التقييم يجب أن يكون بين 1 و 5");
    if (draft.title.length < 2) throw new Error("أضف عنوانًا للتقييم");
    if (draft.body.length < 4) throw new Error("أضف تعليقًا للتقييم");
  }

  /** Sanitised review fields, validated against the catalog and the rules. */
  function reviewDraft(data) {
    const draft = {
      productHandle: trimmed(data.productHandle, 120),
      rating: Number(data.rating),
      title: trimmed(data.title, 120),
      body: trimmed(data.body, 2000)
    };
    assertReviewDraft(draft);
    return draft;
  }

  /** One pending review per product per customer. */
  function assertNoPendingReview(productHandle) {
    const customerId = ctx.customerAuth?.user?.id || ctx.currentCustomer.id;
    const pending = ctx.reviewCache.some(
      (review) =>
        review.productHandle === productHandle && review.status === "pending" && review.customerId === customerId
    );
    if (pending) throw new Error("لديك تقييم قيد المراجعة لهذا المنتج");
  }

  /** Remote insert through the customer-scoped REST helper. */
  async function submitRemoteReview(draft) {
    if (!ctx.customerAuth?.accessToken) throw new Error("سجّل الدخول بحساب العميل لتقييم المنتج");
    const rows = await ctx.supaCustomer(`/rest/v1/${ctx.CFG.reviewsTable}?select=*`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        product_handle: draft.productHandle,
        customer_id: ctx.customerAuth.user.id,
        customer_name: ctx.currentCustomer.name,
        rating: draft.rating,
        title: draft.title,
        body: draft.body,
        status: "pending"
      })
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("تعذر حفظ التقييم");
    const normalized = normalizeReview({
      ...row,
      productHandle: row.product_handle,
      customerId: row.customer_id,
      customerName: row.customer_name,
      createdAt: row.created_at
    });
    await refreshReviews();
    return normalized;
  }

  /** Local (draft) insert, queued for moderation. */
  function submitLocalReview(draft) {
    const review = normalizeReview({
      id: ctx.uid("rev"),
      ...draft,
      customerId: ctx.currentCustomer.id,
      customerName: ctx.currentCustomer.name,
      email: ctx.currentCustomer.email,
      status: "pending",
      verified: true,
      createdAt: ctx.nowISO()
    });
    const rows = loadLocalReviews();
    rows.unshift(review);
    persistLocalReviews(rows);
    return review;
  }

  async function submitReview(data = {}) {
    if (!ctx.currentCustomer) throw new Error("loginRequired");
    const draft = reviewDraft(data);
    assertNoPendingReview(draft.productHandle);
    if (ctx.REMOTE) return submitRemoteReview(draft);
    return submitLocalReview(draft);
  }

  async function moderateReview(reviewId, action) {
    const id = String(reviewId || "");
    if (!id) throw new Error("تقييم غير معروف");
    const status = action === "reject" || action === "rejected" ? "rejected" : "approved";
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error("سجّل الدخول إلى لوحة التحكم");
      await ctx.supa(
        `/rest/v1/${ctx.CFG.reviewsTable}?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, updated_at: ctx.nowISO() }),
          headers: { Prefer: "return=minimal" }
        },
        true
      );
      await refreshReviews();
      return true;
    }
    const rows = loadLocalReviews();
    const index = rows.findIndex((review) => review.id === id);
    if (index < 0) return false;
    rows[index].status = status;
    rows[index].updatedAt = ctx.nowISO();
    persistLocalReviews(rows);
    return true;
  }
  async function deleteCustomerReview(reviewId) {
    const id = String(reviewId || "");
    if (!id) return false;
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error("سجّل الدخول إلى لوحة التحكم");
      await ctx.supa(`/rest/v1/${ctx.CFG.reviewsTable}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }, true);
      await refreshReviews();
      return true;
    }
    const rows = loadLocalReviews().filter((review) => review.id !== id);
    persistLocalReviews(rows);
    return true;
  }
}
