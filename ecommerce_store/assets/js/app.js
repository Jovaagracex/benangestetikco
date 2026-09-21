/**
 * BenangEstetik Co. — Shared App Behaviour
 * Navbar scroll, user auth state renderer, dynamic year, and back-to-top button.
 */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // Navbar Scroll Effect
    var nav = document.getElementById('mainNav');
    if (nav) {
        var onScroll = function () {
            nav.classList.toggle('scrolled', window.scrollY > 50);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // Dynamic Year Footer
    var yearEl = document.getElementById('currentYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Back to top floating button
    var backBtn = document.getElementById('backToTop');
    if (backBtn) {
        window.addEventListener('scroll', function () {
            backBtn.style.display = window.scrollY > 400 ? 'inline-flex' : 'none';
        }, { passive: true });
        backBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Render User Account State in Navbar
    async function renderUserAuthState() {
        var navAuthContainer = document.getElementById('navUserAuth');
        if (!navAuthContainer) return;

        var sessionUser = JSON.parse(localStorage.getItem('benangestetik_user_session') || 'null');
        var isAdminLoggedIn = false;

        if (typeof supabase !== 'undefined' && supabase) {
            try {
                var res = await supabase.auth.getSession();
                if (res && res.data && res.data.session) {
                    isAdminLoggedIn = true;
                }
            } catch (e) {}
        }

        if (sessionUser && sessionUser.name) {
            navAuthContainer.innerHTML = 
                '<div class="dropdown d-inline-block">' +
                    '<button class="btn btn-outline-dark btn-sm dropdown-toggle rounded-pill px-3 fw-semibold" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
                        '<i class="fas fa-user-circle me-1" style="color:var(--terracotta)"></i> ' + sanitize(sessionUser.name) +
                    '</button>' +
                    '<ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2" style="border-radius:14px;">' +
                        '<li><a class="dropdown-item" href="keranjang.html"><i class="fas fa-shopping-bag me-2" style="color:var(--terracotta)"></i>Keranjang Saya</a></li>' +
                        '<li><a class="dropdown-item" href="checkout.html"><i class="fas fa-receipt me-2" style="color:var(--terracotta)"></i>Status Checkout</a></li>' +
                        '<li><hr class="dropdown-divider"></li>' +
                        '<li><a class="dropdown-item text-danger" href="#" id="btnLogoutUserNav"><i class="fas fa-sign-out-alt me-2"></i>Keluar Akun</a></li>' +
                    '</ul>' +
                '</div>';

            var btnLogoutNav = document.getElementById('btnLogoutUserNav');
            if (btnLogoutNav) {
                btnLogoutNav.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (confirm('Keluar dari akun Anda?')) {
                        localStorage.removeItem('benangestetik_user_session');
                        renderUserAuthState();
                        window.location.reload();
                    }
                });
            }
        } else if (isAdminLoggedIn) {
            navAuthContainer.innerHTML = 
                '<a href="admin/dashboard.html" class="btn btn-dark btn-sm rounded-pill px-3" title="Dashboard Admin">' +
                    '<i class="fas fa-user-shield me-1" style="color:var(--gold)"></i> Dashboard Admin' +
                '</a>';
        } else {
            navAuthContainer.innerHTML = 
                '<a href="login.html" class="btn btn-outline-dark btn-sm rounded-pill px-3 me-2" title="Login / Register Pelanggan">' +
                    '<i class="fas fa-user me-1" style="color:var(--terracotta)"></i> Masuk Pelanggan' +
                '</a>' +
                '<a href="admin/login.html" class="btn btn-dark btn-sm rounded-pill px-3" title="Login Khusus Admin">' +
                    '<i class="fas fa-lock me-1" style="color:var(--gold)"></i> Login Admin' +
                '</a>';
        }
    }

    renderUserAuthState();
});
