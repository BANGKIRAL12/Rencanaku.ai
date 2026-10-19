# design.md — Apexify Dark Dashboard

## 1. Design Tokens & Visual Style Overview

**Tema:** Modern SaaS Dashboard, dark mode, glassmorphism ringan, aksen ungu-magenta.

**Prinsip desain:**
- **Corner radius:** card `rounded-2xl` (16px), tombol/input `rounded-xl`, badge/avatar/toggle `rounded-full`
- **Elevation:** berbasis perbedaan lapisan warna (`bg-zinc-950` → `bg-zinc-900` → `bg-zinc-800`) plus `border border-white/5`. Glow ungu hanya untuk elemen aktif (kartu utama, tombol primer)
- **Spacing:** skala 4px Tailwind. Gap antar card `gap-4`/`gap-6`, padding card `p-5`/`p-6`
- **Kerapatan:** medium-padat, label kecil `text-xs`, angka besar menjadi fokus visual

---

## 2. Tailwind Color Palette & Config Extension

### Primary, Secondary, Accent, Neutral

| Token | HEX | Penggunaan | Kelas |
|---|---|---|---|
| `primary-400` | `#C084FC` | Hover, ikon aktif | `text-primary-400` |
| `primary-500` | `#A855F7` | Tombol primer, menu aktif | `bg-primary-500` |
| `primary-600` | `#7E3FD1` | Ujung gradient kartu utama | `to-primary-600` |
| `primary-900` | `#3B2060` | Area chart bawah | `bg-primary-900` |
| `accent-pink` | `#E879F9` | Progress bar negara | `bg-accent-pink` |
| `accent-yellow` | `#FDE68A` | Garis "Target" chart | `stroke-accent-yellow` |
| `surface-base` | `#0F0F11` | Background halaman/konten | `bg-surface-base` |
| `surface-sidebar` | `#1C1C1F` | Panel sidebar | `bg-surface-sidebar` |
| `surface-card` | `#26262A` | Card statistik, panel | `bg-surface-card` |
| `surface-raised` | `#323237` | Tombol sekunder, header tabel | `bg-surface-raised` |
| `frame` | `#4A4A54` | Latar luar mockup | `bg-frame` |
| `text-primary` | `#FFFFFF` | Judul, angka | `text-white` |
| `text-muted` | `#A1A1AA` | Label, sub-teks | `text-zinc-400` |
| `border-subtle` | `rgba(255,255,255,.06)` | Garis pemisah | `border-white/5` |

### Status & Feedback

| Status | HEX | Badge |
|---|---|---|
| Success | `#34D399` | `bg-emerald-400/10 text-emerald-400` |
| Danger | `#F87171` | `bg-red-400/10 text-red-400` |
| Warning/Processing | `#FACC15` | `bg-yellow-400/10 text-yellow-400` |
| Info | `#60A5FA` | `bg-blue-400/10 text-blue-400` |

### Gradients & Effects
- **Kartu utama:** `bg-gradient-to-b from-primary-500 to-primary-600/80 ring-1 ring-white/20 shadow-[0_0_30px_rgba(168,85,247,0.35)]`
- **Progress bar:** `bg-gradient-to-r from-primary-500 to-accent-pink`
- **Area chart:** `bg-gradient-to-b from-primary-500/60 to-transparent`
- **Tooltip glass:** `bg-white/5 backdrop-blur-md border border-white/10`
- **Tombol primer glow:** `shadow-[0_0_16px_rgba(168,85,247,0.5)]`

---

## 3. Typography System

**Font family:** sans-serif geometris modern, mirip *Plus Jakarta Sans* / *Inter* (aproksimasi).
- Utama: `font-sans` → `'Plus Jakarta Sans', 'Inter', system-ui, sans-serif`

| Elemen | Ukuran | Weight | Kelas |
|---|---|---|---|
| Judul halaman "Dashboard" | 30px | 700 | `text-3xl font-bold tracking-tight text-white` |
| Judul panel (Analytic, Session by Country, Transaction History) | 18–20px | 600 | `text-lg font-semibold text-white` |
| Angka statistik | 36px | 700 | `text-4xl font-bold leading-none` |
| Nama brand "Apexify" | 20px | 700 | `text-xl font-bold` |
| Tab & menu | 14px | 500 | `text-sm font-medium` |
| Label kartu / sub-teks | 12px | 400 | `text-xs text-zinc-400` |
| Header tabel | 12px | 500 | `text-xs font-medium text-zinc-400` |
| Ticker (TSLA) | 14px | 700 | `text-sm font-bold text-white` |
| Nama perusahaan / email | 12px | 400 | `text-xs text-zinc-400` |
| Badge status | 11px | 600 | `text-[11px] font-semibold` |
| Label sumbu chart | 12px | 500 | `text-xs text-zinc-400` |

---

## 4. Layout, Grid & Spacing System

### Layout utama
```html
<div class="min-h-screen bg-surface-base text-white flex gap-4 p-4">
  <aside class="w-64 shrink-0 ..."></aside>
  <main class="flex-1 min-w-0 flex flex-col gap-6">
    <header class="flex items-center justify-between"></header>
    <nav class="flex items-center justify-between border-b border-white/5"></nav>
    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"></section>
    <section class="grid grid-cols-1 xl:grid-cols-3 gap-4"></section>
    <section></section>
  </main>
</div>
```

| Area | Kelas |
|---|---|
| Stat cards (4 kolom) | `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4` |
| Analytic (2/3) + Session (1/3) | `grid grid-cols-1 xl:grid-cols-3 gap-4` → chart `xl:col-span-2` |
| Header | `flex items-center justify-between` |
| Aksi header (search, ikon, avatar) | `flex items-center gap-3` |
| Toolbar tab (date, filter, share) | `flex items-center gap-3` |

### Spacing
- Sidebar: `p-4`; item menu `px-4 py-3`; submenu `pl-12 py-2`
- Card statistik: `p-5`; panel besar: `p-6`
- Baris tabel: `px-4 py-4`
- Sidebar `w-64` (256px), dibungkus `rounded-2xl`

### Radius & Shadow
| Elemen | Kelas |
|---|---|
| Panel, card | `rounded-2xl` |
| Tombol, input, menu item | `rounded-xl` |
| Ikon bulat, avatar, toggle, badge | `rounded-full` |
| Window mockup | `rounded-3xl shadow-2xl shadow-black/50` |
| Kartu utama | `shadow-[0_0_30px_rgba(168,85,247,0.35)]` |

---

## 5. Tailwind UI Components Library

### 5.1 Window Browser (frame mockup)
- Frame luar: `bg-frame p-10` → window `rounded-3xl border border-white/10 overflow-hidden bg-surface-base`
- Toolbar: `flex items-center gap-4 px-5 h-14 bg-zinc-900`
- Traffic lights: `flex gap-2` → `w-3 h-3 rounded-full bg-red-500` / `bg-yellow-400` / `bg-green-500`
- Ikon sidebar toggle, back, forward: `w-5 h-5 text-zinc-400`
- Address bar: `flex-1 max-w-xl mx-auto h-9 rounded-lg bg-zinc-950 text-xs text-zinc-300 flex items-center justify-center gap-2` (ikon gembok + `apexify.com` *(asumsi)*)
- Ikon kanan (share, tambah tab, salin tab): `w-5 h-5 text-zinc-400`

### 5.2 Buttons

| Varian | Kelas |
|---|---|
| Primary (Share) | `inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-[0_0_16px_rgba(168,85,247,0.5)] transition-colors` |
| Secondary (Filter, Date range, Download) | `inline-flex items-center gap-2 bg-surface-raised hover:bg-zinc-700 text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-xl border border-white/5 transition-colors` |
| Icon button (power, bell) | `w-11 h-11 grid place-items-center rounded-full bg-surface-card hover:bg-surface-raised text-zinc-300 border border-white/5` |
| Dropdown kecil (Sales Estimation) | `inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 px-3 py-2 rounded-lg` |
| Kebab menu `⋯` | `p-1 text-zinc-400 hover:text-white rounded-md` |
| Table action "More" | `inline-flex items-center gap-1 bg-surface-raised hover:bg-zinc-700 text-xs font-medium px-3 py-2 rounded-lg` |
| Disabled | tambahkan `opacity-50 cursor-not-allowed pointer-events-none` |
| Focus | tambahkan `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400` |

Tombol "Upgrade" di promo card: `w-full bg-white text-zinc-900 text-xs font-semibold py-2 rounded-lg hover:bg-zinc-200`.

### 5.3 Input & Form Elements

**Search bar global:**
```html
<label class="flex items-center gap-3 w-80 h-11 px-4 rounded-xl bg-surface-card border border-white/5 focus-within:ring-2 focus-within:ring-primary-500">
  <svg class="w-4 h-4 text-zinc-400"></svg>
  <input class="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none" placeholder="Type here to start searching..." />
  <kbd class="text-[11px] text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">⌘ /</kbd>
</label>
```

**Toggle Dark Mode (aktif):**
```html
<button role="switch" aria-checked="true" class="relative w-12 h-6 rounded-full bg-primary-500 transition-colors">
  <span class="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform"></span>
</button>
```
Nonaktif: `bg-zinc-600`, knob `left-0.5`.

**Checkbox tabel:** `w-4 h-4 rounded border-white/20 bg-transparent text-primary-500 focus:ring-primary-500`. Header "select all" berupa tanda minus (indeterminate).

### 5.4 Cards & Containers

**Panel umum** (Analytic, Session, Transaction):
`bg-surface-card rounded-2xl border border-white/5 p-6`

**Stat card standar:**
```html
<div class="bg-surface-card rounded-2xl border border-white/5 p-5 flex flex-col gap-6">
  <div class="flex items-start justify-between">
    <span class="w-11 h-11 rounded-full bg-primary-500/20 grid place-items-center text-primary-400"></span>
    <button class="text-zinc-400">⋯</button>
  </div>
  <div class="space-y-1">
    <p class="text-xs text-zinc-400">Profit</p>
    <div class="flex items-center gap-2">
      <span class="text-4xl font-bold">$15,708.98</span>
      <span class="badge-success">+12.5%</span>
    </div>
    <p class="text-xs text-zinc-400">Compared to last month</p>
  </div>
</div>
```

| Kartu | Label | Nilai | Badge |
|---|---|---|---|
| 1 (aktif, gradient ungu) | Total Income | `$348,261` | hijau (persen *asumsi*) |
| 2 | Profit | `$15,708.98` | hijau |
| 3 | Total Revenue | `7.415.644` | merah |
| 4 | Total Conversion | `10,87%` | hijau |

Kartu 1 memakai kelas gradient dari bagian 2, ikon `bg-black/30 text-white`, label `text-white/80`.

**Chart (Analytic):**
- Header: `flex items-center justify-between mb-6` → judul + dropdown "Sales Estimation" + kebab
- Sumbu Y (`$10M`…`$0` *asumsi*): `text-xs text-zinc-400`, gridline `stroke-white/5`
- Sumbu X: `Q1 Q2 Q3 Q4 Q1 Q2 Q3 Q4`
- Series 1: garis ungu `stroke-primary-400 stroke-2` + area `fill-primary-500/40`
- Series 2: garis `stroke-accent-yellow stroke-2`
- Garis vertikal hover: `stroke-white stroke-dasharray-[4]` + titik putih `r-4`
- Tooltip: `bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3`; tanggal `text-[11px] text-zinc-300`; dua kolom dibatasi `border-l-2` (ungu untuk Revenue `$32,830.00`, kuning untuk Target `$18,100.00`); angka `text-sm font-bold`
- Rekomendasi library: Recharts / Chart.js

**Session by Country:**
```html
<ul class="space-y-6">
  <li class="flex items-center gap-4">
    <img class="w-11 h-11 rounded-full bg-zinc-700 p-2" alt="flag" />
    <div class="flex-1 space-y-2">
      <div class="flex justify-between text-sm"><span class="text-zinc-300">United States</span><span class="font-semibold">85%</span></div>
      <div class="h-2 rounded-full bg-white/5">
        <div class="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-pink" style="width:85%"></div>
      </div>
    </div>
  </li>
</ul>
```
Data: United States 85%, Japan 70%, Indonesia 45%, South Korea 30%.

**Promo card sidebar:**
`rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3` → ikon `w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-pink`; teks `text-xs font-semibold text-white` ("Get detailed analytics for help you, upgrade pro" *asumsi*); tombol Upgrade putih.

**Tabel Transaction History:**
- Wrapper: `overflow-x-auto`; `<table class="w-full text-left">`
- Header: `bg-surface-raised/60 text-xs font-medium text-zinc-400` (`rounded-lg` pada baris), sel `px-4 py-3`
- Kolom: Checkbox · Product Name · Order amount · Date (ikon sort ↓) · Status · Executed by · aksi
- Baris: `border-b border-white/5 hover:bg-white/[0.03]`, sel `px-4 py-4 text-sm`
- Sel produk: ticker `font-bold text-white` + nama `text-xs text-zinc-400`
- Sel executor: `flex items-center gap-3` → avatar `w-9 h-9 rounded-full` + nama `text-sm font-semibold` + email `text-xs text-zinc-400`

| Ticker | Perusahaan | Status | Executor |
|---|---|---|---|
| TSLA | Tesla, Inc. | Processing (kuning), baris terpilih (checkbox ✓) | Olivia Rhye |
| MTCH | Match Group, Inc. | Success (hijau) | Phoenix Baker |
| DOCO *(asumsi)* | Doximity Inc *(asumsi)* | Success (hijau) | Lana Steiner |
| ARKD *(asumsi)* | ARK Dynamic Innovation ETF *(asumsi)* | Declined (merah) | Demi Wilkinson |

Tanggal: Dec 12–28, 2023. Kolom Order amount berisi nominal `$` (mis. `$30,021.23`).
Tombol header tabel: **Download** (secondary + ikon) dan **Review** *(asumsi)* (primary + ikon) + kebab.

### 5.5 Navigation & Badges

**Sidebar:**
```html
<aside class="w-64 shrink-0 bg-surface-sidebar rounded-2xl p-4 flex flex-col border border-white/5">
  <div class="flex items-center justify-between px-2 mb-6">
    <div class="flex items-center gap-2"><span class="w-8 h-8 rounded-lg bg-primary-500"></span><span class="text-xl font-bold">Apexify</span></div>
    <button class="text-zinc-400"><!-- ikon panel --></button>
  </div>
  <nav class="space-y-1 flex-1"><!-- items --></nav>
  <!-- promo card + dark mode toggle -->
</aside>
```

| State item | Kelas |
|---|---|
| Aktif (Dashboard) | `flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold shadow-[0_0_16px_rgba(168,85,247,0.4)]` |
| Default | `flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-300 text-sm font-medium hover:bg-white/5 hover:text-white` |
| Submenu | `pl-12 pr-4 py-2 text-sm text-zinc-400 hover:text-white` |
| Chevron | `ml-auto w-4 h-4 text-zinc-400` (`rotate-180` saat terbuka) |

Struktur menu: **Dashboard** (aktif), **Sales**, **Analytics** (terbuka, chevron ▲; submenu *Product, Store, Visitor*), **Launch** *(asumsi; chevron ▼)*, **Shipment**, **Integration**. Footer sidebar: ikon bulan + "Dark Mode" + toggle.

**Header halaman:** judul `text-3xl font-bold`; kanan: search, ikon power, ikon bell, avatar `w-11 h-11 rounded-full ring-2 ring-white/20`, chevron kecil.

**Tab bar:**
```html
<nav class="flex gap-6 text-sm font-medium">
  <a class="relative pb-3 text-white after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary-500">Overview</a>
  <a class="pb-3 text-zinc-400 hover:text-white">Notifications</a>
  <a class="pb-3 text-zinc-400 hover:text-white">Trade history</a>
</nav>
```
Toolbar kanan: tombol tanggal (`28 Aug - 15 Dec, 2024`), Filter, Share.

**Badge:**
| Varian | Kelas |
|---|---|
| Delta positif | `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-400/15 text-emerald-400` |
| Delta negatif | `... bg-red-400/15 text-red-400` |
| Status Success | `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-400/10 text-emerald-400 before:w-1.5 before:h-1.5 before:rounded-full before:bg-current` |
| Status Processing | `... bg-yellow-400/10 text-yellow-400` (dot sama) |
| Status Declined | `... bg-red-400/10 text-red-400` (dot sama) |

Pada kartu ungu, badge memakai `bg-white/15 text-white`.

---

## 6. Tailwind Configuration Snippet (`tailwind.config.js`)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#C084FC',
          500: '#A855F7',
          600: '#7E3FD1',
          900: '#3B2060',
        },
        accent: {
          pink: '#E879F9',
          yellow: '#FDE68A',
        },
        surface: {
          base: '#0F0F11',
          sidebar: '#1C1C1F',
          card: '#26262A',
          raised: '#323237',
        },
        frame: '#4A4A54',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-primary': '0 0 30px rgba(168, 85, 247, 0.35)',
        'glow-button': '0 0 16px rgba(168, 85, 247, 0.5)',
      },
      backgroundImage: {
        'card-primary': 'linear-gradient(180deg, #A855F7 0%, rgba(126,63,209,0.8) 100%)',
        'bar-progress': 'linear-gradient(90deg, #A855F7 0%, #E879F9 100%)',
        'area-chart': 'linear-gradient(180deg, rgba(168,85,247,0.6) 0%, transparent 100%)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

> Catatan: untuk Tailwind v4, pindahkan token ke blok `@theme { --color-primary-500: #A855F7; ... }` di file CSS utama.