/**
 * NavBar — Shared navigation bar for all pages.
 * Self-contained component, no external dependencies (uses inline SVG icons).
 * 
 * Usage:
 *   import { NavBar } from './src/organisms/NavBar.js';
 *   document.body.prepend(new NavBar({ activePage: 'home' }).render());
 */

export class NavBar {
    constructor(config = {}) {
        this.activePage = config.activePage || 'home';
        this.transparent = config.transparent ?? true;
        this.element = null;
        this.mobileMenuOpen = false;

        this.links = [
            { id: 'home',    label: 'Home',          href: 'landing.html' },
            { id: 'app',     label: 'Launch App',    href: 'index.html',          highlight: true },
            { id: 'portfolio', label: 'Portfolio',   href: 'portfolio.html' },
            { id: 'docs',    label: 'Documentation', href: 'documentation.html' },
        ];
    }

    render() {
        const nav = document.createElement('nav');
        nav.id = 'jethos-navbar';
        nav.className = this.transparent
            ? 'fixed top-0 left-0 right-0 z-50 transition-all duration-300'
            : 'sticky top-0 z-50 bg-gray-900/95 backdrop-blur-lg border-b border-white/10';
        
        nav.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <!-- Logo -->
                    <a href="landing.html" class="flex items-center gap-2 group">
                        <span class="text-2xl">🌊</span>
                        <span class="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">Jethos</span>
                        <span class="hidden sm:inline text-xs text-purple-400 font-medium bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">Protocol</span>
                    </a>

                    <!-- Desktop Links -->
                    <div class="hidden md:flex items-center gap-1">
                        ${this.links.map(link => this._renderDesktopLink(link)).join('')}
                    </div>

                    <!-- Mobile Menu Button -->
                    <button id="navbar-mobile-toggle" class="md:hidden p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors" aria-label="Toggle menu">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path id="navbar-hamburger-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Mobile Menu -->
            <div id="navbar-mobile-menu" class="md:hidden hidden bg-gray-900/98 backdrop-blur-xl border-t border-white/10">
                <div class="px-4 py-3 space-y-1">
                    ${this.links.map(link => this._renderMobileLink(link)).join('')}
                </div>
            </div>
        `;

        // Transparent scroll behavior
        if (this.transparent) {
            nav.style.background = 'transparent';
            const handleScroll = () => {
                if (window.scrollY > 60) {
                    nav.style.background = 'rgba(17, 24, 39, 0.92)';
                    nav.style.backdropFilter = 'blur(16px)';
                    nav.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
                } else {
                    nav.style.background = 'transparent';
                    nav.style.backdropFilter = 'none';
                    nav.style.borderBottom = 'none';
                }
            };
            window.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll();
        }

        // Mobile toggle
        setTimeout(() => {
            const toggle = nav.querySelector('#navbar-mobile-toggle');
            const menu = nav.querySelector('#navbar-mobile-menu');
            if (toggle && menu) {
                toggle.addEventListener('click', () => {
                    this.mobileMenuOpen = !this.mobileMenuOpen;
                    menu.classList.toggle('hidden', !this.mobileMenuOpen);
                });
            }
        }, 0);

        this.element = nav;
        return nav;
    }

    _renderDesktopLink(link) {
        const isActive = link.id === this.activePage;
        if (link.highlight) {
            return `<a href="${link.href}" 
                class="ml-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                       ${isActive 
                           ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                           : 'bg-purple-600/80 text-white hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/25'}">
                ${link.label}
            </a>`;
        }
        return `<a href="${link.href}" 
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                   ${isActive 
                       ? 'text-white bg-white/15' 
                       : 'text-white/70 hover:text-white hover:bg-white/10'}">
            ${link.label}
        </a>`;
    }

    _renderMobileLink(link) {
        const isActive = link.id === this.activePage;
        if (link.highlight) {
            return `<a href="${link.href}" 
                class="block px-4 py-3 rounded-lg text-sm font-semibold transition-colors
                       ${isActive 
                           ? 'bg-purple-600 text-white' 
                           : 'bg-purple-600/70 text-white hover:bg-purple-500'}">
                ${link.label}
            </a>`;
        }
        return `<a href="${link.href}" 
            class="block px-4 py-3 rounded-lg text-sm font-medium transition-colors
                   ${isActive 
                       ? 'text-white bg-white/15' 
                       : 'text-white/70 hover:text-white hover:bg-white/10'}">
            ${link.label}
        </a>`;
    }
}
