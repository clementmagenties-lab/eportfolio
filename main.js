/* ==========================================================================
   main.js — Clément Magenties Portfolio
   1. Seamless Page Navigation (PJAX / SPA Transitions)
   2. Continuous Background Video Playback & Timestamp Persistence
   3. Bilingual Switcher (FR / EN)
   4. Scroll Reveal Animations
   ========================================================================== */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. BACKGROUND VIDEO CONTINUITY & PERSISTENCE
  // --------------------------------------------------------------------------
  const STORAGE_KEY = 'clement_portfolio_video_time';

  function initVideo() {
    const video = document.querySelector('.bg-video');
    if (!video) return;

    // Restore saved playback time (handles hard refresh or native page changes)
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const targetTime = parseFloat(saved);
      if (!isNaN(targetTime) && targetTime > 0) {
        let applied = false;
        const applyTime = () => {
          if (applied) return;
          try {
            const timeToSet = (video.duration && targetTime >= video.duration)
              ? (targetTime % video.duration)
              : targetTime;
            if (Math.abs(video.currentTime - timeToSet) > 0.3) {
              video.currentTime = timeToSet;
            }
            applied = true;
          } catch (e) {}
        };

        if (video.readyState >= 1) {
          applyTime();
        } else {
          video.addEventListener('loadedmetadata', applyTime, { once: true });
          video.addEventListener('loadeddata', applyTime, { once: true });
          video.addEventListener('canplay', applyTime, { once: true });
        }
      }
    }

    // Keep saving current time during playback
    let lastSaved = 0;
    video.addEventListener('timeupdate', () => {
      const now = video.currentTime;
      if (Math.abs(now - lastSaved) >= 0.25) {
        lastSaved = now;
        try {
          sessionStorage.setItem(STORAGE_KEY, String(now));
        } catch (e) {}
      }
    });

    // Save on beforeunload & pagehide
    const saveTime = () => {
      if (video && !isNaN(video.currentTime)) {
        try {
          sessionStorage.setItem(STORAGE_KEY, String(video.currentTime));
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', saveTime);
    window.addEventListener('pagehide', saveTime);

    // Make sure autoplay is running
    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          const unlock = () => {
            video.play();
            window.removeEventListener('click', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('touchstart', unlock);
          };
          window.addEventListener('click', unlock, { once: true });
          window.addEventListener('keydown', unlock, { once: true });
          window.addEventListener('touchstart', unlock, { once: true });
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. BILINGUAL SWITCHER (FR / EN)
  // --------------------------------------------------------------------------
  function initLang() {
    const root = document.documentElement;
    const buttons = document.querySelectorAll('[data-lang-switch]');

    function setLang(lang) {
      root.classList.toggle('lang-fr', lang === 'fr');
      root.classList.toggle('lang-en', lang === 'en');
      buttons.forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.langSwitch === lang));
      });
      document.documentElement.lang = lang;
      try {
        localStorage.setItem('portfolio_lang', lang);
      } catch (e) {}
    }

    buttons.forEach(btn => {
      btn.onclick = () => setLang(btn.dataset.langSwitch);
    });

    const savedLang = localStorage.getItem('portfolio_lang') || 'fr';
    setLang(savedLang);
  }

  // --------------------------------------------------------------------------
  // 3. SCROLL REVEAL OBSERVER
  // --------------------------------------------------------------------------
  let revealObserver = null;

  function initReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if (!revealElements.length) return;

    if ('IntersectionObserver' in window) {
      if (revealObserver) {
        revealObserver.disconnect();
      }
      revealObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px 40px 0px' }
      );

      revealElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Immediately reveal elements already inside or near viewport
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('is-visible');
        } else if (!el.classList.contains('is-visible')) {
          revealObserver.observe(el);
        }
      });
    } else {
      revealElements.forEach(el => el.classList.add('is-visible'));
    }
  }

  // --------------------------------------------------------------------------
  // 4. SEAMLESS CLIENT-SIDE NAVIGATION (PJAX)
  //    Keeps the <video> playing without restart or pause when changing pages!
  // --------------------------------------------------------------------------
  function normalizePath(p) {
    return p.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
  }

  async function loadPage(targetUrl, push = true) {
    const targetObj = new URL(targetUrl, window.location.href);

    // Persist current video time immediately
    const video = document.querySelector('.bg-video');
    if (video && !isNaN(video.currentTime)) {
      try {
        sessionStorage.setItem(STORAGE_KEY, String(video.currentTime));
      } catch (e) {}
    }

    const currentMain = document.querySelector('main');
    if (currentMain) {
      currentMain.style.transition = 'opacity 0.12s ease';
      currentMain.style.opacity = '0.35';
    }

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const text = await response.text();

      const parser = new DOMParser();
      const nextDoc = parser.parseFromString(text, 'text/html');

      // 1. Update Title
      if (nextDoc.title) {
        document.title = nextDoc.title;
      }

      // 2. Replace Main
      const nextMain = nextDoc.querySelector('main');
      if (currentMain && nextMain) {
        nextMain.style.opacity = '0';
        nextMain.style.transition = 'opacity 0.22s ease';
        currentMain.replaceWith(nextMain);
        requestAnimationFrame(() => {
          nextMain.style.opacity = '1';
        });
      }

      // 3. Replace Footer
      const currentFooter = document.querySelector('footer');
      const nextFooter = nextDoc.querySelector('footer');
      if (currentFooter && nextFooter) {
        currentFooter.replaceWith(nextFooter);
      }

      // 4. Update Header Nav (active state & links)
      const currentNav = document.querySelector('.site-header .nav');
      const nextNav = nextDoc.querySelector('.site-header .nav');
      if (currentNav && nextNav) {
        currentNav.innerHTML = nextNav.innerHTML;
      }

      // 5. Update History
      if (push) {
        history.pushState({ url: targetUrl }, '', targetUrl);
      }

      // 6. Scroll position
      if (targetObj.hash) {
        const anchor = document.querySelector(targetObj.hash);
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      } else {
        window.scrollTo(0, 0);
      }

      // 7. Re-initialize features on the new DOM
      initLang();
      initReveal();

    } catch (err) {
      // Fallback to normal navigation if fetch fails (e.g. file:// protocol restriction)
      window.location.href = targetUrl;
    }
  }

  // Intercept click on links for seamless navigation
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;

    // Conditions to allow default browser handling:
    if (
      link.target === '_blank' ||
      link.hasAttribute('download') ||
      link.getAttribute('rel') === 'external' ||
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
    ) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return;
    }

    // Resolve URL
    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return;
    }

    // External domain -> let browser handle
    if (url.origin !== window.location.origin) {
      return;
    }

    // PDF files -> let browser handle
    if (url.pathname.toLowerCase().endsWith('.pdf')) {
      return;
    }

    // Same-page anchor jump
    const currentNorm = normalizePath(window.location.pathname);
    const targetNorm = normalizePath(url.pathname);

    if (currentNorm === targetNorm && url.hash) {
      e.preventDefault();
      const targetEl = document.querySelector(url.hash);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', url.hash);
      } else if (url.hash === '#home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        history.pushState(null, '', window.location.pathname);
      }
      return;
    }

    // Cross-page navigation -> smooth PJAX transition
    e.preventDefault();
    loadPage(url.href, true);
  });

  // Handle browser back & forward buttons
  window.addEventListener('popstate', () => {
    loadPage(window.location.href, false);
  });

  // --------------------------------------------------------------------------
  // 5. RUN INITIALIZERS
  // --------------------------------------------------------------------------
  function setup() {
    initVideo();
    initLang();
    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
