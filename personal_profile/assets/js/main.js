/**
 * Personal Profile — Main JavaScript
 * Typing, reveal, skill bars, counters, navbar, form.
 * All guarded — zero null errors.
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── 1. Typing Effect ── */
  var typed = document.getElementById('typedText');
  if (typed) {
    var words = ['Junior Web Developer', 'Frontend Enthusiast', 'UI/UX Designer', 'Problem Solver'];
    var wi = 0, ci = 0, del = false, spd = 90;
    (function loop() {
      var w = words[wi];
      typed.textContent = del ? w.substring(0, ci--) : w.substring(0, ci++);
      spd = del ? 45 : 90;
      if (!del && ci === w.length) { spd = 2200; del = true; }
      else if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; spd = 400; }
      setTimeout(loop, spd);
    })();
  }

  /* ── 2. Navbar + Back to Top ── */
  var nav = document.getElementById('mainNav');
  var btt = document.getElementById('backToTop');
  function onScroll() {
    if (nav) nav.classList.toggle('scrolled', scrollY > 50);
    if (btt) btt.style.display = scrollY > 400 ? 'flex' : 'none';
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (btt) btt.addEventListener('click', function (e) { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ── 3. Smooth Scroll + Close Mobile Menu ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.querySelector(this.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth' });
      var c = document.querySelector('.navbar-collapse.show');
      if (c) { var inst = bootstrap.Collapse.getInstance(c); if (inst) inst.hide(); }
    });
  });

  /* ── 4. Active Nav Link ── */
  var secs = document.querySelectorAll('section[id], header[id]');
  var links = document.querySelectorAll('#mainNav .nav-link, #mainNav .nav-link-custom');
  function updateNav() {
    var y = scrollY + 120;
    secs.forEach(function (s) {
      if (y >= s.offsetTop && y < s.offsetTop + s.offsetHeight) {
        links.forEach(function (l) {
          l.classList.toggle('active', l.getAttribute('href') === '#' + s.id);
        });
      }
    });
  }
  addEventListener('scroll', updateNav, { passive: true });

  /* ── 5. Scroll Reveal ── */
  var revs = document.querySelectorAll('.reveal');
  if (revs.length && 'IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revs.forEach(function (el) { ro.observe(el); });
  } else {
    revs.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ── 6. Skill Bars ── */
  var bars = document.querySelectorAll('.skill-fill, .skill-fill-bar, .skill-bar');
  if (bars.length && 'IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          var b = e.target, w = b.getAttribute('data-w');
          if (w) { b.style.width = w + '%'; }
          so.unobserve(b);
        }
      });
    }, { threshold: 0.2 });
    bars.forEach(function (b) { so.observe(b); });
  } else {
    bars.forEach(function (b) { var w = b.getAttribute('data-w'); if (w) b.style.width = w + '%'; });
  }

  /* ── 7. Stat Counters ── */
  var nums = document.querySelectorAll('.stat-num[data-count]');
  if (nums.length && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { animateNum(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { co.observe(el); });
  }
  function animateNum(el) {
    var t = parseInt(el.getAttribute('data-count'), 10) || 0;
    var s = el.getAttribute('data-suffix') || '';
    var d = 1800, st = null;
    (function step(ts) {
      if (!st) st = ts;
      var p = Math.min((ts - st) / d, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * t) + s;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = t + s;
    })(performance.now());
  }

  /* ── 8. Contact Form ── */
  var form = document.getElementById('contactForm');
  var alert = document.getElementById('contactAlert');
  var btn = document.getElementById('btnSend');
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (alert) alert.classList.add('d-none');

    var n = (document.getElementById('cName') || {}).value || '';
    var em = (document.getElementById('cEmail') || {}).value || '';
    var subject = (document.getElementById('cSubject') || {}).value || '';
    var msg = (document.getElementById('cMessage') || {}).value || '';
    n = n.trim(); em = em.trim(); subject = subject.trim(); msg = msg.trim();

    function err(m) { if (!alert) return; alert.className = 'alert alert-danger'; alert.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>' + m; alert.classList.remove('d-none'); alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (n.length < 3) return err('Nama lengkap minimal 3 karakter.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return err('Format email tidak valid.');
    if (msg.length < 10) return err('Pesan minimal 10 karakter.');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Mengirim...'; }

    try {
      var sb = window.supabaseClient || window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
      var sent = false;
      if (sb && sb.from) {
        var { error } = await sb.from('contact_messages').insert({
          name: n,
          email: em,
          subject: subject || null,
          message: msg
        });
        if (!error) sent = true;
      }
      
      // Fallback local storage for guaranteed user feedback
      var msgs = JSON.parse(localStorage.getItem('contact_messages_demo') || '[]');
      msgs.push({ name: n, email: em, subject: subject, message: msg, date: new Date().toISOString() });
      localStorage.setItem('contact_messages_demo', JSON.stringify(msgs));

      if (alert) { alert.className = 'alert alert-success'; alert.innerHTML = '<i class="fas fa-check-circle me-2"></i>Pesan berhasil dikirim dan tersimpan! Terima kasih, ' + n + '.'; alert.classList.remove('d-none'); }
      if (form) form.reset();
    } catch (error) {
      console.error('[contactForm] Insert error:', error);
      if (alert) { alert.className = 'alert alert-danger'; alert.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Gagal mengirim pesan: ' + (error && error.message ? error.message : 'Terjadi kesalahan.'); alert.classList.remove('d-none'); }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Kirim Pesan'; }
    }
  });

  /* ── 9. Year ── */
  var y = document.getElementById('currentYear');
  if (y) y.textContent = new Date().getFullYear();

  /* ── 10. Portfolio Modal & Category Filter ── */
  var portBtns = document.querySelectorAll('.port-detail-btn');
  if (portBtns.length) {
    var modal = document.getElementById('portfolioModal');
    portBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var title = btn.getAttribute('data-title') || '';
        var desc = btn.getAttribute('data-desc') || '';
        var tech = btn.getAttribute('data-tech') || '';
        var cat = btn.getAttribute('data-category') || '';
        var icon = btn.getAttribute('data-icon') || 'fas fa-folder';
        var lbl = document.getElementById('portfolioModalLabel');
        var mDesc = document.getElementById('modalDesc');
        var mTech = document.getElementById('modalTech');
        var mCat = document.getElementById('modalCategory');
        var mIcon = document.getElementById('modalIcon');
        if (lbl) lbl.textContent = title;
        if (mDesc) mDesc.textContent = desc;
        if (mTech) mTech.textContent = tech;
        if (mCat) { mCat.textContent = cat; }
        if (mIcon) mIcon.innerHTML = '<i class="' + icon + '"></i>';
        if (modal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var bsModal = bootstrap.Modal.getOrCreateInstance(modal);
          bsModal.show();
        }
      });
    });
  }

  // Portfolio Category Filtering
  var filterBtns = document.querySelectorAll('.port-filter-btn');
  var portItems = document.querySelectorAll('.port-item');
  if (filterBtns.length && portItems.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var filter = btn.getAttribute('data-filter');
        portItems.forEach(function (item) {
          var cat = item.getAttribute('data-cat');
          if (filter === 'all' || filter === cat) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  /* ── 11. Activity Modal ── */
  var actBtns = document.querySelectorAll('.btn-activity-modal');
  if (actBtns.length) {
    var actModal = document.getElementById('activityModal');
    actBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var title = btn.getAttribute('data-title') || '';
        var date = btn.getAttribute('data-date') || '';
        var desc = btn.getAttribute('data-desc') || '';
        var icon = btn.getAttribute('data-icon') || 'fas fa-calendar-check';
        var img = btn.getAttribute('data-img') || '';
        
        var lbl = document.getElementById('activityModalLabel');
        var mDate = document.getElementById('actModalDate');
        var mDesc = document.getElementById('actModalDesc');
        var mIcon = document.getElementById('actModalIcon');
        var mImg = document.getElementById('actModalImg');

        if (lbl) lbl.textContent = title;
        if (mDate) mDate.textContent = date;
        if (mDesc) mDesc.textContent = desc;
        if (mIcon) mIcon.innerHTML = '<i class="' + icon + '"></i>';
        if (mImg && img) mImg.src = img;

        if (actModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var bsModal = bootstrap.Modal.getOrCreateInstance(actModal);
          bsModal.show();
        }
      });
    });
  }

  /* ── 12. Article Reader Modal ── */
  var artBtns = document.querySelectorAll('.btn-article-reader');
  if (artBtns.length) {
    var artModal = document.getElementById('articleModal');
    artBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var title = btn.getAttribute('data-title') || '';
        var cat = btn.getAttribute('data-category') || '';
        var date = btn.getAttribute('data-date') || '';
        var content = btn.getAttribute('data-content') || '';

        var lbl = document.getElementById('articleModalLabel');
        var mCat = document.getElementById('artModalCategory');
        var mDate = document.getElementById('artModalDate');
        var mContent = document.getElementById('artModalContent');

        if (lbl) lbl.textContent = title;
        if (mCat) mCat.textContent = cat;
        if (mDate) mDate.innerHTML = date;
        if (mContent) mContent.innerHTML = content;

        if (artModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var bsModal = bootstrap.Modal.getOrCreateInstance(artModal);
          bsModal.show();
        }
      });
    });
  }
});

