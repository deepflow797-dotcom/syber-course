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
  function normalizeReview(review = {}) {
    const status = ["pending", "approved", "rejected"].includes(review.status)
      ? review.status
      : review.approved === false
        ? "rejected"
        : "approved";
    return {
      id: review.id || ctx.uid("rev"),
      productHandle: review.productHandle || review.product_handle || review.handle || "",
      customerId: review.customerId || review.customer_id || "",
      customerName: review.customerName || review.customer_name || review.name || "Client",
      email: ctx.normalizeEmail(review.email || ""),
      rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
      title: review.title ?? "",
      body: review.body ?? review.comment ?? "",
      status,
      verified: review.verified !== false,
      createdAt: review.createdAt || review.created_at || ctx.nowISO(),
      updatedAt: review.updatedAt || review.updated_at || ""
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
  async function submitReview(data = {}) {
    if (!ctx.currentCustomer) throw new Error("loginRequired");
    const productHandle = String(data.productHandle || "").trim();
    const rating = Number(data.rating);
    const title = String(data.title || "")
      .trim()
      .slice(0, 120);
    const body = String(data.body || "")
      .trim()
      .slice(0, 2000);
    if (!productHandle || !ctx.state.products.some((product) => product.handle === productHandle))
      throw new Error("المنتج غير موجود");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("التقييم يجب أن يكون بين 1 و 5");
    if (title.length < 2) throw new Error("أضف عنوانًا للتقييم");
    if (body.length < 4) throw new Error("أضف تعليقًا للتقييم");
    if (
      ctx.reviewCache.some(
        (review) =>
          review.productHandle === productHandle &&
          review.status === "pending" &&
          review.customerId === (ctx.customerAuth?.user?.id || ctx.currentCustomer.id)
      )
    ) {
      throw new Error("لديك تقييم قيد المراجعة لهذا المنتج");
    }

    if (ctx.REMOTE) {
      if (!ctx.customerAuth?.accessToken) throw new Error("سجّل الدخول بحساب العميل لتقييم المنتج");
      const rows = await ctx.supaCustomer(`/rest/v1/${ctx.CFG.reviewsTable}?select=*`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          product_handle: productHandle,
          customer_id: ctx.customerAuth.user.id,
          customer_name: ctx.currentCustomer.name,
          rating,
          title,
          body,
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

    const review = normalizeReview({
      id: ctx.uid("rev"),
      productHandle,
      customerId: ctx.currentCustomer.id,
      customerName: ctx.currentCustomer.name,
      email: ctx.currentCustomer.email,
      rating,
      title,
      body,
      status: "pending",
      verified: true,
      createdAt: ctx.nowISO()
    });
    const rows = loadLocalReviews();
    rows.unshift(review);
    persistLocalReviews(rows);
    return review;
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
