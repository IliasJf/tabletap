import type {
  Catalog,
  LocalizedText,
  MenuCategory,
  MenuItem,
  MenuOption,
} from "./types";

const text = (en: string, fr: string, ar: string): LocalizedText => ({
  en,
  fr,
  ar,
});
const extra = (
  id: string,
  en: string,
  fr: string,
  ar: string,
  price: number,
): MenuOption => ({ id, label: text(en, fr, ar), price });
const egg = extra("egg", "Free-range egg", "Œuf fermier", "بيضة بلدية", 1200);
const avocado = extra(
  "avocado",
  "Extra avocado",
  "Supplément avocat",
  "أفوكادو إضافي",
  1500,
);
const oat = extra("oat", "Oat milk", "Lait d’avoine", "حليب الشوفان", 600);

export const defaultCategories: MenuCategory[] = [
  {
    id: "brunch",
    name: text("All-day brunch", "Brunch toute la journée", "فطور طوال اليوم"),
  },
  {
    id: "mains",
    name: text("Fresh plates", "Assiettes fraîches", "أطباق طازجة"),
  },
  {
    id: "coffee",
    name: text("Coffee & drinks", "Café & boissons", "قهوة ومشروبات"),
  },
  { id: "desserts", name: text("Something sweet", "Douceurs", "حلويات") },
];

export const menuItems: MenuItem[] = [
  {
    id: "avocado-toast",
    category: "brunch",
    name: text("The green toast", "La tartine verte", "توست الأفوكادو"),
    description: text(
      "Sourdough, fresh avocado, tomatoes & a little chili crunch.",
      "Pain au levain, avocat, tomates et piment croustillant.",
      "خبز العجين المخمر، أفوكادو، طماطم ولمسة فلفل مقرمش.",
    ),
    price: 6800,
    image: "/images/toast.jpg",
    tags: ["vegetarian", "popular"],
    available: true,
    options: [egg, avocado],
  },
  {
    id: "shakshuka",
    category: "brunch",
    name: text("Morning shakshuka", "Chakchouka du matin", "شكشوكة الصباح"),
    description: text(
      "Slow-cooked tomatoes, soft eggs, cumin & warm sourdough.",
      "Tomates mijotées, œufs, cumin et pain au levain chaud.",
      "طماطم مطهوة ببطء، بيض، كمون وخبز دافئ.",
    ),
    price: 7200,
    image: "/images/shakshuka.jpg",
    tags: ["vegetarian", "signature"],
    available: true,
    options: [egg],
  },
  {
    id: "pancakes",
    category: "brunch",
    name: text("Sunday pancakes", "Pancakes du dimanche", "بانكيك الأحد"),
    description: text(
      "Fluffy pancakes, seasonal berries, vanilla yogurt & maple syrup.",
      "Pancakes moelleux, fruits rouges, yaourt vanille et sirop d’érable.",
      "بانكيك هش، توت موسمي، زبادي بالفانيلا وشراب القيقب.",
    ),
    price: 6400,
    image: "/images/pancakes.jpg",
    tags: ["vegetarian"],
    available: true,
    options: [
      extra(
        "berries",
        "Extra berries",
        "Fruits rouges en plus",
        "توت إضافي",
        1000,
      ),
    ],
  },
  {
    id: "harvest-bowl",
    category: "mains",
    name: text("The harvest bowl", "Le bowl du marché", "طبق الحصاد"),
    description: text(
      "Roasted sweet potato, chickpeas, grains, greens & lemon tahini.",
      "Patate douce rôtie, pois chiches, céréales, salade et tahini citronné.",
      "بطاطا حلوة مشوية، حمص، حبوب، خضار وطحينة بالليمون.",
    ),
    price: 8400,
    image: "/images/bowl.jpg",
    tags: ["vegan", "signature"],
    available: true,
    options: [avocado],
  },
  {
    id: "garden-salad",
    category: "mains",
    name: text("Garden & grains", "Salade du jardin", "سلطة الحديقة"),
    description: text(
      "Seasonal leaves, toasted grains, orange, feta & house vinaigrette.",
      "Salade de saison, céréales toastées, orange, feta et vinaigrette maison.",
      "خضار موسمية، حبوب محمصة، برتقال، فيتا وصلصة المنزل.",
    ),
    price: 7600,
    image: "/images/salad.jpg",
    tags: ["vegetarian"],
    available: true,
    options: [avocado],
  },
  {
    id: "flat-white",
    category: "coffee",
    name: text("Flat white", "Flat white", "فلات وايت"),
    description: text(
      "A double espresso with silky steamed milk. Small, strong, lovely.",
      "Double espresso et lait soyeux. Petit, intense et délicieux.",
      "إسبريسو مزدوج مع حليب مبخر ناعم. صغير وغني بالنكهة.",
    ),
    price: 3200,
    image: "/images/coffee.jpg",
    tags: ["popular"],
    available: true,
    options: [
      oat,
      extra(
        "shot",
        "Extra espresso shot",
        "Dose d’espresso",
        "جرعة إسبريسو إضافية",
        800,
      ),
    ],
  },
  {
    id: "iced-latte",
    category: "coffee",
    name: text(
      "Iced vanilla latte",
      "Latte glacé vanille",
      "لاتيه مثلج بالفانيلا",
    ),
    description: text(
      "Espresso, chilled milk, real vanilla & plenty of ice.",
      "Espresso, lait froid, vraie vanille et glaçons.",
      "إسبريسو، حليب بارد، فانيلا طبيعية وثلج.",
    ),
    price: 3800,
    image: "/images/iced-latte.jpg",
    tags: ["vegetarian"],
    available: true,
    options: [oat],
  },
  {
    id: "moroccan-tea",
    category: "coffee",
    name: text("Fresh mint tea", "Thé à la menthe", "شاي بالنعناع"),
    description: text(
      "Green tea, a generous handful of mint & a moment to slow down.",
      "Thé vert, menthe fraîche et un moment de douceur.",
      "شاي أخضر، نعناع طازج ولحظة هدوء.",
    ),
    price: 2600,
    image: "/images/mint-tea.jpg",
    tags: ["vegan"],
    available: true,
    options: [],
  },
  {
    id: "almond-croissant",
    category: "desserts",
    name: text("Butter croissant", "Croissant au beurre", "كرواسون بالزبدة"),
    description: text(
      "Golden, flaky layers and a generous touch of butter.",
      "Un feuilletage doré et croustillant au bon beurre.",
      "طبقات ذهبية هشة بلمسة غنية من الزبدة.",
    ),
    price: 3400,
    image: "/images/pastry.jpg",
    tags: ["vegetarian"],
    available: true,
    options: [],
  },
  {
    id: "berry-cheesecake",
    category: "desserts",
    name: text(
      "Berry cheesecake",
      "Cheesecake aux fruits rouges",
      "تشيز كيك بالتوت",
    ),
    description: text(
      "Creamy vanilla cheesecake, berry compote & a biscuit base.",
      "Cheesecake vanille, compotée de fruits rouges et biscuit croustillant.",
      "تشيز كيك كريمي بالفانيلا، كومبوت التوت وقاعدة بسكويت.",
    ),
    price: 4600,
    image: "/images/cheesecake.jpg",
    tags: ["vegetarian"],
    available: true,
    options: [],
  },
  {
    id: "orange-cake",
    category: "desserts",
    name: text(
      "Orange blossom cake",
      "Gâteau fleur d’oranger",
      "كيك بماء الزهر",
    ),
    description: text(
      "Olive oil sponge, orange blossom glaze & pistachio crumble.",
      "Gâteau à l’huile d’olive, glaçage fleur d’oranger et pistaches.",
      "كيك بزيت الزيتون، كريمة ماء الزهر وفستق.",
    ),
    price: 4200,
    image: "/images/orange-cake.jpg",
    tags: ["vegetarian"],
    available: false,
    options: [],
  },
];

export const seedCatalog: Catalog = {
  settings: {
    name: "Olive & Ember",
    tagline: "Good food. Slow mornings.",
    description:
      "A little neighborhood café for long brunches, good coffee, and the people you love. Fresh ingredients, a warm table, and no reason to rush.",
    address: "Casablanca, Morocco · Demo café",
    hours: "Every day · 8:00–20:00",
    whatsapp: "",
    currency: "MAD",
    deliveryFee: 1500,
    publicUrl: "",
    slug: "",
  },
  categories: defaultCategories,
  items: menuItems,
  revision: 0,
};

export function createSeedCatalog(): Catalog {
  return structuredClone(seedCatalog);
}
