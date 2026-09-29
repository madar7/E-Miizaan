// Inline SVG icons (no external images needed).
const ICONS = {
  avatar: `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 94c0-19 14-29 34-29s34 10 34 29z" fill="#8a97a8"/>
    <path d="M38 65l10 15 10-15z" fill="#fff"/>
    <path d="M46 70h4l2 16-4 4-4-4z" fill="#2b2f36"/>
    <circle cx="48" cy="38" r="17" fill="#f2b56b"/>
    <path d="M31 36c0-12 8-19 18-19s17 7 17 18c-4-6-9-9-17-9s-13 3-18 10z" fill="#5a3a22"/>
    <circle cx="42" cy="40" r="2" fill="#3b2a1a"/><circle cx="54" cy="40" r="2" fill="#3b2a1a"/>
    <path d="M42 47q6 5 12 0" stroke="#3b2a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g transform="rotate(-18 76 66)"><rect x="62" y="56" width="28" height="18" rx="2" fill="#5fae6d" stroke="#2f6b3f" stroke-width="2"/><circle cx="76" cy="65" r="5" fill="#cfe9d3"/></g>
  </svg>`,

  // Sidebar icons (outline, white)
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 12l4-4"/><path d="M7.5 12h.01M12 7.5v.01"/></svg>`,
  category: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>`,
  income: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
  expenses: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 7l12-3v3"/><circle cx="16.5" cy="13.5" r="1.2"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><path d="M16 5a3 3 0 010 6M18 14c2 .6 3.3 2.3 3.5 5"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1011 0"/></svg>`,

  // Tile icons (filled, light on green)
  cashUp: `<svg viewBox="0 0 48 48"><rect x="4" y="22" width="40" height="20" rx="3" fill="#e9f5ec"/><circle cx="24" cy="32" r="6" fill="#4a7c59"/><circle cx="24" cy="32" r="3" fill="#e9f5ec"/><path d="M24 4l9 10h-6v8h-6v-8h-6z" fill="#e8674f"/></svg>`,
  coin: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#f4c95d" stroke="#d9a53a" stroke-width="3"/><text x="24" y="32" text-anchor="middle" font-size="24" font-weight="700" fill="#b9821f" font-family="Segoe UI,Arial,sans-serif">$</text></svg>`,
  chart: `<svg viewBox="0 0 48 48"><rect x="3" y="20" width="42" height="24" rx="3" fill="#cfe6d6"/><circle cx="24" cy="32" r="7" fill="#fff"/><circle cx="24" cy="32" r="3.5" fill="#4a7c59"/><path d="M6 14l10-6 8 5 12-9" stroke="#e8674f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bag: `<svg viewBox="0 0 48 48"><path d="M17 6h14l-3 7c8 4 12 10 12 17 0 8-7 13-16 13S8 38 8 30c0-7 4-13 12-17z" fill="#f4c95d"/><path d="M17 6h14" stroke="#d9a53a" stroke-width="3"/><text x="24" y="35" text-anchor="middle" font-size="18" font-weight="700" fill="#b9821f" font-family="Segoe UI,Arial,sans-serif">$</text></svg>`,
  receipt: `<svg viewBox="0 0 48 48"><rect x="4" y="10" width="40" height="28" rx="3" fill="#fbeaea"/><path d="M10 20h18M10 27h12" stroke="#c9605a" stroke-width="3" stroke-linecap="round"/><path d="M32 18l8 6-8 6z" fill="#e8674f"/></svg>`,
  ledger: `<svg viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="32" rx="3" fill="#7d8fd6"/><path d="M4 18h40M4 28h40M18 8v32" stroke="#e9ecfa" stroke-width="2.5"/></svg>`,
  wallet: `<svg viewBox="0 0 48 48"><rect x="5" y="12" width="34" height="28" rx="4" fill="#e9c69a"/><rect x="5" y="12" width="34" height="9" rx="3" fill="#d4a86f"/><circle cx="37" cy="36" r="9" fill="#f4c95d" stroke="#d9a53a" stroke-width="2.5"/><text x="37" y="41" text-anchor="middle" font-size="12" font-weight="700" fill="#b9821f" font-family="Segoe UI,Arial,sans-serif">$</text></svg>`,
  card: `<svg viewBox="0 0 48 48"><rect x="4" y="10" width="40" height="28" rx="4" fill="#e9eefb"/><rect x="4" y="16" width="40" height="7" fill="#5b78c9"/><rect x="9" y="29" width="14" height="4" rx="2" fill="#5b78c9"/></svg>`,
  scale: `<svg viewBox="0 0 48 48"><path d="M24 6v32M12 40h24M8 14h32" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M8 14l-5 14a6 6 0 0010 0zM40 14l-5 14a6 6 0 0010 0z" fill="#f4c95d"/></svg>`,
};
