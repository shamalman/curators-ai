// ── Theme: shared base ──
export const T = {
  bg: "#131210", bg2: "#1A1714", s: "#201D18", s2: "#2A2620", s3: "#332F28",
  ink: "#E8E2D6", ink2: "#A09888", ink3: "#6B6258",
  bdr: "#302B25", acc: "#D4956B", accText: "#131210", accSoft: "#D4956B20",
};

// ── Curator workspace: cooler, blue-shifted ──
export const W = {
  bg: "#101214", s: "#181B20", s2: "#1F2329", bdr: "#262B33",
  aiBub: "#181B20", aiBdr: "#3B7BF6", aiBdrSoft: "#3B7BF620",
  userBub: T.acc, userTxt: "#101214",
  accent: "#6B9EC2", accentSoft: "#6B9EC220",
  chip: "#181B20", chipBdr: "#262B33",
  inputBg: "#181B20", inputBdr: "#262B33",
};

// ── Visitor AI: warm, personal ──
export const V = {
  bg: "#151310", s: "#1E1A15", bdr: "#302A22",
  aiBub: "#1E1A15", userBub: "#A09888", userTxt: "#151310",
  chip: "#1E1A15", chipBdr: "#302A22",
  inputBg: "#1E1A15", inputBdr: "#302A22",
};

// ── Fonts ──
export const F = "'Manrope',sans-serif";
export const S = "'Newsreader',serif";
export const MN = "'JetBrains Mono',monospace";

// ── Category config ──
export const CAT = {
  restaurant: { emoji: "\u{1F37D}", color: "#C8956C", bg: "#C8956C18", label: "Restaurants" },
  book: { emoji: "\u{1F4D6}", color: "#8B8BDB", bg: "#8B8BDB18", label: "Books" },
  music: { emoji: "\u{1F3B5}", color: "#C27BA0", bg: "#C27BA018", label: "Music" },
  tv: { emoji: "\u{1F4FA}", color: "#9B8BC2", bg: "#9B8BC218", label: "TV & Film" },
  film: { emoji: "\u{1F4FA}", color: "#9B8BC2", bg: "#9B8BC218", label: "TV & Film" },
  travel: { emoji: "\u2708\uFE0F", color: "#6BAA8E", bg: "#6BAA8E18", label: "Travel" },
  product: { emoji: "\u26A1", color: "#6B9EC2", bg: "#6B9EC218", label: "Products" },
  other: { emoji: "\u25C6", color: "#8B8B8B", bg: "#8B8B8B18", label: "Other" },
};

// ── Earnings config (mock data) ──
export const EARNINGS = {
  total: 1247,
  streams: {
    tips: { amount: 412, count: 63, color: "#6BAA8E", icon: "\u2615", label: "Tips", trend: "+$87 this month" },
    subs: { amount: 508, count: 12, color: "#C7956D", icon: "\uD83D\uDD12", label: "Subscriptions", trend: "+$42 this month" },
    license: { amount: 250, count: 2, color: "#8B7EC8", icon: "\uD83D\uDCDC", label: "Licensing", trend: "1 pending inquiry" },
    bundles: { amount: 77, count: 11, color: "#5B9BD5", icon: "\uD83D\uDCE6", label: "Bundles", trend: "+$21 this month" },
  },
  topRecs: [
    { title: "Kin Khao", category: "restaurant", earned: 285, sources: "\u2615 $180 tips \u00B7 \uD83D\uDCE6 $105 bundles" },
    { title: "Parable of the Sower", category: "book", earned: 230, sources: "\uD83D\uDCDC $150 license \u00B7 \u2615 $80 tips" },
    { title: "Bar Agricole", category: "restaurant", earned: 195, sources: "\uD83D\uDCDC $100 license \u00B7 \uD83D\uDCE6 $60 bundles \u00B7 \u2615 $35 tips" },
    { title: "Khruangbin \u2014 Con Todo El Mundo", category: "music", earned: 142, sources: "\u2615 $117 tips \u00B7 \uD83D\uDD12 $25 subs" },
  ],
  transactions: {
    tips: [
      { from: "Jessica", amount: 5, rec: "Kin Khao", message: "Crab fried rice was unreal!", time: "2h ago" },
      { from: "Marcus", amount: 10, rec: "Parable of the Sower", message: "Buying copies for friends now.", time: "Yesterday" },
      { from: "Priya", amount: 25, rec: "Kin Khao", message: "Best meal I've had in SF. Period.", time: "2d ago" },
      { from: "Tom", amount: 3, rec: "Khruangbin", message: "", time: "3d ago" },
      { from: "Aiko", amount: 10, rec: "Kin Khao", message: "Took my parents, they loved it", time: "4d ago" },
      { from: "Diego", amount: 5, rec: "Bar Agricole", message: "Perfect date spot, thanks!", time: "5d ago" },
      { from: "Sarah", amount: 15, rec: "Parable of the Sower", message: "This book changed my perspective", time: "1w ago" },
    ],
    subs: [
      { from: "New subscriber", amount: 42, rec: "Monthly", message: "", time: "Today" },
      { from: "Emily R.", amount: 42, rec: "Renewal", message: "", time: "3d ago" },
      { from: "New subscriber", amount: 42, rec: "Monthly", message: "", time: "1w ago" },
    ],
    license: [
      { from: "Eater SF", amount: 150, rec: "Parable of the Sower", message: "Digital and social use license", time: "Jan 2026" },
      { from: "Taste Collective", amount: 100, rec: "Bar Agricole", message: "Social media feature", time: "Dec 2025" },
    ],
    bundles: [
      { from: "Anonymous", amount: 7, rec: "SF Essentials", message: "", time: "1d ago" },
      { from: "Chris M.", amount: 7, rec: "SF Essentials", message: "", time: "3d ago" },
      { from: "Anonymous", amount: 7, rec: "SF Essentials", message: "", time: "5d ago" },
    ],
  },
};

// ── Requests mock data ──
export const REQUESTS_DATA = [
  { id: "r1", from: "Maria", handle: "@maria", text: "Looking for music that's soulful but also good for working?", category: "music", date: "2026-02-14T10:30:00", status: "new", aiDraft: "Based on your taste, I'd suggest **Emancipator** \u2014 beautiful instrumentals that are introspective but have great rhythm. Perfect for focus. **Michael Kiwanuka** is another option if you want something with vocals." },
  { id: "r2", from: "David", handle: "@david", text: "A book that will really move me emotionally?", category: "book", date: "2026-02-13T16:00:00", status: "new", aiDraft: "**When Breath Becomes Air** by Paul Kalanithi is exactly what you're looking for. A neurosurgeon writing about his own mortality with incredible prose. It will stay with you." },
  { id: "r3", from: "Jess", handle: "@jess", text: "Need a special date night restaurant - somewhere memorable?", category: "restaurant", date: "2026-02-12T09:15:00", status: "new", aiDraft: "**Delfina** is perfect for this. Inventive, progressive food that's a real adventure. Great for someone who appreciates quality and creativity in their meal." },
];

// ── Tier config ──
export const DEFAULT_TIERS = [
  { id: "free", name: "Free", price: 0, color: "#6BAA8E" },
  { id: "plus", name: "Plus", price: 5, color: "#C8956C" },
  { id: "pro", name: "Pro", price: 15, color: "#9B8BC2" },
];

// ── Bundle config ──
export const DEFAULT_BUNDLES = [
  { id: "b1", name: "SF Restaurant Guide", count: 4, price: 12 },
  { id: "b2", name: "Road Trip Essentials", count: 3, price: 8 },
];

// ── License types ──
export const LICENSE_TYPES = [
  { id: "social", label: "Social media", desc: "Instagram, TikTok, X" },
  { id: "digital", label: "Digital / web", desc: "Websites, newsletters, ads" },
  { id: "print", label: "Print", desc: "Magazines, billboards, packaging" },
];
