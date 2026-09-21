import type { IconName } from "@/components/Icon";
import type { Locale } from "@/i18n/routing";

export interface Service {
  title: string;
  blurb: string;
  atHome?: boolean;
  /** WhatsApp topic; when absent the card links to `href` instead */
  topic?: string;
  href?: string;
  linkLabel: string;
  photoAlt: string;
}

const SERVICES: Record<Locale, Service[]> = {
  ar: [
    {
      title: "إكسسوارات وبودي كيت",
      blurb: "شبك أمامي، صدامات، جناح خلفي، وشعارات الإصدار الأسود.",
      atHome: true,
      topic: "الإكسسوارات والبودي كيت",
      linkLabel: "استفسر عبر واتساب",
      photoAlt: "صورة بودي كيت",
    },
    {
      title: "حماية الطلاء PPF",
      blurb: "فيلم حماية XPEL لجميع أنواع السيارات.",
      topic: "حماية الطلاء PPF",
      linkLabel: "استفسر عبر واتساب",
      photoAlt: "صورة PPF",
    },
    {
      title: "عازل وتظليل",
      blurb: "عازل حراري وتظليل للزجاج.",
      atHome: true,
      topic: "العازل والتظليل",
      linkLabel: "استفسر عبر واتساب",
      photoAlt: "صورة تظليل",
    },
    {
      title: "برمجة وتشخيص",
      blurb: "برمجة وتحديثات، باشتراك سنوي أو لمرة واحدة.",
      atHome: true,
      topic: "البرمجة والتشخيص",
      linkLabel: "استفسر عبر واتساب",
      photoAlt: "صورة برمجة",
    },
    {
      title: "قطع غيار",
      blurb: "قطع للسيارات الصينية وغير الصينية.",
      href: "#catalog",
      linkLabel: "تصفح الفئات",
      photoAlt: "صورة قطع غيار",
    },
    {
      title: "زيوت وصيانة",
      blurb: "تغيير الزيت والفلاتر والصيانة الدورية.",
      topic: "الزيوت والصيانة",
      linkLabel: "استفسر عبر واتساب",
      photoAlt: "صورة صيانة",
    },
  ],
  en: [
    {
      title: "Accessories & Body Kits",
      blurb: "Front grilles, bumpers, rear spoilers, and Black Edition badges.",
      atHome: true,
      topic: "Accessories & body kits",
      linkLabel: "Ask on WhatsApp",
      photoAlt: "Body kit photo",
    },
    {
      title: "PPF Paint Protection",
      blurb: "XPEL protective film for all car types.",
      topic: "PPF paint protection",
      linkLabel: "Ask on WhatsApp",
      photoAlt: "PPF photo",
    },
    {
      title: "Insulation & Tinting",
      blurb: "Heat insulation and window tinting.",
      atHome: true,
      topic: "Insulation & tinting",
      linkLabel: "Ask on WhatsApp",
      photoAlt: "Tinting photo",
    },
    {
      title: "Programming & Diagnostics",
      blurb: "Programming and updates, yearly subscription or one-time.",
      atHome: true,
      topic: "Programming & diagnostics",
      linkLabel: "Ask on WhatsApp",
      photoAlt: "Programming photo",
    },
    {
      title: "Spare Parts",
      blurb: "Parts for Chinese and non-Chinese cars.",
      href: "#catalog",
      linkLabel: "Browse categories",
      photoAlt: "Spare parts photo",
    },
    {
      title: "Oils & Maintenance",
      blurb: "Oil changes, filters, and routine maintenance.",
      topic: "Oils & maintenance",
      linkLabel: "Ask on WhatsApp",
      photoAlt: "Maintenance photo",
    },
  ],
};

export interface Category {
  icon: IconName;
  title: string;
  items: string[];
  topic: string;
}

const CATEGORIES: Record<Locale, Category[]> = {
  ar: [
    {
      icon: "shield",
      title: "الحماية",
      items: ["حماية الشاشة ولوحة العدادات", "رفارف وملصقات حماية", "حصائر سيليكون"],
      topic: "قطع الحماية",
    },
    {
      icon: "car",
      title: "الشكل الخارجي",
      items: ["شبك أمامي (صيني وخليجي)", "صدامات بإضاءة", "جناح خلفي وأغطية مرايا"],
      topic: "إكسسوارات الشكل الخارجي",
    },
    {
      icon: "seat",
      title: "المقصورة الداخلية",
      items: ["قطع ديكور داخلية", "دواسات مفصّلة (5 مقاعد وأكثر)"],
      topic: "إكسسوارات المقصورة الداخلية",
    },
    {
      icon: "cpu",
      title: "الإلكترونيات",
      items: ["كاميرا أمامية 8.2 إنش", "فتح الصندوق عن بُعد", "قواعد شفط كهربائية للأبواب"],
      topic: "الإلكترونيات",
    },
    {
      icon: "box",
      title: "التخزين",
      items: ["صناديق الكونسول وأدراج أسفل الكونسول", "صناديق خلفية (3 مقاسات، أسود أو بيج)"],
      topic: "حلول التخزين",
    },
    {
      icon: "wrench",
      title: "قطع الغيار والفلاتر",
      items: ["قطع غيار صينية وغير صينية", "فلاتر مكيف وفلاتر رياضية"],
      topic: "قطع الغيار",
    },
  ],
  en: [
    {
      icon: "shield",
      title: "Protection",
      items: ["Screen & dashboard protection", "Fender liners & protective decals", "Silicone floor mats"],
      topic: "Protection parts",
    },
    {
      icon: "car",
      title: "Exterior",
      items: ["Front grille (Chinese & GCC)", "Bumpers with lighting", "Rear spoiler & mirror covers"],
      topic: "Exterior accessories",
    },
    {
      icon: "seat",
      title: "Interior",
      items: ["Interior trim pieces", "Tailored floor mats (5-seat and larger)"],
      topic: "Interior accessories",
    },
    {
      icon: "cpu",
      title: "Electronics",
      items: ["8.2\" front camera", "Remote trunk release", "Electric suction door mounts"],
      topic: "Electronics",
    },
    {
      icon: "box",
      title: "Storage",
      items: ["Console boxes & under-console drawers", "Rear organizers (3 sizes, black or beige)"],
      topic: "Storage solutions",
    },
    {
      icon: "wrench",
      title: "Spare Parts & Filters",
      items: ["Chinese and non-Chinese spare parts", "AC filters & performance filters"],
      topic: "Spare parts",
    },
  ],
};

export interface CarBrand {
  name: string;
  logo?: string;
  /** no logo file yet — rendered as a wordmark */
  wordmark?: boolean;
  more?: boolean;
}

const CLOUDINARY = "https://res.cloudinary.com/dzcq09k8h/image/upload/h_120,c_fit,f_auto,q_auto";

const CAR_BRANDS: Record<Locale, CarBrand[]> = {
  ar: [
    { name: "جيتور", logo: `${CLOUDINARY}/v1778141932/gts-removebg-preview_i7p5z0.png` },
    { name: "تانك", logo: `${CLOUDINARY}/v1777809187/Tank_ef7iw6.png` },
    { name: "روكس", logo: "/assets/logo-rox.webp" },
    { name: "هافال", logo: `${CLOUDINARY}/v1777809187/Haval_lkx9rr.png` },
    { name: "ليوبارد", logo: `${CLOUDINARY}/v1777809187/Leopard_nr8cuy.png` },
    { name: "تويوتا", logo: "/assets/logo-toyota.webp" },
    { name: "نيسان", wordmark: true }, // TODO: needs a white/silver transparent PNG
    { name: "+ جميع السيارات", more: true },
  ],
  en: [
    { name: "Jetour", logo: `${CLOUDINARY}/v1778141932/gts-removebg-preview_i7p5z0.png` },
    { name: "Tank", logo: `${CLOUDINARY}/v1777809187/Tank_ef7iw6.png` },
    { name: "Rox", logo: "/assets/logo-rox.webp" },
    { name: "Haval", logo: `${CLOUDINARY}/v1777809187/Haval_lkx9rr.png` },
    { name: "Leopard", logo: `${CLOUDINARY}/v1777809187/Leopard_nr8cuy.png` },
    { name: "Toyota", logo: "/assets/logo-toyota.webp" },
    { name: "Nissan", wordmark: true }, // TODO: needs a white/silver transparent PNG
    { name: "+ All cars", more: true },
  ],
};

const STEPS: Record<Locale, { n: string; title: string; body: string }[]> = {
  ar: [
    {
      n: "01",
      title: "تواصل معنا",
      body: "عبر واتساب أو بمكالمة، وأخبرنا بنوع سيارتك وما تحتاجه.",
    },
    {
      n: "02",
      title: "نحدد الموعد",
      body: "في الفرع الأقرب لك أو في بيتك. وإذا احتاجت سيارتك الورشة، نرسل البريكداون مجانًا.",
    },
    {
      n: "03",
      title: "ننجز العمل",
      body: "يتولى فريقنا التركيب والبرمجة، ويمكنك التقسيط مع PayLater.",
    },
  ],
  en: [
    {
      n: "01",
      title: "Contact us",
      body: "Via WhatsApp or a call — tell us your car type and what you need.",
    },
    {
      n: "02",
      title: "We set an appointment",
      body: "At the branch nearest you or at your home. If your car needs the workshop, we send a free breakdown/tow.",
    },
    {
      n: "03",
      title: "We get it done",
      body: "Our team handles installation and programming, and you can pay in installments with PayLater.",
    },
  ],
};

const FAQS: Record<Locale, { q: string; a: string }[]> = {
  ar: [
    {
      q: "هل تقدمون الخدمة في البيت؟",
      a: "نعم، نركّب الإكسسوارات ونعمل التظليل والبرمجة أمام بيتك، والرسوم حسب المنطقة.",
    },
    {
      q: "كم تكلفة البريكداون؟",
      a: "مجانًا. إذا احتاجت سيارتك الحضور إلى الفرع، نرسل البريكداون لنقلها.",
    },
    {
      q: "هل تخدمون السيارات غير الصينية؟",
      a: "نعم. نحن متخصصون في السيارات الصينية، والعازل وPPF وقطع الغيار والصيانة متاحة لجميع السيارات.",
    },
    { q: "أي فرع أزور؟", a: "الأقرب لك، فالفرعان يقدمان الخدمات نفسها." },
    {
      q: "هل يمكنني التقسيط؟",
      a: "نعم مع PayLater: 4 أقساط للطلبات فوق 300 ريال، وحتى 12 شهرًا للطلبات فوق 4,000 ريال.",
    },
  ],
  en: [
    {
      q: "Do you offer home service?",
      a: "Yes — we install accessories and do tinting and programming right at your home; fees depend on the area.",
    },
    {
      q: "How much does the breakdown/tow cost?",
      a: "Free. If your car needs to come to the branch, we send a tow truck to bring it in.",
    },
    {
      q: "Do you service non-Chinese cars?",
      a: "Yes. We specialize in Chinese cars, and insulation, PPF, spare parts and maintenance are available for all cars.",
    },
    { q: "Which branch should I visit?", a: "Whichever is closer — both branches offer the same services." },
    {
      q: "Can I pay in installments?",
      a: "Yes, with PayLater: 4 installments for orders over 300 QAR, and up to 12 months for orders over 4,000 QAR.",
    },
  ],
};

const HERO_FACTS: Record<Locale, { b: string; s: string }[]> = {
  ar: [
    { b: "فرعان", s: "الغرافة وبن عمران" },
    { b: "خدمة في البيت", s: "إكسسوارات وتظليل وبرمجة" },
    { b: "بريكداون مجاني", s: "ننقل سيارتك إلى الفرع" },
    { b: "تقسيط PayLater", s: "4 أقساط · وحتى 12 شهر" },
  ],
  en: [
    { b: "Two branches", s: "Al Gharrafa and Bin Omran" },
    { b: "Home service", s: "Accessories, tinting & programming" },
    { b: "Free breakdown/tow", s: "We bring your car to the branch" },
    { b: "PayLater installments", s: "4 installments · up to 12 months" },
  ],
};

const BOOKING_SERVICES: Record<Locale, { value: string; label: string }[]> = {
  ar: [
    { value: "الإكسسوارات", label: "إكسسوارات" },
    { value: "حماية الطلاء PPF", label: "PPF" },
    { value: "العازل والتظليل", label: "تظليل" },
    { value: "البرمجة", label: "برمجة" },
    { value: "قطع الغيار", label: "قطع غيار" },
    { value: "الصيانة", label: "صيانة" },
  ],
  en: [
    { value: "Accessories", label: "Accessories" },
    { value: "PPF paint protection", label: "PPF" },
    { value: "Insulation & tinting", label: "Tinting" },
    { value: "Programming", label: "Programming" },
    { value: "Spare parts", label: "Spare parts" },
    { value: "Maintenance", label: "Maintenance" },
  ],
};

export const SOCIAL = {
  instagram: "https://www.instagram.com/wolfcar_qa/",
  tiktok: "https://www.tiktok.com/@wolfcar_qa",
  email: "info@wolfcar.qa",
};

export const LOGO =
  "https://res.cloudinary.com/dzcq09k8h/image/upload/v1777807970/Logo-removebg-preview_mg3e4j.png";

export function getServices(locale: Locale) {
  return SERVICES[locale];
}
export function getCategories(locale: Locale) {
  return CATEGORIES[locale];
}
export function getCarBrands(locale: Locale) {
  return CAR_BRANDS[locale];
}
export function getSteps(locale: Locale) {
  return STEPS[locale];
}
export function getFaqs(locale: Locale) {
  return FAQS[locale];
}
export function getHeroFacts(locale: Locale) {
  return HERO_FACTS[locale];
}
export function getBookingServices(locale: Locale) {
  return BOOKING_SERVICES[locale];
}
