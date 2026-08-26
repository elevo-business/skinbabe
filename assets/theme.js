/* ============================================================
   skinbabe — theme.js
   Vanilla custom elements. No dependencies.
   ============================================================ */
(function () {
  'use strict';

  const T = window.theme || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const announce = (msg) => {
    const region = document.getElementById('sb-live-region');
    if (region) { region.textContent = ''; setTimeout(() => (region.textContent = msg), 60); }
  };

  const formatMoney = (cents) => {
    const fmt = T.moneyFormat || '{{amount_with_comma_separator}} €';
    const value = (cents / 100);
    const withComma = value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const noDecimals = Math.round(value).toLocaleString('de-DE');
    return fmt
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, withComma)
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, noDecimals)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, noDecimals)
      .replace(/\{\{\s*amount\s*\}\}/g, value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const trapFocus = (container, opener) => {
    const focusables = () => $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', container)
      .filter((el) => el.offsetParent !== null);
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', onKey);
    const list = focusables();
    (list[0] || container).focus({ preventScroll: true });
    return () => { container.removeEventListener('keydown', onKey); if (opener) opener.focus({ preventScroll: true }); };
  };

  let scrollLocks = 0;
  const lockScroll = () => {
    if (scrollLocks++ === 0) {
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
      document.body.style.overflow = 'hidden';
    }
  };
  const unlockScroll = () => {
    if (--scrollLocks <= 0) { scrollLocks = 0; document.body.style.overflow = ''; document.body.style.paddingRight = ''; }
  };

  /* ---------------- Cart store ---------------- */
  const CartStore = {
    subscribers: new Set(),
    subscribe(fn) { this.subscribers.add(fn); return () => this.subscribers.delete(fn); },
    publish(cart) { this.subscribers.forEach((fn) => fn(cart)); document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart })); },

    async fetchSections(cart) {
      const ids = ['cart-drawer', 'cart-icon-bubble'];
      try {
        const res = await fetch(`${T.routes.root}?sections=${ids.join(',')}`);
        const sections = await res.json();
        this.render(sections);
      } catch (e) { /* non-fatal */ }
      this.publish(cart);
    },

    render(sections) {
      Object.entries(sections).forEach(([id, html]) => {
        const target = document.getElementById(`shopify-section-${id}`) || document.getElementById(id);
        if (!target || !html) return;
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const source = parsed.getElementById(`shopify-section-${id}`) || parsed.getElementById(id) || parsed.body;
        if (id === 'cart-icon-bubble') {
          const bubble = parsed.querySelector('[data-cart-count]');
          $$('[data-cart-count]').forEach((el) => { if (bubble) el.replaceWith(bubble.cloneNode(true)); });
          return;
        }
        target.innerHTML = source.innerHTML;
      });
    },

    async add(formDataOrItems) {
      const body = formDataOrItems instanceof FormData ? formDataOrItems : JSON.stringify(formDataOrItems);
      const headers = formDataOrItems instanceof FormData ? {} : { 'Content-Type': 'application/json' };
      const res = await fetch(`${T.routes.cartAdd}`, { method: 'POST', headers: { Accept: 'application/json', ...headers }, body });
      const data = await res.json();
      if (!res.ok) throw data;
      const cart = await (await fetch(`${T.routes.cart}.js`)).json();
      await this.fetchSections(cart);
      return data;
    },

    async change(payload) {
      const res = await fetch(`${T.routes.cartChange}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const cart = await res.json();
      await this.fetchSections(cart);
      return cart;
    }
  };
  window.CartStore = CartStore;

  /* ---------------- <sb-drawer> ---------------- */
  class SbDrawer extends HTMLElement {
    connectedCallback() {
      this.releaseFocus = null;
      this.addEventListener('click', (e) => {
        if (e.target.matches('[data-drawer-close]') || e.target.closest('[data-drawer-close]')) { e.preventDefault(); this.close(); }
        if (e.target === this.querySelector('[data-drawer-overlay]')) this.close();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.hasAttribute('open')) this.close(); });
    }
    open(opener) {
      this.setAttribute('open', '');
      lockScroll();
      requestAnimationFrame(() => {
        const panel = this.querySelector('[data-drawer-panel]') || this;
        this.releaseFocus = trapFocus(panel, opener);
      });
      this.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
    }
    close() {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      unlockScroll();
      if (this.releaseFocus) { this.releaseFocus(); this.releaseFocus = null; }
      this.dispatchEvent(new CustomEvent('drawer:close', { bubbles: true }));
    }
  }
  customElements.define('sb-drawer', SbDrawer);

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-drawer-open]');
    if (!opener) return;
    const drawer = document.getElementById(opener.getAttribute('data-drawer-open'));
    if (!drawer) return;
    e.preventDefault();
    drawer.open(opener);
  });

  /* ---------------- <sb-quantity> ---------------- */
  class SbQuantity extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        e.preventDefault();
        const step = btn.dataset.qty === 'plus' ? 1 : -1;
        const min = parseInt(this.input.min || '0', 10);
        const next = Math.max(min, (parseInt(this.input.value, 10) || 0) + step);
        this.input.value = next;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
  customElements.define('sb-quantity', SbQuantity);

  /* ---------------- <sb-cart-items> ---------------- */
  class SbCartItems extends HTMLElement {
    connectedCallback() {
      this.addEventListener('change', (e) => {
        const input = e.target.closest('[data-cart-qty]');
        if (!input) return;
        this.update(input.dataset.line, parseInt(input.value, 10));
      });
      this.addEventListener('click', (e) => {
        const remove = e.target.closest('[data-cart-remove]');
        if (!remove) return;
        e.preventDefault();
        this.update(remove.dataset.line, 0);
      });
    }
    async update(line, quantity) {
      this.setAttribute('aria-busy', 'true');
      try { await CartStore.change({ line: parseInt(line, 10), quantity }); }
      finally { this.removeAttribute('aria-busy'); }
    }
  }
  customElements.define('sb-cart-items', SbCartItems);

  /* ---------------- <sb-product-form> ---------------- */
  class SbProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (!this.form) return;
      this.button = this.querySelector('[type="submit"]');
      this.errorEl = this.querySelector('[data-form-error]');
      this.form.addEventListener('submit', this.onSubmit.bind(this));
    }
    async onSubmit(e) {
      if (this.dataset.cartType === 'page') return; // let it post normally
      e.preventDefault();
      if (!this.button || this.button.getAttribute('aria-disabled') === 'true') return;
      const label = this.button.querySelector('[data-btn-label]') || this.button;
      const original = label.textContent;
      this.button.setAttribute('aria-disabled', 'true');
      label.textContent = T.strings.adding;
      if (this.errorEl) { this.errorEl.hidden = true; this.errorEl.textContent = ''; }

      // Upsell-Checkbox: zweite Position mitnehmen
      const upsell = this.form.querySelector('[data-upsell]:checked');
      let payload;
      if (upsell && !this.form.dataset.bundleItems) {
        const mainId = this.form.querySelector('[name="id"]').value;
        const qty = parseInt(this.form.querySelector('[name="quantity"]').value, 10) || 1;
        payload = { items: [{ id: Number(mainId), quantity: qty }, { id: Number(upsell.value), quantity: 1 }] };
      } else if (this.form.dataset.bundleItems) {
        try {
          payload = { items: JSON.parse(this.form.dataset.bundleItems) };
        } catch (e) {
          payload = null;
        }
      }
      if (!payload) {
        payload = new FormData(this.form);
        payload.append('sections_url', window.location.pathname);
      }

      try {
        await CartStore.add(payload);
        label.textContent = T.strings.added;
        announce(T.strings.added);
        const drawer = document.getElementById('CartDrawer');
        if (drawer && T.cartType === 'drawer') drawer.open(this.button);
      } catch (err) {
        if (this.errorEl) { this.errorEl.hidden = false; this.errorEl.textContent = (err && err.description) || T.strings.cartError; }
      } finally {
        setTimeout(() => { label.textContent = original; this.button.removeAttribute('aria-disabled'); }, 900);
      }
    }
  }
  customElements.define('sb-product-form', SbProductForm);

  /* ---------------- <sb-variants> ---------------- */
  class SbVariants extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.section;
      this.productUrl = this.dataset.url;
      this.variants = JSON.parse(this.querySelector('[type="application/json"]').textContent);
      this.addEventListener('change', this.onChange.bind(this));
    }
    get selectedOptions() {
      return $$('fieldset', this).map((fs) => {
        const checked = fs.querySelector('input:checked');
        if (checked) return checked.value;
        const select = fs.querySelector('select');
        return select ? select.value : null;
      });
    }
    onChange() {
      const opts = this.selectedOptions;
      const variant = this.variants.find((v) => v.options.every((o, i) => o === opts[i]));
      this.updateLabels();
      if (!variant) { this.setUnavailable(); return; }
      this.updateURL(variant);
      this.updateFormInput(variant);
      this.updatePrice(variant);
      this.updateButton(variant);
      this.updateMedia(variant);
      document.dispatchEvent(new CustomEvent('variant:changed', { detail: { variant, sectionId: this.sectionId } }));
    }
    updateLabels() {
      $$('[data-option-value-label]', this).forEach((el) => {
        const input = el.previousElementSibling;
        if (input && input.checked) {
          const target = document.querySelector(`[data-selected-option="${input.name}"]`);
          if (target) target.textContent = input.value;
        }
      });
    }
    updateURL(variant) {
      if (!variant || this.dataset.updateUrl === 'false') return;
      window.history.replaceState({}, '', `${this.productUrl}?variant=${variant.id}`);
    }
    updateFormInput(variant) {
      $$(`#product-form-${this.sectionId} input[name="id"], form[data-product-form] input[name="id"]`).forEach((input) => {
        input.value = variant.id;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    updatePrice(variant) {
      const host = document.getElementById(`price-${this.sectionId}`);
      if (!host) return;
      const current = host.querySelector('[data-price-current]');
      const compare = host.querySelector('[data-price-compare]');
      if (current) current.textContent = formatMoney(variant.price);
      if (compare) {
        const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
        compare.textContent = onSale ? formatMoney(variant.compare_at_price) : '';
        compare.hidden = !onSale;
        host.classList.toggle('price--on-sale', !!onSale);
      }
      const unit = host.querySelector('[data-price-unit]');
      if (unit) {
        if (variant.unit_price_measurement) {
          unit.hidden = false;
          unit.textContent = `${formatMoney(variant.unit_price)} / ${variant.unit_price_measurement.reference_value !== 1 ? variant.unit_price_measurement.reference_value : ''}${variant.unit_price_measurement.reference_unit}`;
        } else { unit.hidden = true; }
      }
    }
    updateButton(variant) {
      const btn = document.querySelector(`#product-form-${this.sectionId} [type="submit"]`);
      if (!btn) return;
      const label = btn.querySelector('[data-btn-label]') || btn;
      if (variant.available) { btn.removeAttribute('aria-disabled'); btn.disabled = false; label.textContent = T.strings.addToCart; }
      else { btn.setAttribute('aria-disabled', 'true'); btn.disabled = true; label.textContent = T.strings.soldOut; }
    }
    setUnavailable() {
      const btn = document.querySelector(`#product-form-${this.sectionId} [type="submit"]`);
      if (!btn) return;
      const label = btn.querySelector('[data-btn-label]') || btn;
      btn.setAttribute('aria-disabled', 'true');
      btn.disabled = true;
      label.textContent = T.strings.unavailable;
    }
    updateMedia(variant) {
      if (!variant.featured_media) return;
      const gallery = document.getElementById(`gallery-${this.sectionId}`);
      if (!gallery) return;
      const slide = gallery.querySelector(`[data-media-id="${variant.featured_media.id}"]`);
      if (slide) slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }
  customElements.define('sb-variants', SbVariants);

  /* ---------------- <sb-quick-add> ---------------- */
  class SbQuickAdd extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      if (!this.button) return;
      this.button.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = this.dataset.variantId;
        if (!id) return;
        this.button.setAttribute('aria-disabled', 'true');
        try {
          await CartStore.add({ items: [{ id: Number(id), quantity: 1 }] });
          announce(T.strings.added);
          const drawer = document.getElementById('CartDrawer');
          if (drawer && T.cartType === 'drawer') drawer.open(this.button);
        } catch (err) { /* silent */ }
        finally { this.button.removeAttribute('aria-disabled'); }
      });
    }
  }
  customElements.define('sb-quick-add', SbQuickAdd);

  /* ---------------- <sb-header> ---------------- */
  class SbHeader extends HTMLElement {
    connectedCallback() {
      this.setHeight();
      window.addEventListener('resize', this.setHeight.bind(this), { passive: true });
      let last = window.scrollY;
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        this.classList.toggle('is-stuck', y > 8);
        if (this.dataset.hideOnScroll === 'true') {
          this.classList.toggle('is-hidden', y > last && y > 240 && !this.contains(document.activeElement));
        }
        last = y;
      }, { passive: true });

      $$('[data-mega-trigger]', this).forEach((trigger) => {
        const parent = trigger.closest('[data-mega]');
        trigger.addEventListener('click', (e) => {
          if (window.matchMedia('(max-width: 989px)').matches) return;
          e.preventDefault();
          const open = parent.hasAttribute('open');
          $$('[data-mega][open]', this).forEach((el) => el.removeAttribute('open'));
          if (!open) parent.setAttribute('open', '');
        });
      });
      this.addEventListener('mouseleave', () => $$('[data-mega][open]', this).forEach((el) => el.removeAttribute('open')));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('[data-mega][open]', this).forEach((el) => el.removeAttribute('open')); });
    }
    setHeight() {
      document.documentElement.style.setProperty('--sb-header-height', `${this.offsetHeight}px`);
    }
  }
  customElements.define('sb-header', SbHeader);

  /* ---------------- <sb-accordion> ---------------- */
  class SbAccordion extends HTMLElement {
    connectedCallback() {
      if (this.dataset.single !== 'true') return;
      this.addEventListener('toggle', (e) => {
        if (!e.target.open) return;
        $$('details[open]', this).forEach((d) => { if (d !== e.target) d.open = false; });
      }, true);
    }
  }
  customElements.define('sb-accordion', SbAccordion);

  /* ---------------- <sb-slider> ---------------- */
  class SbSlider extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-slider-track]');
      if (!this.track) return;
      this.prev = this.querySelector('[data-slider-prev]');
      this.next = this.querySelector('[data-slider-next]');
      const step = () => this.track.querySelector('li, .slider__item')?.getBoundingClientRect().width + 20 || 320;
      this.prev?.addEventListener('click', () => this.track.scrollBy({ left: -step(), behavior: 'smooth' }));
      this.next?.addEventListener('click', () => this.track.scrollBy({ left: step(), behavior: 'smooth' }));
      this.track.addEventListener('scroll', this.updateButtons.bind(this), { passive: true });
      window.addEventListener('resize', this.updateButtons.bind(this), { passive: true });
      this.updateButtons();
    }
    updateButtons() {
      if (!this.prev || !this.next) return;
      const { scrollLeft, scrollWidth, clientWidth } = this.track;
      this.prev.disabled = scrollLeft <= 2;
      this.next.disabled = scrollLeft + clientWidth >= scrollWidth - 2;
      this.classList.toggle('slider--static', scrollWidth <= clientWidth + 2);
    }
  }
  customElements.define('sb-slider', SbSlider);

  /* ---------------- <sb-media-gallery> ---------------- */
  class SbMediaGallery extends HTMLElement {
    connectedCallback() {
      this.viewer = this.querySelector('[data-gallery-viewer]');
      this.thumbs = $$('[data-gallery-thumb]', this);
      this.thumbs.forEach((thumb) => {
        thumb.addEventListener('click', (e) => {
          e.preventDefault();
          const target = this.querySelector(`[data-media-id="${thumb.dataset.mediaTarget}"]`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
          this.thumbs.forEach((t) => t.setAttribute('aria-current', String(t === thumb)));
        });
      });
      if (!this.viewer) return;
      const slides = $$('[data-media-id]', this.viewer);
      const counter = this.querySelector('[data-gallery-current]');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio < 0.6) return;
          const id = entry.target.dataset.mediaId;
          this.thumbs.forEach((t) => t.setAttribute('aria-current', String(t.dataset.mediaTarget === id)));
          if (counter) counter.textContent = slides.indexOf(entry.target) + 1;
        });
      }, { root: this.viewer, threshold: 0.6 });
      slides.forEach((s) => io.observe(s));
    }
  }
  customElements.define('sb-media-gallery', SbMediaGallery);

  /* ---------------- <sb-facets> ---------------- */
  class SbFacets extends HTMLElement {
    connectedCallback() {
      this.addEventListener('change', this.onChange.bind(this));
      this.addEventListener('click', (e) => {
        const clear = e.target.closest('[data-facet-clear]');
        if (!clear) return;
        e.preventDefault();
        this.render(clear.href);
      });
      window.addEventListener('popstate', () => this.render(window.location.href, false));
    }
    onChange(e) {
      const form = e.target.closest('form');
      if (!form) return;
      const params = new URLSearchParams(new FormData(form)).toString();
      this.render(`${window.location.pathname}?${params}`);
    }
    async render(url, push = true) {
      this.setAttribute('aria-busy', 'true');
      const sectionId = this.dataset.section;
      try {
        const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}section_id=${sectionId}`);
        const html = new DOMParser().parseFromString(await res.text(), 'text/html');
        const nextResults = html.querySelector('[data-facet-results]');
        const nextFilters = html.querySelector('[data-facet-filters]');
        if (nextResults) this.querySelector('[data-facet-results]').innerHTML = nextResults.innerHTML;
        if (nextFilters) this.querySelector('[data-facet-filters]').innerHTML = nextFilters.innerHTML;
        if (push) window.history.pushState({}, '', url);
      } finally {
        this.removeAttribute('aria-busy');
        initReveal(this);
      }
    }
  }
  customElements.define('sb-facets', SbFacets);

  /* ---------------- <sb-predictive-search> ---------------- */
  class SbPredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-search-results]');
      if (!this.input || !this.results) return;
      let timer;
      this.input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = this.input.value.trim();
        if (q.length < 2) { this.results.innerHTML = ''; this.results.hidden = true; return; }
        timer = setTimeout(() => this.search(q), 260);
      });
    }
    async search(q) {
      try {
        const url = `${T.routes.predictiveSearch}?q=${encodeURIComponent(q)}&resources[type]=product,page,article&resources[limit]=6&section_id=predictive-search`;
        const res = await fetch(url);
        const html = new DOMParser().parseFromString(await res.text(), 'text/html');
        const content = html.querySelector('[data-predictive-content]');
        this.results.innerHTML = content ? content.innerHTML : '';
        this.results.hidden = false;
      } catch (e) { this.results.hidden = true; }
    }
  }
  customElements.define('sb-predictive-search', SbPredictiveSearch);

  /* ---------------- <sb-cart-progress> ---------------- */
  class SbCartProgress extends HTMLElement {
    connectedCallback() {
      this.threshold = parseInt(this.dataset.threshold, 10) || 0;
      this.render(parseInt(this.dataset.total, 10) || 0);
      CartStore.subscribe((cart) => this.render(cart.total_price));
    }
    render(total) {
      if (!this.threshold) return;
      const bar = this.querySelector('[data-progress-bar]');
      const text = this.querySelector('[data-progress-text]');
      const pct = Math.min(100, (total / this.threshold) * 100);
      if (bar) bar.style.setProperty('--progress', `${pct}%`);
      if (text) {
        text.textContent = total >= this.threshold
          ? this.dataset.reached
          : this.dataset.remaining.replace('%%', formatMoney(this.threshold - total));
      }
      this.classList.toggle('is-complete', total >= this.threshold);
    }
  }
  customElements.define('sb-cart-progress', SbCartProgress);

  /* ---------------- Scroll reveal ---------------- */
  let revealObserver;
  function initReveal(root = document) {
    if (!T.animations) { $$('.reveal', root).forEach((el) => el.classList.add('is-visible')); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $$('.reveal', root).forEach((el) => el.classList.add('is-visible')); return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    }
    $$('.reveal:not(.is-visible)', root).forEach((el) => revealObserver.observe(el));
  }

  /* ---------------- Boot ---------------- */
  const boot = () => {
    initReveal();
    if (window.Shopify && window.Shopify.designMode) {
      document.addEventListener('shopify:section:load', () => initReveal());
      document.addEventListener('shopify:section:select', (e) => {
        const drawer = e.target.querySelector('sb-drawer');
        if (drawer) drawer.open();
      });
      document.addEventListener('shopify:section:deselect', (e) => {
        const drawer = e.target.querySelector('sb-drawer');
        if (drawer) drawer.close();
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SkinbabeTheme = { formatMoney, announce, initReveal, CartStore };
})();
