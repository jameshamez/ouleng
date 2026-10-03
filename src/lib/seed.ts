// Starter data for อูเล้งคาเฟ่ แก้วอินทร์. Menu names come from public reviews;
// prices are placeholders — the shop should correct them in /staff/admin.
// Kept free of path aliases so scripts/seed-supabase.ts can import it via tsx.
import type { MenuCategory, MenuItem, OptionGroup, Table } from "./types";

const spicy: OptionGroup = {
  name: "ความเผ็ด",
  required: true,
  multi: false,
  choices: [
    { label: "ไม่เผ็ด", price: 0 },
    { label: "เผ็ดน้อย", price: 0 },
    { label: "เผ็ดกลาง", price: 0 },
    { label: "เผ็ดมาก", price: 0 },
  ],
};
const somtamExtras: OptionGroup = {
  name: "เพิ่ม",
  required: false,
  multi: true,
  choices: [
    { label: "ปูดอง", price: 10 },
    { label: "ปลาร้า", price: 0 },
    { label: "ไข่เค็ม", price: 15 },
    { label: "หมูยอ", price: 20 },
  ],
};
const sweet: OptionGroup = {
  name: "ความหวาน",
  required: true,
  multi: false,
  choices: [
    { label: "หวานน้อย", price: 0 },
    { label: "หวานปกติ", price: 0 },
    { label: "หวานมาก", price: 0 },
  ],
};
const temp: OptionGroup = {
  name: "แบบ",
  required: true,
  multi: false,
  choices: [
    { label: "เย็น", price: 0 },
    { label: "ร้อน", price: 0 },
    { label: "ปั่น", price: 10 },
  ],
};
const steamOrFry: OptionGroup = {
  name: "แบบ",
  required: true,
  multi: false,
  choices: [
    { label: "นึ่ง", price: 0 },
    { label: "ทอด", price: 5 },
  ],
};
const rice: OptionGroup = {
  name: "เพิ่ม",
  required: false,
  multi: true,
  choices: [
    { label: "ไข่ดาว", price: 10 },
    { label: "ไข่เจียว", price: 15 },
  ],
};

export const seedCategories: MenuCategory[] = [
  { id: "c-somtam", name: "ส้มตำ", emoji: "🥗", sort: 1 },
  { id: "c-yum", name: "ลาบ & ยำ", emoji: "🌿", sort: 2 },
  { id: "c-grill", name: "ย่าง & ทอด", emoji: "🔥", sort: 3 },
  { id: "c-rice", name: "ข้าว & กับข้าว", emoji: "🍚", sort: 4 },
  { id: "c-mookata", name: "หมูกระทะ", emoji: "🥓", sort: 5 },
  { id: "c-tea", name: "เซลอง & โกปี้", emoji: "🧋", sort: 6 },
  { id: "c-dimsum", name: "ติ่มซำ & เปา", emoji: "🥟", sort: 7 },
  { id: "c-dessert", name: "ขนมภูเก็ต", emoji: "🍞", sort: 8 },
];

type Seed = Omit<MenuItem, "image_url" | "is_available" | "sort" | "is_signature" | "options" | "description"> &
  Partial<Pick<MenuItem, "is_signature" | "options" | "description">>;

const rows: Seed[] = [
  { id: "m-tam-thai", category_id: "c-somtam", name: "ตำไทย", price: 60, emoji: "🥗", station: "somtam", options: [spicy, somtamExtras], description: "มะละกอสด ถั่วฝักยาว มะเขือเทศ กุ้งแห้ง ถั่วลิสง" },
  { id: "m-tam-pu-plara", category_id: "c-somtam", name: "ตำปูปลาร้า", price: 60, emoji: "🦀", station: "somtam", options: [spicy, somtamExtras], description: "นัวเข้มแบบอีสานแท้", is_signature: true },
  { id: "m-tam-sua", category_id: "c-somtam", name: "ตำซั่ว", price: 70, emoji: "🍜", station: "somtam", options: [spicy, somtamExtras], description: "ตำใส่ขนมจีน เส้นนุ่มคลุกน้ำปลาร้า" },
  { id: "m-tam-corn", category_id: "c-somtam", name: "ตำข้าวโพดไข่เค็ม", price: 79, emoji: "🌽", station: "somtam", options: [spicy], description: "ข้าวโพดหวานกรอบ ไข่เค็มมันๆ" },
  { id: "m-tam-tray", category_id: "c-somtam", name: "ตำถาดรวมมิตร", price: 199, emoji: "🧺", station: "somtam", options: [spicy], description: "ตำ + ขนมจีน + หมูยอ + ไข่ต้ม + ผักเคียง สำหรับ 2–3 ท่าน", is_signature: true },
  { id: "m-larb-moo", category_id: "c-yum", name: "ลาบหมู", price: 79, emoji: "🌿", station: "somtam", options: [spicy] },
  { id: "m-namtok", category_id: "c-yum", name: "น้ำตกหมู", price: 89, emoji: "🥩", station: "somtam", options: [spicy] },
  { id: "m-yum-seafood", category_id: "c-yum", name: "ยำทะเลรวมมิตร", price: 159, emoji: "🦑", station: "somtam", options: [spicy], description: "กุ้ง หมึก หอยแมลงภู่ น้ำยำรสจัด" },
  { id: "m-kor-moo", category_id: "c-grill", name: "คอหมูย่าง", price: 99, emoji: "🍖", station: "somtam", description: "ย่างเตาถ่าน เสิร์ฟพร้อมน้ำจิ้มแจ่ว", is_signature: true },
  { id: "m-gai-yang", category_id: "c-grill", name: "ไก่ย่างครึ่งตัว", price: 129, emoji: "🍗", station: "somtam" },
  { id: "m-pla-kapong", category_id: "c-grill", name: "ปลากะพงทอดน้ำปลา", price: 299, emoji: "🐟", station: "somtam", description: "ทั้งตัว ทอดกรอบ เสิร์ฟพร้อมยำมะม่วง" },
  { id: "m-goong-ob", category_id: "c-grill", name: "กุ้งอบวุ้นเส้น", price: 259, emoji: "🦐", station: "somtam" },
  { id: "m-khao-niao", category_id: "c-grill", name: "ข้าวเหนียว", price: 15, emoji: "🍙", station: "somtam" },
  { id: "m-kaprao-goong", category_id: "c-rice", name: "กะเพราโบราณกุ้ง", price: 89, emoji: "🍳", station: "somtam", options: [spicy, rice], description: "รสจัดจ้านแบบโบราณ" },
  { id: "m-khaopad-moo", category_id: "c-rice", name: "ข้าวผัดโบราณหมู", price: 69, emoji: "🍛", station: "somtam", options: [rice] },
  { id: "m-mookata-2", category_id: "c-mookata", name: "ชุดหมูกระทะ 2 ท่าน", price: 399, emoji: "🥓", station: "somtam", description: "หมูสามชั้น สันคอ ทะเล ผักรวม วุ้นเส้น น้ำจิ้มสูตรร้าน", is_signature: true },
  { id: "m-mookata-4", category_id: "c-mookata", name: "ชุดหมูกระทะ 4 ท่าน", price: 749, emoji: "🥓", station: "somtam" },
  { id: "m-selong-ouleng", category_id: "c-tea", name: "เซลองอูเล้ง (ชานม)", price: 45, emoji: "🧋", station: "cafe", options: [temp, sweet], description: "ชาหอมผสมนมสด หวานมันกำลังดี เมนูขายดีของร้าน", is_signature: true },
  { id: "m-selong", category_id: "c-tea", name: "เซลอง (ชาดำเย็น)", price: 39, emoji: "🥤", station: "cafe", options: [temp, sweet] },
  { id: "m-selong-lime", category_id: "c-tea", name: "เซลองมะนาว", price: 45, emoji: "🍋", station: "cafe", options: [temp, sweet] },
  { id: "m-kopi-selong", category_id: "c-tea", name: "โกปี้เซลอง", price: 49, emoji: "☕", station: "cafe", options: [temp, sweet], description: "ชาผสมกาแฟแบบภูเก็ต" },
  { id: "m-kopi-jumba", category_id: "c-tea", name: "โกปี้จ้ำบ๊ะ", price: 55, emoji: "☕", station: "cafe", options: [temp, sweet] },
  { id: "m-milk", category_id: "c-tea", name: "นมสด", price: 45, emoji: "🥛", station: "cafe", options: [temp, sweet] },
  { id: "m-pao-lava", category_id: "c-dimsum", name: "เปาไข่เค็มลาวา (2 ลูก)", price: 49, emoji: "🥟", station: "cafe", options: [steamOrFry], description: "ไส้ไข่เค็มเยิ้มๆ ขายดีอันดับหนึ่ง", is_signature: true },
  { id: "m-pao-cream", category_id: "c-dimsum", name: "เปาครีม (4 ลูก)", price: 49, emoji: "🥟", station: "cafe", options: [steamOrFry] },
  { id: "m-pao-moodaeng", category_id: "c-dimsum", name: "เปาหมูแดง (4 ลูก)", price: 59, emoji: "🥟", station: "cafe", options: [steamOrFry] },
  { id: "m-pao-five", category_id: "c-dimsum", name: "เปารวมห้าสหายทอด", price: 49, emoji: "🥠", station: "cafe" },
  { id: "m-kanomjeeb-goong", category_id: "c-dimsum", name: "ขนมจีบกุ้ง (4 ลูก)", price: 69, emoji: "🍤", station: "cafe" },
  { id: "m-kanomjeeb-moo", category_id: "c-dimsum", name: "ขนมจีบหมู (4 ลูก)", price: 59, emoji: "🥟", station: "cafe" },
  { id: "m-pang-sangkaya", category_id: "c-dessert", name: "ขนมปังสังขยาภูเก็ต", price: 49, emoji: "🍞", station: "cafe", description: "สังขยาใบเตยสูตรภูเก็ต ขนมปังปิ้งกรอบ", is_signature: true },
  { id: "m-oh-aew", category_id: "c-dessert", name: "โอ้เอ๋วภูเก็ต", price: 59, emoji: "🍧", station: "cafe", description: "วุ้นโอ้เอ๋วใส น้ำแข็งไส ถั่วแดง" },
  { id: "m-patongko", category_id: "c-dessert", name: "โก๋มาเป็นชุด (ปาท่องโก๋สังขยา)", price: 59, emoji: "🥖", station: "cafe" },
];

export const seedMenuItems: MenuItem[] = rows.map((r, i) => ({
  description: "",
  options: [],
  is_signature: false,
  ...r,
  image_url: null,
  is_available: true,
  sort: i,
}));

const t = (code: string, zone: Table["zone"], seats: number): Table => ({ id: `t-${code}`, code, zone, seats });

export const seedTables: Table[] = [
  t("A1", "indoor", 2), t("A2", "indoor", 2), t("A3", "indoor", 4), t("A4", "indoor", 4),
  t("A5", "indoor", 4), t("A6", "indoor", 4), t("A7", "indoor", 6), t("A8", "indoor", 6),
  t("C1", "canal", 2), t("C2", "canal", 2), t("C3", "canal", 4), t("C4", "canal", 4),
  t("C5", "canal", 4), t("C6", "canal", 4), t("C7", "canal", 8),
];
