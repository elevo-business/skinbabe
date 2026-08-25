/* ============================================================
   skinbabe — conversion.js
   Bundles, Set-Konfigurator, Sticky-Buy-Bar, Vergleichsslider.
   Setzt auf window.CartStore und window.SkinbabeTheme aus theme.js auf.
   ============================================================ */
(function () {
  'use strict';

  const T = window.theme || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (cents) =>
    (window.SkinbabeTheme && window.SkinbabeTheme.formatMoney)
      ? window.SkinbabeTheme.formatMoney(cents)
      : (cents / 100).toFixed(2) + ' €';

  /* ---------------- <sb-bundle> --------------------------------
     Kaufoptionen auf der Produktseite. Jede Option ist entweder
     ein eigenes Produkt oder eine Mengenstufe des aktuellen Produkts.
     Ändert Formularziel, Preisanzeige und Sticky-Bar.
  --------------------------------------------------------------- */
  class SbBundle extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.section;
      this.form = document.getElementById(`product-form-${this.sectionId}`);
      this.priceHost = document.getElementById(`price-${this.sectionId}`);
      this.addEventListener('change', (e) => {
        if (!e.target.matches('input[type="radio"]')) return;
        this.apply(e.target);
      });
      const checked = this.querySelector('input[type="radio"]:checked');
      if (checked) this.apply(checked, true);

      // Varianten-Picker hat Vorrang, wenn der Kunde dort etwas ändert
      document.addEventListener('variant:changed', (e) => {
        if (e.detail.sectionId !== this.sectionId) return;
        const active = this.querySelector('input[type="radio"]:checked');
        if (active && active.dataset.mode === 'quantity') {
          const qty = parseInt(active.dataset.count, 10) || 1;
          const v = e.detail.variant;
          active.dataset.variantId = v.id;
          active.dataset.items = JSON.stringify([{ id: v.id, quantity: qty }]);
          active.dataset.total = v.price * qty;
          active.dataset.compare = (v.compare_at_price || v.price) * qty;
          active.dataset.available = String(v.available);
          this.apply(active, true);
        }
      });
    }

    apply(input, silent) {
      let items = [];
      try { items = JSON.parse(input.dataset.items || '[]'); } catch (e) { items = []; }
      const count = parseInt(input.dataset.count, 10) || 1;
      const total = parseInt(input.dataset.total, 10) || 0;
      const compareTotal = parseInt(input.dataset.compare, 10) || 0;

      $$('.bundle__option', this).forEach((el) =>
        el.classList.toggle('is-selected', el.contains(input))
      );

      if (this.form) {
        const idInput = this.form.querySelector('input[name="id"]');
        const qtyInput = this.form.querySelector('input[name="quantity"]');

        // Fallback ohne JS-Warenkorb: erste Position im Formular
        if (idInput && input.dataset.variantId) idInput.value = input.dataset.variantId;
        if (qtyInput) qtyInput.value = items.length === 1 ? (items[0].quantity || 1) : 1;

        // Mehrteilige Bundles werden als Positionsliste hinzugefügt
        if (items.length > 1) {
          this.form.dataset.bundleItems = JSON.stringify(items);
        } else {
          delete this.form.dataset.bundleItems;
        }

        // Express-Buttons können nur eine Variante tragen
        const payment = this.form.querySelector('.shopify-payment-button');
        if (payment) payment.hidden = items.length > 1;

        const submit = this.form.querySelector('[type="submit"]');
        if (submit) {
          const available = input.dataset.available !== 'false';
          submit.disabled = !available;
          submit.toggleAttribute('aria-disabled', !available);
          const label = submit.querySelector('[data-btn-label]');
          if (label) label.textContent = available ? T.strings.addToCart : T.strings.soldOut;
        }
      }

      if (this.priceHost) {
        const current = this.priceHost.querySelector('[data-price-current]');
        const comp = this.priceHost.querySelector('[data-price-compare]');
        if (current) current.textContent = money(total);
        if (comp) {
          const onSale = compareTotal > total;
          comp.textContent = onSale ? money(compareTotal) : '';
          comp.hidden = !onSale;
          this.priceHost.classList.toggle('price--on-sale', onSale);
        }
      }

      // Stückpreis ist eine Rechnung, keine Behauptung — daher immer erlaubt
      const perUnit = this.querySelector('[data-bundle-unit]');
      if (perUnit) {
        perUnit.textContent = count > 1 ? `${money(Math.round(total / count))} pro Stück` : '';
        perUnit.hidden = count <= 1;
      }

      document.dispatchEvent(
        new CustomEvent('bundle:changed', {
          detail: { sectionId: this.sectionId, total, items, count }
        })
      );
      if (!silent && window.SkinbabeTheme) window.SkinbabeTheme.announce(input.dataset.label || '');
    }
  }
  customElements.define('sb-bundle', SbBundle);

  /* ---------------- <sb-sticky-buy> ---------------------------- */
  class SbStickyBuy extends HTMLElement {
    connectedCallback() {
      this.anchor = document.getElementById(this.dataset.anchor);
      this.priceEl = this.querySelector('[data-sticky-price]');
      if (!this.anchor) return;

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            this.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
          });
        },
        { threshold: 0 }
      );
      io.observe(this.anchor);

      const sync = () => {
        const source = document.getElementById(`price-${this.dataset.section}`);
        if (source && this.priceEl) this.priceEl.innerHTML = source.innerHTML;
      };
      document.addEventListener('variant:changed', sync);
      document.addEventListener('bundle:changed', sync);
    }
  }
  customElements.define('sb-sticky-buy', SbStickyBuy);

  /* ---------------- <sb-builder> -------------------------------
     Set-Konfigurator: pro Schritt eine Auswahl, eine Sammelaktion
     legt alle gewählten Positionen gemeinsam in den Warenkorb.
  --------------------------------------------------------------- */
  class SbBuilder extends HTMLElement {
    connectedCallback() {
      this.steps = $$('[data-builder-step]', this);
      this.totalEl = this.querySelector('[data-builder-total]');
      this.countEl = this.querySelector('[data-builder-count]');
      this.button = this.querySelector('[data-builder-add]');
      this.summaryList = this.querySelector('[data-builder-summary]');
      this.errorEl = this.querySelector('[data-builder-error]');

      this.addEventListener('change', () => this.update());
      this.addEventListener('click', (e) => {
        const card = e.target.closest('[data-builder-card]');
        if (card) {
          const input = card.querySelector('input');
          if (input && !input.checked) { input.checked = true; this.update(); }
        }
      });

      if (this.button) this.button.addEventListener('click', () => this.submit());
      this.update();
    }

    get selection() {
      return this.steps
        .map((step) => {
          const input = step.querySelector('input:checked');
          if (!input) return null;
          return {
            id: Number(input.dataset.variantId),
            quantity: parseInt(input.dataset.quantity, 10) || 1,
            price: parseInt(input.dataset.price, 10) || 0,
            title: input.dataset.title || '',
            stepTitle: step.dataset.stepTitle || '',
            required: step.dataset.required === 'true'
          };
        })
        .filter(Boolean);
    }

    update() {
      const items = this.selection;
      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      $$('[data-builder-card]', this).forEach((card) => {
        const input = card.querySelector('input');
        card.classList.toggle('is-selected', !!(input && input.checked));
      });

      if (this.totalEl) this.totalEl.textContent = money(total);
      if (this.countEl) this.countEl.textContent = items.length;
      if (this.summaryList) {
        this.summaryList.innerHTML = items
          .map(
            (i) =>
              `<li><span>${i.quantity > 1 ? i.quantity + '× ' : ''}${i.title}</span><span>${money(i.price * i.quantity)}</span></li>`
          )
          .join('');
      }

      const missing = this.steps.filter(
        (s) => s.dataset.required === 'true' && !s.querySelector('input:checked')
      );
      if (this.button) {
        this.button.disabled = missing.length > 0 || items.length === 0;
        this.button.toggleAttribute('aria-disabled', this.button.disabled);
      }
      this.classList.toggle('is-ready', missing.length === 0 && items.length > 0);
    }

    async submit() {
      const items = this.selection.map((i) => ({ id: i.id, quantity: i.quantity }));
      if (!items.length) return;

      const label = this.button.querySelector('[data-btn-label]') || this.button;
      const original = label.textContent;
      this.button.setAttribute('aria-disabled', 'true');
      label.textContent = T.strings.adding;
      if (this.errorEl) { this.errorEl.hidden = true; this.errorEl.textContent = ''; }

      try {
        await window.CartStore.add({ items });
        label.textContent = T.strings.added;
        const drawer = document.getElementById('CartDrawer');
        if (drawer && T.cartType === 'drawer') drawer.open(this.button);
      } catch (err) {
        if (this.errorEl) {
          this.errorEl.hidden = false;
          this.errorEl.textContent = (err && err.description) || T.strings.cartError;
        }
      } finally {
        setTimeout(() => {
          label.textContent = original;
          this.button.removeAttribute('aria-disabled');
          this.update();
        }, 900);
      }
    }
  }
  customElements.define('sb-builder', SbBuilder);

  /* ---------------- <sb-compare> — Vorher/Nachher --------------- */
  class SbCompare extends HTMLElement {
    connectedCallback() {
      this.range = this.querySelector('input[type="range"]');
      if (!this.range) return;
      const set = () => this.style.setProperty('--split', `${this.range.value}%`);
      this.range.addEventListener('input', set);
      set();

      // Zeigerbedienung direkt auf dem Bild
      const move = (clientX) => {
        const rect = this.getBoundingClientRect();
        const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
        this.range.value = pct;
        set();
      };
      let dragging = false;
      this.addEventListener('pointerdown', (e) => {
        if (e.target === this.range) return;
        dragging = true;
        this.setPointerCapture(e.pointerId);
        move(e.clientX);
      });
      this.addEventListener('pointermove', (e) => { if (dragging) move(e.clientX); });
      this.addEventListener('pointerup', () => { dragging = false; });
      this.addEventListener('pointercancel', () => { dragging = false; });
    }
  }
  customElements.define('sb-compare', SbCompare);

  /* ---------------- <sb-tabs> ---------------------------------- */
  class SbTabs extends HTMLElement {
    connectedCallback() {
      this.tabs = $$('[role="tab"]', this);
      this.panels = $$('[role="tabpanel"]', this);
      this.tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => this.select(index));
        tab.addEventListener('keydown', (e) => {
          const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          const next = (index + dir + this.tabs.length) % this.tabs.length;
          this.select(next);
          this.tabs[next].focus();
        });
      });
      this.select(0);
    }
    select(index) {
      this.tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.setAttribute('tabindex', i === index ? '0' : '-1');
      });
      this.panels.forEach((panel, i) => { panel.hidden = i !== index; });
    }
  }
  customElements.define('sb-tabs', SbTabs);

  /* ---------------- <sb-count-up> ------------------------------ */
  class SbCountUp extends HTMLElement {
    connectedCallback() {
      const target = parseFloat(this.dataset.value);
      if (!Number.isFinite(target)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const started = performance.now();
          const duration = 900;
          const tick = (now) => {
            const p = Math.min(1, (now - started) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            this.textContent = Math.round(target * eased).toLocaleString('de-DE');
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.4 });
      io.observe(this);
    }
  }
  customElements.define('sb-count-up', SbCountUp);
})();

/* ---------------- <sb-plan> — Kaufplan-Auswahl ---------------- */
(function () {
  'use strict';
  class SbPlan extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.section;
      this.addEventListener('change', (e) => {
        if (!e.target.matches('input[name="selling_plan"]')) return;
        const price = parseInt(e.target.dataset.price, 10);
        const host = document.getElementById(`price-${this.sectionId}`);
        if (!host || !Number.isFinite(price)) return;
        const current = host.querySelector('[data-price-current]');
        if (current && window.SkinbabeTheme) current.textContent = window.SkinbabeTheme.formatMoney(price);
      });
    }
  }
  customElements.define('sb-plan', SbPlan);
})();
