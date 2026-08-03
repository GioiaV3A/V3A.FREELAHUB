const fs = require('fs');

let css = `
@import "tailwindcss";

@theme {
  --font-sans: var(--font-geologica), system-ui, -apple-system, sans-serif;
}

:root {
  /* V3A Brand Colors */
  --v3a-yellow: #FFCB05;
  --v3a-gray-100: #F0F0F0;
  --v3a-gray-400: #A4A6A9;
  --v3a-gray-700: #636466;
  --v3a-black: #000000;
  --v3a-white: #FFFFFF;

  /* Legacy mappings to prevent complete breakage while we refactor */
  --color-sidebar-navy: var(--v3a-white);
  --color-action-cyan: var(--v3a-yellow);
  
  --bg-page: var(--v3a-white);
  --text-primary: var(--v3a-gray-700);
  --text-secondary: var(--v3a-gray-400);
  --border-subtle: #E2E3E4;
}

/* Force body text and background */
body {
  background-color: var(--v3a-white) !important;
  color: var(--v3a-gray-700) !important;
  font-family: var(--font-geologica), sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Fix legibility overrides globally */
/* Any text that was forced to white or light gray should become dark gray if it's on a white/yellow bg */
.text-white, .text-slate-200, .text-slate-300, .text-slate-400 {
  color: var(--v3a-gray-700) !important;
}

/* Preserve white text ONLY if inside specific explicitly dark badges like success/danger if needed */
.bg-emerald-600 .text-white,
.bg-red-600 .text-white,
.bg-emerald-500 .text-white,
.bg-red-500 .text-white {
  color: #FFFFFF !important;
}

/* Primary Buttons */
.bg-action-cyan, .bg-sidebar-navy {
  background-color: var(--v3a-yellow) !important;
  color: var(--v3a-black) !important;
  border: none !important;
}

/* Hover on primary buttons */
.hover\\:bg-action-cyan\/90:hover, .hover\\:bg-sidebar-navy\/95:hover {
  background-color: #FFCA00 !important;
  color: var(--v3a-black) !important;
}

/* Tables */
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
th {
  font-family: var(--font-play), sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--v3a-gray-700);
  border-bottom: 2px solid var(--border-subtle);
  padding: 12px;
}
td {
  padding: 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--v3a-gray-700);
}
tr:hover td {
  background-color: var(--v3a-gray-100);
}

/* Inputs */
input, select, textarea {
  border: 1px solid var(--border-subtle) !important;
  background-color: var(--v3a-white) !important;
  color: var(--v3a-gray-700) !important;
}
input:focus, select:focus, textarea:focus {
  outline: 3px solid rgba(255,203,5,0.55) !important;
  border-color: var(--v3a-yellow) !important;
}

/* Cards */
.bg-white, .bg-slate-900, .bg-\\[\\#0A192F\\] {
  background-color: var(--v3a-white) !important;
  border: 1px solid var(--border-subtle) !important;
  box-shadow: none !important;
}

/* Badges */
.bg-emerald-500\\/10 {
  background-color: #ECFDF5 !important;
  color: #047857 !important;
  border: 1px solid #D1FAE5 !important;
}
.bg-amber-500\\/10 {
  background-color: #FFFBEB !important;
  color: #B45309 !important;
  border: 1px solid #FEF3C7 !important;
}
.bg-red-500\\/10 {
  background-color: #FFF1F2 !important;
  color: #BE123C !important;
  border: 1px solid #FFE4E6 !important;
}
.bg-blue-500\\/10 {
  background-color: #EFF6FF !important;
  color: #1D4ED8 !important;
  border: 1px solid #BFDBFE !important;
}

/* Titles */
h1, h2, h3, h4, h5, h6 {
  color: var(--v3a-gray-700) !important;
  font-weight: 800 !important;
}

/* Timeline specific */
.timeline-bg {
  background-color: var(--v3a-white) !important;
}

/* Scrollbars */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--v3a-gray-100); }
::-webkit-scrollbar-thumb { background: var(--v3a-gray-400); border-radius: 4px; }
`;

fs.writeFileSync('app/globals.css', css);
console.log('Updated app/globals.css');
