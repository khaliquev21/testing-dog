/* ==========================================================================
   Pawora theme scripts
   Custom elements: <loop-video>, <product-gallery>, <product-form>,
   <cart-drawer>, <header-nav>, <faq-accordion>.
   No dependencies. Everything degrades to normal links and forms without JS.
   ========================================================================== */
(function () {
  'use strict';

  var config = window.Pawora || {};
  var strings = config.strings || {};
  var routes = config.routes || {};

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function define(name, ctor) {
    if (!window.customElements.get(name)) window.customElements.define(name, ctor);
  }

  /* ---------- Cart helpers ---------- */
  var Cart = {
    drawer: function () {
      return document.querySelector('cart-drawer');
    },

    setCount: function (count) {
      var n = parseInt(count, 10);
      if (isNaN(n)) return;
      document.querySelectorAll('[data-cart-count]').forEach(function (el) {
        if (el.tagName === 'CART-DRAWER') return;
        el.textContent = n;
      });
      var label = (strings.cartCount || '').replace('__COUNT__', n);
      document.querySelectorAll('.pw-cart-link').forEach(function (link) {
        if (label) link.setAttribute('aria-label', label);
      });
    },

    request: function (url, options) {
      return fetch(url, options).then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok && !(data && data.status), data: data };
        });
      });
    },

    add: function (formData) {
      formData.append('sections', 'cart-drawer');
      formData.append('sections_url', window.location.pathname);
      return Cart.request(routes.cartAdd, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
        body: formData
      });
    },

    change: function (line, quantity) {
      return Cart.request(routes.cartChange, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          line: line,
          quantity: quantity,
          sections: 'cart-drawer',
          sections_url: window.location.pathname
        })
      });
    },

    refresh: function () {
      var drawer = Cart.drawer();
      if (!drawer) return Promise.resolve();
      var url = (routes.root || '/') + '?sections=cart-drawer';
      return fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (sections) {
          if (sections && sections['cart-drawer']) drawer.render(sections['cart-drawer']);
        })
        .catch(function () {});
    }
  };

  /* ---------- <loop-video>: muted, looping product footage ---------- */
  class LoopVideo extends HTMLElement {
    connectedCallback() {
      this.video = this.querySelector('video');
      this.playButton = this.querySelector('[data-loop-play]');
      this.toggleButton = this.querySelector('[data-loop-toggle]');
      if (!this.video) return;

      this.userPaused = false;
      this.userStarted = false;
      this.inView = false;
      this.setState('paused');

      this.video.addEventListener('playing', this.setState.bind(this, 'playing'));
      this.video.addEventListener('pause', this.setState.bind(this, 'paused'));

      if (this.playButton) {
        this.playButton.addEventListener('click', function () {
          this.userStarted = true;
          this.userPaused = false;
          this.play();
        }.bind(this));
      }

      if (this.toggleButton) {
        this.toggleButton.addEventListener('click', function () {
          if (this.video.paused) {
            this.userStarted = true;
            this.userPaused = false;
            this.play();
          } else {
            this.userPaused = true;
            this.video.pause();
          }
        }.bind(this));
      }

      this.onVisibility = this.sync.bind(this);
      document.addEventListener('visibilitychange', this.onVisibility);

      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(function (entries) {
          this.inView = entries.some(function (entry) { return entry.isIntersecting; });
          this.sync();
        }.bind(this), { rootMargin: '120px' });
        this.observer.observe(this);
      } else {
        this.inView = true;
        this.sync();
      }
    }

    disconnectedCallback() {
      document.removeEventListener('visibilitychange', this.onVisibility);
      if (this.observer) this.observer.disconnect();
    }

    allowAutoplay() {
      if (this.userStarted) return true;
      if (prefersReducedMotion()) return false;
      var gallery = this.closest('product-gallery');
      if (gallery && gallery.dataset.autoplay === 'false') return false;
      return true;
    }

    isActiveSlide() {
      var slide = this.closest('[data-gallery-slide]');
      return !slide || slide.classList.contains('is-active');
    }

    /* Plays only while visible, on the active gallery slide, and not paused by the shopper. */
    sync() {
      if (!this.video) return;
      var shouldPlay = this.inView && this.isActiveSlide() && !document.hidden &&
        !this.userPaused && this.allowAutoplay();
      if (shouldPlay) {
        if (this.video.paused) this.play();
      } else if (!this.video.paused) {
        this.video.pause();
      }
    }

    play() {
      var promise = this.video.play();
      if (promise && promise.catch) {
        promise.catch(function () { this.setState('paused'); }.bind(this));
      }
    }

    setState(state) {
      this.dataset.state = state;
      if (this.toggleButton) {
        this.toggleButton.setAttribute('aria-label', state === 'playing' ? strings.pause : strings.play);
      }
    }
  }
  define('loop-video', LoopVideo);

  /* ---------- <product-gallery> ---------- */
  class ProductGallery extends HTMLElement {
    connectedCallback() {
      this.slides = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-slide]'));
      this.thumbs = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-thumb]'));
      this.counter = this.querySelector('[data-gallery-current]');
      this.thumbsWrap = this.querySelector('.pw-gallery__thumbs');
      this.index = 0;
      if (this.slides.length < 2) return;

      var prev = this.querySelector('[data-gallery-prev]');
      var next = this.querySelector('[data-gallery-next]');
      if (prev) prev.addEventListener('click', function () { this.go(this.index - 1); }.bind(this));
      if (next) next.addEventListener('click', function () { this.go(this.index + 1); }.bind(this));

      this.thumbs.forEach(function (thumb) {
        thumb.addEventListener('click', function () {
          this.go(parseInt(thumb.dataset.index, 10));
        }.bind(this));
      }, this);

      this.addEventListener('keydown', function (event) {
        if (event.target.closest('video, input, select, textarea')) return;
        if (event.key === 'ArrowLeft') { this.go(this.index - 1); event.preventDefault(); }
        if (event.key === 'ArrowRight') { this.go(this.index + 1); event.preventDefault(); }
      }.bind(this));

      var startX = null;
      var stage = this.querySelector('.pw-gallery__stage');
      if (stage) {
        stage.addEventListener('touchstart', function (event) {
          startX = event.touches.length === 1 ? event.touches[0].clientX : null;
        }, { passive: true });
        stage.addEventListener('touchend', function (event) {
          if (startX === null) return;
          var delta = event.changedTouches[0].clientX - startX;
          startX = null;
          if (Math.abs(delta) > 48) this.go(this.index + (delta < 0 ? 1 : -1));
        }.bind(this), { passive: true });
      }

      document.addEventListener('pawora:variant-change', function (event) {
        var mediaId = event.detail && event.detail.mediaId;
        if (!mediaId) return;
        var target = this.slides.findIndex(function (slide) {
          return String(slide.dataset.mediaId) === String(mediaId);
        });
        if (target > -1) this.go(target);
      }.bind(this));
    }

    go(target) {
      var total = this.slides.length;
      var next = ((target % total) + total) % total;
      this.index = next;

      this.slides.forEach(function (slide, i) {
        var active = i === next;
        slide.classList.toggle('is-active', active);
        if (active) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', 'true');
      });

      this.thumbs.forEach(function (thumb, i) {
        var active = i === next;
        thumb.classList.toggle('is-active', active);
        thumb.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      if (this.counter) this.counter.textContent = String(next + 1);

      // Keep the active thumbnail visible in the horizontally scrolling mobile row.
      var thumb = this.thumbs[next];
      if (thumb && this.thumbsWrap && this.thumbsWrap.scrollWidth > this.thumbsWrap.clientWidth) {
        var left = thumb.offsetLeft - (this.thumbsWrap.clientWidth - thumb.offsetWidth) / 2;
        this.thumbsWrap.scrollTo({ left: left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }

      this.querySelectorAll('loop-video').forEach(function (video) { video.sync(); });
    }
  }
  define('product-gallery', ProductGallery);

  /* ---------- <product-form>: quantity, variants, Add to Cart ---------- */
  class ProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (!this.form) return;
      this.input = this.querySelector('[data-qty-input]');
      this.minus = this.querySelector('[data-qty-minus]');
      this.plus = this.querySelector('[data-qty-plus]');
      this.submit = this.querySelector('[data-add-to-cart]');
      this.label = this.querySelector('[data-add-label]');
      this.errorBox = this.querySelector('[data-form-error]');
      this.variantInputs = Array.prototype.slice.call(this.querySelectorAll('[data-variant-input]'));
      this.stockNote = this.querySelector('[data-stock-note]');
      this.section = this.closest('.pw-product');
      this.sticky = document.querySelector('[data-sticky-bar]');
      this.hiddenId = this.querySelector('[data-variant-id]');
      this.max = parseInt(this.dataset.max, 10) || 10;
      this.addPrice = this.querySelector('[data-add-price]');
      this.busy = false;
      this.resetTimer = null;

      var json = this.querySelector('[data-variants-json]');
      this.variants = [];
      if (json) {
        try { this.variants = JSON.parse(json.textContent); } catch (e) { this.variants = []; }
      }
      this.available = !!(this.submit && !this.submit.disabled);

      this.setQty(this.input ? this.input.value : 1);

      if (this.minus) this.minus.addEventListener('click', function () { this.setQty(this.qty() - 1); }.bind(this));
      if (this.plus) this.plus.addEventListener('click', function () { this.setQty(this.qty() + 1); }.bind(this));
      if (this.input) {
        this.input.addEventListener('change', function () { this.setQty(this.input.value); }.bind(this));
        this.input.addEventListener('input', function () {
          this.input.value = this.input.value.replace(/[^0-9]/g, '');
        }.bind(this));
      }
      this.variantInputs.forEach(function (input) {
        input.addEventListener('change', this.onVariantChange.bind(this));
      }, this);
      this.initSticky();
      this.form.addEventListener('submit', this.onSubmit.bind(this));
    }

    qty() {
      return parseInt(this.input.value, 10) || 1;
    }

    /* The variant that is currently selected (checked bundle card, else the hidden id, else the first). */
    currentVariant() {
      var checked = this.variantInputs.filter(function (i) { return i.checked; })[0];
      var id = checked ? checked.value : (this.hiddenId ? this.hiddenId.value : null);
      var found = this.variants.find(function (v) { return String(v.id) === String(id); });
      return found || this.variants[0] || null;
    }

    /* Add to Cart price = the selected variant's Shopify price x the quantity (formatted by Shopify). */
    showTotal(n) {
      var variant = this.currentVariant();
      if (!variant) return;
      var text = variant.totals && variant.totals[n - 1] ? variant.totals[n - 1] : variant.priceFormatted;
      if (this.addPrice) { this.addPrice.textContent = text; this.addPrice.hidden = !variant.available; }
      if (this.sticky) {
        var sp = this.sticky.querySelector('[data-price]');
        if (sp) sp.textContent = text;
      }
    }

    setQty(value) {
      var n = parseInt(value, 10);
      if (isNaN(n) || n < 1) n = 1;
      if (n > this.max) n = this.max;
      if (this.input) this.input.value = n;
      if (this.minus) this.minus.disabled = n <= 1;
      if (this.plus) this.plus.disabled = n >= this.max;
      this.showTotal(n);
      this.resetLabel();
    }

    resetLabel() {
      if (!this.label || this.busy) return;
      window.clearTimeout(this.resetTimer);
      this.label.textContent = this.available ? strings.addToCart : strings.soldOut;
    }

    showError(message) {
      if (!this.errorBox) return;
      this.errorBox.textContent = message || strings.errorAdd;
      this.errorBox.hidden = false;
    }

    clearError() {
      if (this.errorBox) { this.errorBox.hidden = true; this.errorBox.textContent = ''; }
    }

    /* Mobile only: a bar with price + Add to Cart appears once the main button scrolls out of view. */
    initSticky() {
      if (!this.sticky || !this.submit || !('IntersectionObserver' in window)) return;
      var narrow = window.matchMedia('(max-width: 749px)');
      var visible = true;
      var update = function () { this.sticky.hidden = !(narrow.matches && !visible); }.bind(this);
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting || entries[0].boundingClientRect.top > 0;
        update();
      }).observe(this.submit);
      if (narrow.addEventListener) narrow.addEventListener('change', update);
    }

    onVariantChange() {
      var checked = this.variantInputs.filter(function (i) { return i.checked; })[0];
      if (!checked) return;
      this.variantInputs.forEach(function (i) {
        i.closest('.pw-variant').classList.toggle('is-selected', i.checked);
      });
      var id = checked.value;
      var variant = this.variants.find(function (v) { return String(v.id) === String(id); });
      if (!variant) return;

      this.available = variant.available;
      this.max = variant.max || this.max;
      this.submit.disabled = !variant.available;
      if (this.input) this.input.value = 1; // choosing a bundle starts again at one of that bundle
      this.setQty(1);

      if (this.stockNote) {
        this.stockNote.hidden = !variant.stock;
        this.stockNote.textContent = variant.stock ? (strings.lowStock || '').replace('__COUNT__', variant.stock) : '';
      }
      if (this.sticky) {
        var sb = this.sticky.querySelector('[data-sticky-button]');
        if (sb) { sb.disabled = !variant.available; sb.textContent = variant.available ? strings.addToCart : strings.soldOut; }
      }

      var section = this.section;
      if (section) {
        var price = section.querySelector('[data-price]');
        if (price) price.textContent = variant.priceFormatted;
        var compare = section.querySelector('[data-compare-price]');
        if (compare) {
          compare.textContent = variant.compareFormatted;
          compare.hidden = !variant.compareFormatted;
        }
        var save = section.querySelector('[data-save]');
        if (save) {
          save.textContent = variant.saveFormatted;
          save.hidden = !variant.saveFormatted;
        }
      }

      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', id);
        window.history.replaceState({}, '', url.toString());
      }
      document.dispatchEvent(new CustomEvent('pawora:variant-change', { detail: { mediaId: variant.mediaId, id: id } }));
    }

    onSubmit(event) {
      event.preventDefault();
      if (this.busy || !this.available) return;
      this.setQty(this.input ? this.input.value : 1);
      this.clearError();
      this.busy = true;
      this.submit.setAttribute('aria-disabled', 'true');
      this.label.textContent = strings.adding;

      Cart.add(new FormData(this.form)).then(function (result) {
        if (!result.ok) {
          this.showError(result.data && (result.data.description || result.data.message));
          return;
        }
        this.label.textContent = strings.addedToCart;
        var markup = result.data.sections && result.data.sections['cart-drawer'];
        var drawer = Cart.drawer();
        if (config.cartType === 'drawer' && drawer && markup) {
          drawer.render(markup);
          drawer.open(this.submit);
        } else {
          window.location.href = routes.cart;
        }
        this.resetTimer = window.setTimeout(function () { this.busy = false; this.resetLabel(); }.bind(this), 3000);
      }.bind(this)).catch(function () {
        this.showError(strings.errorAdd);
      }.bind(this)).then(function () {
        this.busy = false;
        this.submit.removeAttribute('aria-disabled');
      }.bind(this));
    }
  }
  define('product-form', ProductForm);

  /* ---------- <cart-drawer> ---------- */
  class CartDrawer extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('.pw-drawer__panel');
      this.queue = Promise.resolve();

      this.addEventListener('click', this.onClick.bind(this));
      this.addEventListener('change', this.onChange.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));

      document.addEventListener('click', function (event) {
        var trigger = event.target.closest('[data-cart-open]');
        if (!trigger || config.cartType !== 'drawer') return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
        event.preventDefault();
        this.open(trigger);
      }.bind(this));

      window.addEventListener('pageshow', function (event) {
        if (event.persisted) Cart.refresh();
      });
    }

    open(trigger) {
      this.opener = trigger || document.activeElement;
      this.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      document.body.classList.add('pw-drawer-open');
      window.requestAnimationFrame(function () {
        if (this.panel) this.panel.focus({ preventScroll: true });
      }.bind(this));
    }

    close() {
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('pw-drawer-open');
      if (this.opener && this.opener.focus) this.opener.focus({ preventScroll: true });
    }

    render(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var next = doc.querySelector('cart-drawer');
      if (!next || !this.panel) return;
      var hadFocusInside = this.panel.contains(document.activeElement);
      this.panel.innerHTML = next.querySelector('.pw-drawer__panel').innerHTML;
      this.classList.toggle('is-empty', next.classList.contains('is-empty'));
      this.dataset.cartCount = next.dataset.cartCount;
      Cart.setCount(next.dataset.cartCount);
      if (hadFocusInside && this.classList.contains('is-open')) this.panel.focus({ preventScroll: true });
    }

    showError(message) {
      var box = this.querySelector('[data-cart-error]');
      if (!box) return;
      box.textContent = message || strings.errorCart;
      box.hidden = false;
    }

    update(line, quantity) {
      this.queue = this.queue.then(function () {
        this.classList.add('is-busy');
        return Cart.change(line, quantity).then(function (result) {
          if (!result.ok) {
            this.showError(result.data && (result.data.description || result.data.message));
            return;
          }
          var markup = result.data.sections && result.data.sections['cart-drawer'];
          if (markup) this.render(markup);
          else Cart.refresh();
        }.bind(this)).catch(function () {
          this.showError(strings.errorCart);
        }.bind(this)).then(function () {
          this.classList.remove('is-busy');
        }.bind(this));
      }.bind(this));
      return this.queue;
    }

    lineOf(el) {
      var item = el.closest('[data-line]');
      return item ? { line: parseInt(item.dataset.line, 10), input: item.querySelector('[data-line-input]') } : null;
    }

    onClick(event) {
      if (event.target.closest('[data-drawer-close]')) { this.close(); return; }
      var minus = event.target.closest('[data-line-minus]');
      var plus = event.target.closest('[data-line-plus]');
      var remove = event.target.closest('[data-line-remove]');
      var source = minus || plus || remove;
      if (!source) return;
      var ref = this.lineOf(source);
      if (!ref) return;
      var current = parseInt(ref.input.value, 10) || 0;
      var quantity = remove ? 0 : current + (plus ? 1 : -1);
      this.update(ref.line, Math.max(0, quantity));
    }

    onChange(event) {
      if (!event.target.matches('[data-line-input]')) return;
      var ref = this.lineOf(event.target);
      if (!ref) return;
      var quantity = parseInt(event.target.value, 10);
      this.update(ref.line, isNaN(quantity) ? 1 : Math.max(0, quantity));
    }

    onKeydown(event) {
      if (event.key === 'Escape') { this.close(); return; }
      if (event.key !== 'Tab' || !this.classList.contains('is-open')) return;
      var focusable = Array.prototype.slice.call(this.panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(function (el) { return el.offsetParent !== null; });
      if (!focusable.length) { event.preventDefault(); this.panel.focus(); return; }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === this.panel)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  }
  define('cart-drawer', CartDrawer);

  /* ---------- <header-nav>: mobile menu and search ---------- */
  class HeaderNav extends HTMLElement {
    connectedCallback() {
      this.menuButton = this.querySelector('[data-menu-toggle]');
      this.menu = this.querySelector('.pw-nav--mobile');
      this.searchButton = this.querySelector('[data-search-toggle]');
      this.search = this.querySelector('.pw-search');

      if (this.menuButton && this.menu) {
        this.menuButton.addEventListener('click', function () {
          this.toggleMenu(this.menu.hidden);
        }.bind(this));
        this.menu.addEventListener('click', function (event) {
          if (event.target.closest('a')) this.toggleMenu(false);
        }.bind(this));
      }

      if (this.searchButton && this.search) {
        this.searchButton.addEventListener('click', function () {
          this.toggleSearch(this.search.hidden);
        }.bind(this));
      }

      this.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        this.toggleMenu(false);
        this.toggleSearch(false);
      }.bind(this));

      window.addEventListener('resize', function () {
        if (window.innerWidth > 989) this.toggleMenu(false);
      }.bind(this));
    }

    toggleMenu(open) {
      if (!this.menu || !this.menuButton) return;
      this.menu.hidden = !open;
      this.menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      this.menuButton.setAttribute('aria-label',
        open ? this.menuButton.dataset.labelClose : this.menuButton.dataset.labelOpen);
    }

    toggleSearch(open) {
      if (!this.search || !this.searchButton) return;
      this.search.hidden = !open;
      this.searchButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var input = this.search.querySelector('input[type="search"]');
        if (input) input.focus();
      }
    }
  }
  define('header-nav', HeaderNav);

  /* ---------- <info-accordion>: Shipping / Returns / Support rows ---------- */
  class InfoAccordion extends HTMLElement {
    connectedCallback() {
      this.items = Array.prototype.slice.call(this.querySelectorAll('[data-acc]'));
      this.items.forEach(function (item) {
        var panel = item.querySelector('[data-acc-panel]');
        if (panel) panel.inert = true;
      });
      this.addEventListener('click', function (event) {
        var trigger = event.target.closest('[data-acc-trigger]');
        if (!trigger) return;
        this.toggle(trigger.closest('[data-acc]'));
      }.bind(this));
      this.addEventListener('keydown', function (event) {
        var trigger = event.target.closest('[data-acc-trigger]');
        if (!trigger) return;
        var triggers = this.items.map(function (i) { return i.querySelector('[data-acc-trigger]'); });
        var index = triggers.indexOf(trigger);
        var next = null;
        if (event.key === 'ArrowDown') next = triggers[(index + 1) % triggers.length];
        else if (event.key === 'ArrowUp') next = triggers[(index - 1 + triggers.length) % triggers.length];
        else if (event.key === 'Home') next = triggers[0];
        else if (event.key === 'End') next = triggers[triggers.length - 1];
        if (next) { event.preventDefault(); next.focus(); }
      }.bind(this));
    }

    toggle(item) {
      var trigger = item.querySelector('[data-acc-trigger]');
      var panel = item.querySelector('[data-acc-panel]');
      var open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      item.classList.toggle('is-open', open);
      panel.inert = !open;
    }
  }
  define('info-accordion', InfoAccordion);

  /* ---------- <review-rotator>: two genuine reviews, calm crossfade every 10 s ---------- */
  class ReviewRotator extends HTMLElement {
    connectedCallback() {
      if (this.ready) return; // never attach twice
      this.items = Array.prototype.slice.call(this.querySelectorAll('[data-review]'));
      this.dots = Array.prototype.slice.call(this.querySelectorAll('[data-review-dot]'));
      this.stage = this.querySelector('[data-review-stage]');
      this.timer = null;
      this.hovering = false;
      this.focused = false;
      this.inView = true;
      this.interval = parseInt(this.dataset.interval, 10) || 10000;
      if (this.items.length < 2) return; // one review: nothing to rotate

      // Keep whichever review the page is currently showing (matters if the element is moved or re-added).
      var shown = this.items.findIndex(function (item) { return item.classList.contains('is-active'); });
      this.index = shown > -1 ? shown : 0;
      this.ready = true;
      this.reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

      // One delegated click handler covers previous, next and the dots.
      this.onClick = function (event) {
        var dot = event.target.closest('[data-review-dot]');
        if (dot) { this.go(parseInt(dot.dataset.index, 10), true); return; }
        if (event.target.closest('[data-review-next]')) { this.go(this.index + 1, true); return; }
        if (event.target.closest('[data-review-prev]')) { this.go(this.index - 1, true); }
      }.bind(this);
      this.onEnter = function () { this.hovering = true; this.stop(); }.bind(this);
      this.onLeave = function () { this.hovering = false; this.start(); }.bind(this);
      this.onFocusIn = function () { this.focused = true; this.stop(); }.bind(this);
      this.onFocusOut = function (event) {
        if (event.relatedTarget && this.contains(event.relatedTarget)) return;
        this.focused = false;
        this.start();
      }.bind(this);
      this.onVisibility = function () { if (document.hidden) this.stop(); else this.start(); }.bind(this);
      this.onReduced = function () { if (this.reduced()) this.stop(); else this.start(); }.bind(this);

      this.addEventListener('click', this.onClick);
      this.addEventListener('mouseenter', this.onEnter);
      this.addEventListener('mouseleave', this.onLeave);
      this.addEventListener('focusin', this.onFocusIn);
      this.addEventListener('focusout', this.onFocusOut);
      document.addEventListener('visibilitychange', this.onVisibility);
      if (this.reducedQuery && this.reducedQuery.addEventListener) this.reducedQuery.addEventListener('change', this.onReduced);

      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(function (entries) {
          this.inView = entries.some(function (e) { return e.isIntersecting; });
          if (this.inView) this.start(); else this.stop();
        }.bind(this));
        this.observer.observe(this);
      }
      this.start();
    }

    /* Removes every timer and listener this element created. */
    disconnectedCallback() {
      this.stop();
      if (!this.ready) return;
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('mouseenter', this.onEnter);
      this.removeEventListener('mouseleave', this.onLeave);
      this.removeEventListener('focusin', this.onFocusIn);
      this.removeEventListener('focusout', this.onFocusOut);
      document.removeEventListener('visibilitychange', this.onVisibility);
      if (this.reducedQuery && this.reducedQuery.removeEventListener) this.reducedQuery.removeEventListener('change', this.onReduced);
      if (this.observer) { this.observer.disconnect(); this.observer = null; }
      this.ready = false;
    }

    reduced() { return !!(this.reducedQuery && this.reducedQuery.matches); }

    /* Always clears first, so there can never be two timers. */
    start() {
      this.stop();
      if (!this.ready || document.hidden || this.hovering || this.focused || !this.inView || this.reduced()) return;
      this.timer = window.setTimeout(function () {
        this.timer = null;
        this.go(this.index + 1, false);
      }.bind(this), this.interval);
    }

    stop() {
      if (this.timer) { window.clearTimeout(this.timer); this.timer = null; }
    }

    go(target, manual) {
      var total = this.items.length;
      this.index = ((target % total) + total) % total;
      this.items.forEach(function (item, i) {
        var active = i === this.index;
        item.classList.toggle('is-active', active);
        if (active) item.removeAttribute('aria-hidden'); else item.setAttribute('aria-hidden', 'true');
      }, this);
      this.dots.forEach(function (dot, i) {
        var active = i === this.index;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
      }, this);
      // Announce only when the shopper changed it themselves, never on automatic changes.
      if (this.stage) this.stage.setAttribute('aria-live', manual ? 'polite' : 'off');
      this.start(); // fresh full interval after any change (manual changes reset the clock)
    }
  }
  define('review-rotator', ReviewRotator);

  /* ---------- <faq-accordion>: one question open at a time ---------- */
  class FaqAccordion extends HTMLElement {
    connectedCallback() {
      this.addEventListener('toggle', function (event) {
        var opened = event.target;
        if (!opened.open) return;
        this.querySelectorAll('details[open]').forEach(function (item) {
          if (item !== opened) item.open = false;
        });
      }.bind(this), true);
    }
  }
  define('faq-accordion', FaqAccordion);
})();
