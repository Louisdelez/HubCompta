// ============================================================================
// CATPPUCCIN COLORS - Finance Hub
// All 26 Catppuccin colors with CSS variable support for theme switching
// https://catppuccin.com
// ============================================================================

// RGB values for each Catppuccin flavor
export const CATPPUCCIN = {
  latte: {
    rosewater: '220 138 120',
    flamingo: '221 120 120',
    pink: '234 118 203',
    mauve: '136 57 239',
    red: '210 15 57',
    maroon: '230 69 83',
    peach: '254 100 11',
    yellow: '223 142 29',
    green: '64 160 43',
    teal: '23 146 153',
    sky: '4 165 229',
    sapphire: '32 159 181',
    blue: '30 102 245',
    lavender: '114 135 253',
    text: '76 79 105',
    subtext1: '92 95 119',
    subtext0: '108 111 133',
    overlay2: '124 127 147',
    overlay1: '140 143 161',
    overlay0: '156 160 176',
    surface2: '172 176 190',
    surface1: '188 192 204',
    surface0: '204 208 218',
    base: '239 241 245',
    mantle: '230 233 239',
    crust: '220 224 232',
  },
  frappe: {
    rosewater: '242 213 207',
    flamingo: '238 190 190',
    pink: '244 184 228',
    mauve: '202 158 230',
    red: '231 130 132',
    maroon: '234 153 156',
    peach: '239 159 118',
    yellow: '229 200 144',
    green: '166 209 137',
    teal: '129 200 190',
    sky: '153 209 219',
    sapphire: '133 193 220',
    blue: '140 170 238',
    lavender: '186 187 241',
    text: '198 208 245',
    subtext1: '181 191 226',
    subtext0: '165 173 206',
    overlay2: '148 156 187',
    overlay1: '131 139 167',
    overlay0: '115 121 148',
    surface2: '98 104 128',
    surface1: '81 87 109',
    surface0: '65 69 89',
    base: '48 52 70',
    mantle: '41 44 60',
    crust: '35 38 52',
  },
  macchiato: {
    rosewater: '244 219 214',
    flamingo: '240 198 198',
    pink: '245 189 230',
    mauve: '198 160 246',
    red: '237 135 150',
    maroon: '238 153 160',
    peach: '245 169 127',
    yellow: '238 212 159',
    green: '166 218 149',
    teal: '139 213 202',
    sky: '145 215 227',
    sapphire: '125 196 228',
    blue: '138 173 244',
    lavender: '183 189 248',
    text: '202 211 245',
    subtext1: '184 192 224',
    subtext0: '165 173 203',
    overlay2: '147 154 183',
    overlay1: '128 135 162',
    overlay0: '110 115 141',
    surface2: '91 96 120',
    surface1: '73 77 100',
    surface0: '54 58 79',
    base: '36 39 58',
    mantle: '30 32 48',
    crust: '24 25 38',
  },
  mocha: {
    rosewater: '245 224 220',
    flamingo: '242 205 205',
    pink: '245 194 231',
    mauve: '203 166 247',
    red: '243 139 168',
    maroon: '235 160 172',
    peach: '250 179 135',
    yellow: '249 226 175',
    green: '166 227 161',
    teal: '148 226 213',
    sky: '137 220 235',
    sapphire: '116 199 236',
    blue: '137 180 250',
    lavender: '180 190 254',
    text: '205 214 244',
    subtext1: '186 194 222',
    subtext0: '166 173 200',
    overlay2: '147 153 178',
    overlay1: '127 132 156',
    overlay0: '108 112 134',
    surface2: '88 91 112',
    surface1: '69 71 90',
    surface0: '49 50 68',
    base: '30 30 46',
    mantle: '24 24 37',
    crust: '17 17 27',
  },
} as const;

// CSS variable names for runtime theme support
export const CTP_COLORS = {
  rosewater: 'var(--ctp-rosewater)',
  flamingo: 'var(--ctp-flamingo)',
  pink: 'var(--ctp-pink)',
  mauve: 'var(--ctp-mauve)',
  red: 'var(--ctp-red)',
  maroon: 'var(--ctp-maroon)',
  peach: 'var(--ctp-peach)',
  yellow: 'var(--ctp-yellow)',
  green: 'var(--ctp-green)',
  teal: 'var(--ctp-teal)',
  sky: 'var(--ctp-sky)',
  sapphire: 'var(--ctp-sapphire)',
  blue: 'var(--ctp-blue)',
  lavender: 'var(--ctp-lavender)',
} as const;

// Helper to get RGB color string for use in styles
export function ctpColor(color: keyof typeof CTP_COLORS, alpha = 1): string {
  return `rgb(${CTP_COLORS[color]} / ${alpha})`;
}

// Chart colors array - uses all 14 accent colors in a visually pleasing order
export const CHART_COLORS_CSS = [
  'rgb(var(--ctp-blue))',
  'rgb(var(--ctp-green))',
  'rgb(var(--ctp-peach))',
  'rgb(var(--ctp-mauve))',
  'rgb(var(--ctp-teal))',
  'rgb(var(--ctp-pink))',
  'rgb(var(--ctp-yellow))',
  'rgb(var(--ctp-sapphire))',
  'rgb(var(--ctp-red))',
  'rgb(var(--ctp-lavender))',
  'rgb(var(--ctp-sky))',
  'rgb(var(--ctp-flamingo))',
  'rgb(var(--ctp-maroon))',
  'rgb(var(--ctp-rosewater))',
];

// Avatar/User colors - distinct colors for different users
export const AVATAR_COLORS_CSS = [
  'rgb(var(--ctp-blue))',
  'rgb(var(--ctp-green))',
  'rgb(var(--ctp-mauve))',
  'rgb(var(--ctp-peach))',
  'rgb(var(--ctp-pink))',
  'rgb(var(--ctp-teal))',
  'rgb(var(--ctp-sapphire))',
  'rgb(var(--ctp-lavender))',
  'rgb(var(--ctp-yellow))',
  'rgb(var(--ctp-flamingo))',
  'rgb(var(--ctp-sky))',
  'rgb(var(--ctp-maroon))',
  'rgb(var(--ctp-red))',
  'rgb(var(--ctp-rosewater))',
];

// Semantic color mappings
export const SEMANTIC_COLORS = {
  // Status colors
  success: 'rgb(var(--ctp-green))',
  warning: 'rgb(var(--ctp-yellow))',
  danger: 'rgb(var(--ctp-red))',
  info: 'rgb(var(--ctp-sky))',

  // Financial colors
  income: 'rgb(var(--ctp-green))',
  expense: 'rgb(var(--ctp-red))',
  transfer: 'rgb(var(--ctp-blue))',
  investment: 'rgb(var(--ctp-mauve))',

  // Notification types
  alert: 'rgb(var(--ctp-peach))',
  reminder: 'rgb(var(--ctp-sky))',
  update: 'rgb(var(--ctp-sapphire))',

  // Budget states
  budgetHealthy: 'rgb(var(--ctp-green))',
  budgetWarning: 'rgb(var(--ctp-yellow))',
  budgetOver: 'rgb(var(--ctp-red))',
  budgetNearLimit: 'rgb(var(--ctp-peach))',
} as const;

// Investment type colors
export const INVESTMENT_TYPE_COLORS = {
  stock: 'rgb(var(--ctp-blue))',
  etf: 'rgb(var(--ctp-sapphire))',
  crypto: 'rgb(var(--ctp-peach))',
  bond: 'rgb(var(--ctp-teal))',
  fund: 'rgb(var(--ctp-mauve))',
  commodity: 'rgb(var(--ctp-yellow))',
  forex: 'rgb(var(--ctp-green))',
  other: 'rgb(var(--ctp-lavender))',
} as const;

// Notification icon colors by type
export const NOTIFICATION_COLORS = {
  budget_alert: 'rgb(var(--ctp-peach))',
  budget_exceeded: 'rgb(var(--ctp-red))',
  price_alert: 'rgb(var(--ctp-blue))',
  bill_reminder: 'rgb(var(--ctp-sky))',
  import_complete: 'rgb(var(--ctp-green))',
  export_ready: 'rgb(var(--ctp-mauve))',
  invoice_paid: 'rgb(var(--ctp-green))',
  invoice_overdue: 'rgb(var(--ctp-red))',
  transaction_categorized: 'rgb(var(--ctp-sapphire))',
  goal_reached: 'rgb(var(--ctp-green))',
  goal_progress: 'rgb(var(--ctp-teal))',
  settlement_due: 'rgb(var(--ctp-yellow))',
  member_joined: 'rgb(var(--ctp-pink))',
  member_left: 'rgb(var(--ctp-flamingo))',
} as const;

// Tailwind class mappings for components
export const CTP_TAILWIND = {
  // Background colors
  bg: {
    rosewater: 'bg-ctp-rosewater',
    flamingo: 'bg-ctp-flamingo',
    pink: 'bg-ctp-pink',
    mauve: 'bg-ctp-mauve',
    red: 'bg-ctp-red',
    maroon: 'bg-ctp-maroon',
    peach: 'bg-ctp-peach',
    yellow: 'bg-ctp-yellow',
    green: 'bg-ctp-green',
    teal: 'bg-ctp-teal',
    sky: 'bg-ctp-sky',
    sapphire: 'bg-ctp-sapphire',
    blue: 'bg-ctp-blue',
    lavender: 'bg-ctp-lavender',
  },
  // Text colors
  text: {
    rosewater: 'text-ctp-rosewater',
    flamingo: 'text-ctp-flamingo',
    pink: 'text-ctp-pink',
    mauve: 'text-ctp-mauve',
    red: 'text-ctp-red',
    maroon: 'text-ctp-maroon',
    peach: 'text-ctp-peach',
    yellow: 'text-ctp-yellow',
    green: 'text-ctp-green',
    teal: 'text-ctp-teal',
    sky: 'text-ctp-sky',
    sapphire: 'text-ctp-sapphire',
    blue: 'text-ctp-blue',
    lavender: 'text-ctp-lavender',
  },
  // Border colors
  border: {
    rosewater: 'border-ctp-rosewater',
    flamingo: 'border-ctp-flamingo',
    pink: 'border-ctp-pink',
    mauve: 'border-ctp-mauve',
    red: 'border-ctp-red',
    maroon: 'border-ctp-maroon',
    peach: 'border-ctp-peach',
    yellow: 'border-ctp-yellow',
    green: 'border-ctp-green',
    teal: 'border-ctp-teal',
    sky: 'border-ctp-sky',
    sapphire: 'border-ctp-sapphire',
    blue: 'border-ctp-blue',
    lavender: 'border-ctp-lavender',
  },
} as const;

export type CatppuccinAccentColor = keyof typeof CTP_COLORS;
export type CatppuccinFlavor = keyof typeof CATPPUCCIN;
