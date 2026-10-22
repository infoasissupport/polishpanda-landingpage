/* =============================================================
   POLISH PANDA — Car Care Studio
   Modular vanilla JS (no dependencies). Each module is
   self-contained and initialised from App.init() at the bottom.
   ============================================================= */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth <= 680;

  /* Shared scroll loop: modules register callbacks, one rAF per frame */
  const ScrollLoop = (() => {
    const callbacks = [];
    let ticking = false;
    const run = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      callbacks.forEach((cb) => cb(y, vh));
      ticking = false;
    };
    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(run);
      }
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return {
      add(cb) { callbacks.push(cb); request(); },
      refresh: request,
    };
  })();

  /* Body scroll lock (shared by menu + modals) */
  const ScrollLock = (() => {
    let locks = 0;
    return {
      lock() { locks += 1; document.body.classList.add('is-locked'); },
      unlock() {
        locks = Math.max(0, locks - 1);
        if (!locks) document.body.classList.remove('is-locked');
      },
    };
  })();

  /* Focus trap helper for dialogs */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* -----------------------------------------------------------
     Page ready (no preloader): start entrance animations at once
     ----------------------------------------------------------- */
  const Ready = {
    init() {
      requestAnimationFrame(() => document.body.classList.add('is-ready'));
      document.dispatchEvent(new CustomEvent('app:ready'));
    },
  };

  /* -----------------------------------------------------------
     Smooth anchor scrolling (offset for the fixed navbar)
     ----------------------------------------------------------- */
  const SmoothScroll = {
    init() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        const id = link.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        // Let the mobile menu close first so the scroll isn't blocked
        const delay = document.body.classList.contains('is-locked') ? 380 : 0;
        setTimeout(() => this.to(target), delay);
        history.replaceState(null, '', id);
      });
    },
    to(target) {
      const navH = window.innerWidth <= 680 ? 76 : 92;   // floating header bar + logo cradle
      const top = target.id === 'home' ? 0 : target.getBoundingClientRect().top + window.scrollY - navH + 1;
      window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
    },
  };

  /* -----------------------------------------------------------
     Navbar: fixed header, scrolled state, scrollspy
     ----------------------------------------------------------- */
  const Nav = {
    init() {
      this.nav = $('#nav');
      this.links = $$('.nav__link');
      this.mobileLinks = $$('.mmenu__links a');
      this.indicator = $('.nav__indicator');
      this.toTop = $('#toTop');
      this.social = $('.hero__social');
      this.testimonials = $('#testimonials');
      this.sections = $$('main > section[id]');
      this.activeId = 'home';

      ScrollLoop.add((y, vh) => this.onScroll(y, vh));
      window.addEventListener('resize', () => this.moveIndicator());
      document.addEventListener('app:ready', () => setTimeout(() => this.moveIndicator(), 300));
      if (document.fonts) document.fonts.ready.then(() => this.moveIndicator());

      this.toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }));
    },

    onScroll(y, vh) {
      // Header stays fixed at the top; it only gains a solid background once scrolled
      this.nav.classList.toggle('is-scrolled', y > 40);
      this.toTop.classList.toggle('is-visible', y > vh * 0.8);

      // Side social bar: hide from the Testimonials section downwards (the footer has its own icons)
      if (this.social && this.testimonials) {
        this.social.classList.toggle('is-away', this.testimonials.getBoundingClientRect().top <= vh * 0.6);
      }

      // Scrollspy: the last section whose top passed 35% of the viewport
      let current = this.sections[0].id;
      this.sections.forEach((sec) => {
        if (sec.getBoundingClientRect().top <= vh * 0.35) current = sec.id;
      });
      if (current === 'why') current = 'services';
      if (current === 'testimonials') current = 'process';
      if (current !== this.activeId) {
        this.activeId = current;
        this.setActive(current);
      }
    },

    setActive(id) {
      [...this.links, ...this.mobileLinks].forEach((a) => {
        a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`);
      });
      this.moveIndicator();
    },

    moveIndicator() {
      const active = this.links.find((a) => a.classList.contains('is-active'));
      if (!active || !this.indicator) return;
      const w = 22;
      const x = active.offsetLeft + active.offsetWidth / 2 - w / 2;
      this.indicator.style.width = `${w}px`;
      this.indicator.style.transform = `translateX(${x}px)`;
      this.indicator.classList.add('is-ready');
    },
  };

  /* -----------------------------------------------------------
     Mobile menu
     ----------------------------------------------------------- */
  const MobileMenu = {
    init() {
      this.menu = $('#mobileMenu');
      this.burger = $('#burger');
      this.panel = $('.mmenu__panel', this.menu);
      this.isOpen = false;

      this.burger.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
      $$('[data-close-menu]', this.menu).forEach((el) => el.addEventListener('click', () => this.close()));
      this.menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
        trapFocus(this.panel, e);
      });
      window.addEventListener('resize', () => {
        if (window.innerWidth >= 1240 && this.isOpen) this.close();
      });
    },
    open() {
      this.isOpen = true;
      this.menu.classList.add('is-open');
      this.menu.setAttribute('aria-hidden', 'false');
      this.burger.classList.add('is-open');
      this.burger.setAttribute('aria-expanded', 'true');
      this.burger.setAttribute('aria-label', 'Close menu');
      ScrollLock.lock();
      setTimeout(() => $('.mmenu__close', this.menu).focus({ preventScroll: true }), 350);
    },
    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.menu.classList.remove('is-open');
      this.menu.setAttribute('aria-hidden', 'true');
      this.burger.classList.remove('is-open');
      this.burger.setAttribute('aria-expanded', 'false');
      this.burger.setAttribute('aria-label', 'Open menu');
      ScrollLock.unlock();
      this.burger.focus({ preventScroll: true });
    },
  };

  /* -----------------------------------------------------------
     Hero background media (image OR silent looping video)
     ----------------------------------------------------------- */
  const HeroMedia = {
    init() {
      this.hero = $('.hero');
      this.video = $('#heroVideo');

      if (this.hero.dataset.heroMedia !== 'video' || !this.video) {
        if (this.video) this.video.remove();
        this.video = null;
        return;
      }
      // Users who prefer reduced motion get the still poster image
      if (reducedMotion) {
        this.video.remove();
        this.video = null;
        return;
      }

      const source = $('source', this.video);
      const fail = () => this.hero.classList.add('is-video-failed');
      if (source) source.addEventListener('error', fail);
      this.video.addEventListener('error', fail);
      this.video.addEventListener('playing', () => this.hero.classList.add('is-video-ready'));
      this.video.addEventListener('loadeddata', () => this.hero.classList.add('is-video-ready'));

      // Pause when hero is off-screen to save battery/CPU
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !this.modalOpen) this.play();
        else if (!entry.isIntersecting) this.video.pause();
      }, { threshold: 0.1 }).observe(this.hero);

      this.video.preload = 'auto';
      this.play();
    },
    play() {
      const p = this.video.play();
      if (p && p.catch) p.catch(() => {});
    },
    pauseForModal() {
      this.modalOpen = true;
      if (this.video) this.video.pause();
    },
    resumeFromModal() {
      this.modalOpen = false;
      if (this.video && this.hero.getBoundingClientRect().bottom > 0) this.play();
    },
  };

  /* -----------------------------------------------------------
     Scroll reveal + staggering
     ----------------------------------------------------------- */
  const Reveal = {
    init() {
      $$('[data-stagger]').forEach((group) => {
        $$('[data-reveal]', group).forEach((el, i) => {
          if (!el.style.getPropertyValue('--rd')) el.style.setProperty('--rd', `${i * 0.1}s`);
        });
      });

      const items = $$('[data-reveal]');
      if (reducedMotion || !('IntersectionObserver' in window)) {
        items.forEach((el) => el.classList.add('is-visible', 'reveal-done'));
        return;
      }

      // Clip reveals start with zero visible area, which never "intersects",
      // so those are observed through their parent element instead.
      const targets = new Map();
      items.forEach((el) => {
        const watch = el.dataset.reveal.startsWith('clip') ? el.parentElement : el;
        if (!targets.has(watch)) targets.set(watch, []);
        targets.get(watch).push(el);
      });

      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          targets.get(entry.target).forEach((el) => {
            el.classList.add('is-visible');
            // Drop the stagger delay afterwards so hover effects respond instantly
            setTimeout(() => el.classList.add('reveal-done'), 1600);
          });
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

      // Start observing once the page is ready
      document.addEventListener('app:ready', () => targets.forEach((_, watch) => io.observe(watch)), { once: true });
    },
  };

  /* -----------------------------------------------------------
     Animated counters
     ----------------------------------------------------------- */
  const Counters = {
    init() {
      const els = $$('[data-count]');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          this.animate(entry.target);
          io.unobserve(entry.target);
        });
      }, { threshold: 0.6 });
      els.forEach((el) => io.observe(el));
    },
    animate(el) {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      if (reducedMotion) {
        el.textContent = target.toFixed(decimals);
        return;
      }
      const duration = 1800;
      const start = performance.now();
      const step = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        el.textContent = (target * eased).toFixed(decimals);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
  };

  /* -----------------------------------------------------------
     Subtle parallax
     ----------------------------------------------------------- */
  const Parallax = {
    init() {
      if (reducedMotion) return;
      this.items = $$('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0 }));
      ScrollLoop.add((y, vh) => this.update(y, vh));
    },
    update(y, vh) {
      const factor = isMobile() ? 0.5 : 1;
      this.items.forEach(({ el, speed }) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const offset = (rect.top + rect.height / 2 - vh / 2) * speed * factor;
        el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
      });
    },
  };

  /* -----------------------------------------------------------
     Sheet-rise section transition (app-style bottom sheets)
     ----------------------------------------------------------- */
  const SheetRise = {
    init() {
      if (reducedMotion) return;
      this.sheets = $$('.sheet');
      ScrollLoop.add((y, vh) => this.update(vh));
    },
    update(vh) {
      this.sheets.forEach((sheet) => {
        const top = sheet.getBoundingClientRect().top;
        // 0 when the section's top touches the viewport bottom, 1 at 45% height
        const p = clamp((vh - top) / (vh * 0.55), 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        sheet.style.setProperty('--sheet', eased.toFixed(3));
        sheet.classList.toggle('is-animating', p > 0 && p < 1);
      });
    },
  };

  /* -----------------------------------------------------------
     Carousel (scroll-snap based: native touch swipe + arrows,
     mouse drag, dots/progress, keyboard, optional autoplay)
     ----------------------------------------------------------- */
  class Carousel {
    constructor(root) {
      this.root = root;
      this.name = root.dataset.carousel;
      this.track = $('.carousel__track', root);
      this.dotsWrap = $('.carousel__dots', root);
      this.bar = $('.carousel__progress span', root);
      this.prevBtns = $$(`[data-carousel-prev="${this.name}"]`);
      this.nextBtns = $$(`[data-carousel-next="${this.name}"]`);
      this.autoplay = parseInt(root.dataset.autoplay || '0', 10);

      this.prevBtns.forEach((b) => b.addEventListener('click', () => this.go(-1)));
      this.nextBtns.forEach((b) => b.addEventListener('click', () => this.go(1)));
      this.track.addEventListener('scroll', () => this.onScroll(), { passive: true });
      this.track.addEventListener('keydown', (e) => {
        if (e.target !== this.track) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.go(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(-1); }
      });
      window.addEventListener('resize', () => this.refresh());

      this.enableMouseDrag();
      if (this.autoplay && !reducedMotion) this.setupAutoplay();
      this.refresh();
    }

    get items() {
      return Array.from(this.track.children).filter((el) => !el.classList.contains('is-hidden'));
    }

    get step() {
      const items = this.items;
      if (items.length < 2) return this.track.clientWidth;
      return items[1].offsetLeft - items[0].offsetLeft;
    }

    get maxScroll() {
      return this.track.scrollWidth - this.track.clientWidth;
    }

    get index() {
      return Math.round(this.track.scrollLeft / this.step);
    }

    get pageCount() {
      const perView = Math.max(1, Math.floor((this.track.clientWidth + 4) / this.step));
      return Math.max(1, this.items.length - perView + 1);
    }

    go(dir) {
      const atEnd = this.track.scrollLeft >= this.maxScroll - 4;
      const atStart = this.track.scrollLeft <= 4;
      let left;
      if (dir > 0 && atEnd) left = 0; // loop back to start
      else if (dir < 0 && atStart) left = this.maxScroll; // loop to end
      else left = (this.index + dir) * this.step;
      this.scrollTo(left);
    }

    goTo(i) {
      this.scrollTo(i * this.step);
    }

    scrollTo(left) {
      this.track.scrollTo({ left: clamp(left, 0, this.maxScroll), behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    refresh() {
      if (this.dotsWrap) {
        const count = this.pageCount;
        if (this.dotsWrap.children.length !== count) {
          this.dotsWrap.innerHTML = '';
          for (let i = 0; i < count; i += 1) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.tabIndex = -1;
            dot.addEventListener('click', () => this.goTo(i));
            this.dotsWrap.appendChild(dot);
          }
        }
      }
      const noScroll = this.maxScroll <= 4;
      [...this.prevBtns, ...this.nextBtns].forEach((b) => { b.disabled = noScroll; });
      this.onScroll();
    }

    onScroll() {
      const { scrollLeft, scrollWidth, clientWidth } = this.track;
      if (this.bar) {
        const ratio = scrollWidth ? clientWidth / scrollWidth : 1;
        this.bar.style.setProperty('--thumb', `${ratio * 100}%`);
        this.bar.style.setProperty('--offset', `${clientWidth ? (scrollLeft / clientWidth) * 100 : 0}%`);
      }
      if (this.dotsWrap) {
        const active = scrollLeft >= this.maxScroll - 4 ? this.dotsWrap.children.length - 1 : this.index;
        Array.from(this.dotsWrap.children).forEach((d, i) => d.classList.toggle('is-active', i === active));
      }
    }

    enableMouseDrag() {
      let startX = 0;
      let startScroll = 0;
      let dragging = false;
      let moved = false;

      this.track.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (e.target.closest('button, a, input, select, .compare')) return;
        dragging = true;
        moved = false;
        startX = e.clientX;
        startScroll = this.track.scrollLeft;
      });

      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 6) {
          moved = true;
          this.track.classList.add('is-dragging');
        }
        if (moved) this.track.scrollLeft = startScroll - dx;
      });

      window.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        if (!moved) return;
        // Snap to the nearest card in the drag direction
        const raw = this.track.scrollLeft / this.step;
        const target = this.track.scrollLeft > startScroll ? Math.ceil(raw - 0.15) : Math.floor(raw + 0.15);
        this.track.classList.remove('is-dragging');
        this.goTo(target);
      });

      // Block the click that ends a drag
      this.track.addEventListener('click', (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      }, true);
    }

    setupAutoplay() {
      let timer = null;
      let visible = false;
      let hovering = false;
      const start = () => {
        stop();
        if (visible && !hovering) timer = setInterval(() => this.go(1), this.autoplay);
      };
      const stop = () => { clearInterval(timer); timer = null; };

      this.root.addEventListener('mouseenter', () => { hovering = true; stop(); });
      this.root.addEventListener('mouseleave', () => { hovering = false; start(); });
      this.root.addEventListener('focusin', () => { hovering = true; stop(); });
      this.root.addEventListener('focusout', () => { hovering = false; start(); });
      this.track.addEventListener('touchstart', () => { stop(); setTimeout(start, 8000); }, { passive: true });
      [...this.prevBtns, ...this.nextBtns].forEach((b) => b.addEventListener('click', start));

      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0.3 }).observe(this.root);
    }
  }

  const Carousels = {
    instances: {},
    init() {
      $$('[data-carousel]').forEach((root) => {
        this.instances[root.dataset.carousel] = new Carousel(root);
      });
    },
  };

  /* -----------------------------------------------------------
     Services category filter
     ----------------------------------------------------------- */
  const ServiceFilter = {
    init() {
      const chips = $$('.chip[data-filter]');
      const cards = $$('.service-card');
      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          const filter = chip.dataset.filter;
          chips.forEach((c) => {
            const on = c === chip;
            c.classList.toggle('is-active', on);
            c.setAttribute('aria-selected', String(on));
          });
          let i = 0;
          cards.forEach((card) => {
            const show = filter === 'all' || card.dataset.category === filter;
            card.classList.toggle('is-hidden', !show);
            card.classList.remove('is-entering');
            if (show) {
              card.style.setProperty('--i', i);
              i += 1;
              void card.offsetWidth; // restart animation
              card.classList.add('is-entering');
            }
          });
          const carousel = Carousels.instances.services;
          if (carousel) {
            carousel.track.scrollLeft = 0;
            carousel.refresh();
          }
        });
      });
    },
  };

  /* -----------------------------------------------------------
     Before / After compare sliders + gallery lightbox
     ----------------------------------------------------------- */
  /*
   * Builds a before/after slider inside `el`. Both images are stacked at the
   * same size, and the BEFORE layer is clipped at --pos, so dragging reveals the
   * matching part of the same photo. Paths come from the card's data attributes,
   * so images can be swapped without touching this code.
   */
  function buildCompare(el, { before, after, title, expandable = false }) {
    el.innerHTML = `
      <img class="compare__after" src="${after}" alt="${title}: after" loading="lazy" draggable="false">
      <div class="compare__before"><img src="${before}" alt="${title}: before" loading="lazy" draggable="false"></div>
      <span class="compare__label compare__label--before">Before</span>
      <span class="compare__label compare__label--after">After</span>
      <span class="compare__divider" aria-hidden="true"></span>
      <div class="compare__handle" role="slider" tabindex="0" aria-label="Before and after comparison for ${title}"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
        <svg class="icon"><use href="#i-handle"/></svg>
      </div>
      ${expandable ? '<button class="compare__expand" type="button" aria-label="View full screen"><svg class="icon"><use href="#i-expand"/></svg></button>' : ''}
    `;
    const handle = $('.compare__handle', el);
    let pos = 50;
    let target = 50;
    let raf = null;
    let dragging = false;

    const render = () => {
      el.style.setProperty('--pos', `${pos}%`);
      // Fade each label out as the divider slides over it
      el.style.setProperty('--label-before', clamp((pos - 8) / 22, 0, 1).toFixed(2));
      el.style.setProperty('--label-after', clamp((92 - pos) / 22, 0, 1).toFixed(2));
      handle.setAttribute('aria-valuenow', Math.round(pos));
    };

    // Ease the divider towards the target for a smooth, weighted feel
    const animate = () => {
      pos += (target - pos) * 0.32;
      if (Math.abs(target - pos) < 0.05) {
        pos = target;
        raf = null;
        render();
        return;
      }
      render();
      raf = requestAnimationFrame(animate);
    };

    const moveTo = (value, instant = false) => {
      target = clamp(value, 0, 100);
      if (instant || reducedMotion) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        pos = target;
        render();
      } else if (!raf) {
        raf = requestAnimationFrame(animate);
      }
    };

    const fromEvent = (e) => {
      const rect = el.getBoundingClientRect();
      return ((e.clientX - rect.left) / rect.width) * 100;
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.compare__expand')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'mouse') e.preventDefault(); // no text/image selection
      e.stopPropagation(); // don't start a carousel drag
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      moveTo(fromEvent(e));
    });
    el.addEventListener('pointermove', (e) => {
      if (dragging) moveTo(fromEvent(e));
    });
    const end = () => {
      dragging = false;
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end); // e.g. the browser took over for a vertical scroll
    el.addEventListener('dragstart', (e) => e.preventDefault());

    handle.addEventListener('keydown', (e) => {
      const stepSize = e.shiftKey ? 10 : 4;
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveTo(target - stepSize); }
      if (e.key === 'ArrowRight') { e.preventDefault(); moveTo(target + stepSize); }
      if (e.key === 'Home') { e.preventDefault(); moveTo(0); }
      if (e.key === 'End') { e.preventDefault(); moveTo(100); }
    });

    moveTo(50, true);
    return {
      set: moveTo,
      // Gentle "peek" animation to hint the slider is interactive
      hint() {
        if (reducedMotion) return;
        const start = performance.now();
        const dur = 1600;
        const frame = (now) => {
          if (dragging) return;
          const t = clamp((now - start) / dur, 0, 1);
          moveTo(50 + Math.sin(t * Math.PI * 2) * 20 * (1 - t), true);
          if (t < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      },
    };
  }

  const Gallery = {
    init() {
      this.cards = $$('.ba-card');
      this.items = this.cards.map((card) => ({
        before: card.dataset.before,
        after: card.dataset.after,
        title: card.dataset.title,
      }));

      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target._compare.hint();
          io.unobserve(entry.target);
        });
      }, { threshold: 0.7 });

      this.cards.forEach((card, i) => {
        const compareEl = $('.compare', card);
        compareEl._compare = buildCompare(compareEl, { ...this.items[i], expandable: true });
        $('.compare__expand', compareEl).addEventListener('click', () => this.open(i));
        io.observe(compareEl);
      });

      this.lbCompare = $('#lightboxCompare');
      this.lbTitle = $('#lbTitle');
      this.lbCount = $('#lbCount');
      $('#lbPrev').addEventListener('click', () => this.show(this.index - 1));
      $('#lbNext').addEventListener('click', () => this.show(this.index + 1));
      $('#lightbox').addEventListener('keydown', (e) => {
        if (e.target.closest('.compare__handle')) return;
        if (e.key === 'ArrowLeft') this.show(this.index - 1);
        if (e.key === 'ArrowRight') this.show(this.index + 1);
      });
    },
    open(i) {
      this.show(i);
      Modals.open('lightbox');
    },
    show(i) {
      const n = this.items.length;
      this.index = (i + n) % n;
      const item = this.items[this.index];
      // Fresh node each time so old drag listeners don't pile up
      const fresh = this.lbCompare.cloneNode(false);
      this.lbCompare.replaceWith(fresh);
      this.lbCompare = fresh;
      buildCompare(this.lbCompare, item);
      this.lbTitle.textContent = item.title;
      this.lbCount.textContent = `${this.index + 1} / ${n}`;
    },
  };

  /* -----------------------------------------------------------
     Modals (booking, video, lightbox)
     ----------------------------------------------------------- */
  const Modals = {
    current: null,
    lastFocus: null,
    init() {
      $$('.modal').forEach((modal) => {
        $$('[data-close-modal]', modal).forEach((el) => el.addEventListener('click', () => this.close()));
        modal.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') this.close();
          trapFocus($('.modal__dialog', modal), e);
        });
      });

      document.addEventListener('click', (e) => {
        const bookingBtn = e.target.closest('[data-open-booking]');
        if (bookingBtn) {
          e.preventDefault();
          const delay = bookingBtn.closest('.mmenu') ? 420 : 0;
          setTimeout(() => Booking.open(bookingBtn.dataset.service), delay);
          return;
        }
        if (e.target.closest('[data-open-video]')) {
          e.preventDefault();
          this.open('videoModal');
        }
      });
    },
    open(id) {
      if (this.current) this.close(true);
      const modal = document.getElementById(id);
      this.current = modal;
      this.lastFocus = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      ScrollLock.lock();
      HeroMedia.pauseForModal();

      if (id === 'videoModal') {
        const v = $('#modalVideo');
        v.currentTime = 0;
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      }
      setTimeout(() => {
        const focusEl = $('input, .modal__close', modal);
        if (focusEl) focusEl.focus({ preventScroll: true });
      }, 300);
    },
    close(silent = false) {
      const modal = this.current;
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      this.current = null;
      ScrollLock.unlock();
      if (modal.id === 'videoModal') $('#modalVideo').pause();
      if (modal.id === 'bookingModal') Booking.onClose();
      if (!silent) {
        HeroMedia.resumeFromModal();
        if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus({ preventScroll: true });
      }
    },
  };

  /* -----------------------------------------------------------
     Booking form (validation + submit to endpoint or email)
     ----------------------------------------------------------- */
  const Booking = {
    init() {
      this.form = $('#bookingForm');
      this.formWrap = $('#bookingFormWrap');
      this.success = $('#bookingSuccess');
      this.summary = $('#bookingSummary');
      this.successText = $('#bookingSuccessText');
      this.status = $('#bookingStatus');
      this.serviceSelect = $('#bookingService');
      this.dateInput = $('#bookingDate');

      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      this.dateInput.min = today.toISOString().split('T')[0];

      this.form.addEventListener('submit', (e) => this.submit(e));
      this.form.addEventListener('input', (e) => this.validateField(e.target, true));
      this.form.addEventListener('change', (e) => this.validateField(e.target, true));
    },

    open(service) {
      if (this.success.hidden === false) this.reset();
      if (service) {
        const match = Array.from(this.serviceSelect.options).find((o) => o.text === service);
        if (match) this.serviceSelect.value = match.value || match.text;
      }
      Modals.open('bookingModal');
    },

    onClose() {
      if (!this.success.hidden) setTimeout(() => this.reset(), 400);
    },

    reset() {
      this.form.reset();
      $$('.field', this.form).forEach((f) => f.classList.remove('is-invalid'));
      this.status.textContent = '';
      this.success.hidden = true;
      this.formWrap.hidden = false;
    },

    validateField(input, onlyClear = false) {
      const field = input.closest('.field');
      if (!field) return true;
      let valid = input.checkValidity();
      if (valid && input.name === 'date' && input.value) valid = input.value >= this.dateInput.min;
      if (valid) field.classList.remove('is-invalid');
      else if (!onlyClear) field.classList.add('is-invalid');
      return valid;
    },

    async submit(e) {
      e.preventDefault();
      const fields = $$('input, select, textarea', this.form);
      const results = fields.map((f) => this.validateField(f));
      if (results.includes(false)) {
        const firstInvalid = $('.field.is-invalid input, .field.is-invalid select', this.form);
        if (firstInvalid) firstInvalid.focus();
        this.status.textContent = 'Please complete the highlighted fields.';
        return;
      }
      this.status.textContent = '';

      const data = Object.fromEntries(new FormData(this.form).entries());
      data.reference = `PP-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const btn = $('button[type="submit"]', this.form);
      const label = $('.btn__label', btn);
      btn.classList.add('is-loading');
      label.textContent = 'Sending…';

      const endpoint = this.form.dataset.endpoint;
      let message;
      try {
        if (endpoint) {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          message = `Thanks ${data.name.split(' ')[0]}! We'll call you on ${data.phone} to confirm your slot.`;
        } else {
          this.sendViaEmail(data);
          message = `Your email app has opened with the booking details. Send it and we'll confirm your slot by phone on ${data.phone}.`;
        }
      } catch (err) {
        this.status.textContent = 'Something went wrong. Please try again or call us on +1 (555) 014-2290.';
        btn.classList.remove('is-loading');
        label.textContent = 'Confirm Booking';
        return;
      }

      btn.classList.remove('is-loading');
      label.textContent = 'Confirm Booking';
      this.showSuccess(data, message);
    },

    sendViaEmail(data) {
      const to = this.form.dataset.email;
      const subject = `Booking request ${data.reference} — ${data.service}`;
      const body = [
        `Reference: ${data.reference}`,
        `Name: ${data.name}`,
        `Phone: ${data.phone}`,
        `Email: ${data.email || '-'}`,
        `Vehicle: ${data.vehicle}`,
        `Service: ${data.service}`,
        `Date: ${data.date}`,
        `Time: ${data.time}`,
        `Notes: ${data.notes || '-'}`,
      ].join('\n');
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    showSuccess(data, message) {
      const date = new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const rows = [
        ['Reference', data.reference],
        ['Service', data.service],
        ['Vehicle', data.vehicle],
        ['When', `${date}, ${data.time}`],
      ];
      this.summary.innerHTML = '';
      rows.forEach(([k, v]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = k;
        dd.textContent = v;
        this.summary.append(dt, dd);
      });
      this.successText.textContent = message;
      this.formWrap.hidden = true;
      this.success.hidden = false;
      $('.btn', this.success).focus({ preventScroll: true });
    },
  };

  /* -----------------------------------------------------------
     Boot
     ----------------------------------------------------------- */
  const App = {
    init() {
      const year = $('#year');
      if (year) year.textContent = new Date().getFullYear();

      SmoothScroll.init();
      Nav.init();
      MobileMenu.init();
      HeroMedia.init();
      Reveal.init();
      Counters.init();
      Parallax.init();
      SheetRise.init();
      Carousels.init();
      ServiceFilter.init();
      Gallery.init();
      Modals.init();
      Booking.init();
      Ready.init();
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init());
  else App.init();
})();
