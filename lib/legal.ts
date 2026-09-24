import type { Locale } from "@/i18n/routing";

/**
 * Privacy policy and terms of service. DRAFTS written from what the site
 * actually does (no customer accounts, booking goes through WhatsApp, no
 * analytics) — have them reviewed before relying on them, and bump UPDATED
 * whenever the wording changes.
 */
export const LEGAL_UPDATED = "2026-09-24";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const PRIVACY: Record<Locale, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    intro:
      "This policy explains what information Wolf Car Auto Services (\"Wolf Car\", \"we\") receives when you use this website or contact us, and how we use it. We handle personal data in line with Qatar's Law No. 13 of 2016 on the Protection of Personal Data Privacy.",
    sections: [
      {
        heading: "What we receive",
        paragraphs: [
          "You can browse this website without creating an account or giving us any personal details.",
          "The booking form does not send anything to our servers. It prepares a WhatsApp message on your device; we only receive it if you choose to send it. When you message or call us, we receive your phone number, your name as shown on WhatsApp, and what you tell us — for example your car model, the service you need and, for home service, your address or location.",
        ],
      },
      {
        heading: "How we use it",
        paragraphs: [
          "We use this information only to reply to you, give you a quote, arrange your appointment or home-service visit, carry out the work and follow up on it (including warranty questions).",
          "We do not sell your information and we do not use it for advertising.",
        ],
      },
      {
        heading: "Stored on your device",
        paragraphs: [
          "The website remembers your language and your light or dark display choice so the page looks the way you left it. These are kept in your browser and are not used to track you.",
          "We do not use analytics or advertising trackers on this website.",
        ],
      },
      {
        heading: "Content from other companies",
        paragraphs: [
          "Some parts of the website are provided by other companies: the branch maps (Google Maps), our videos (TikTok and Instagram, loaded only when you press play), WhatsApp for messages, and PayLater if you choose to pay in installments. When you use these, the company concerned receives information under its own privacy policy.",
        ],
      },
      {
        heading: "Sharing",
        paragraphs: [
          "We share information only when it is needed to serve you — for example with PayLater when you ask to pay in installments — or when the law requires it.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "We keep conversations and service records for as long as they are needed to serve you, handle warranty questions and meet our legal and accounting obligations.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          "You can ask us what information we hold about you, ask us to correct it, or ask us to delete it when we no longer need to keep it. Contact us by email or WhatsApp using the details at the bottom of this page.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: ["If we change this policy, we will update it on this page with a new date."],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    intro:
      "توضح هذه السياسة المعلومات التي تصل إلى وولف كار لخدمات السيارات («وولف كار» أو «نحن») عند استخدامك لهذا الموقع أو تواصلك معنا، وكيف نستخدمها. نتعامل مع البيانات الشخصية وفق القانون القطري رقم 13 لسنة 2016 بشأن حماية خصوصية البيانات الشخصية.",
    sections: [
      {
        heading: "المعلومات التي تصلنا",
        paragraphs: [
          "يمكنك تصفح هذا الموقع دون إنشاء حساب أو تقديم أي بيانات شخصية.",
          "نموذج الحجز لا يرسل أي شيء إلى خوادمنا، بل يجهّز رسالة واتساب على جهازك، ولا تصلنا إلا إذا اخترت إرسالها. عند مراسلتنا أو الاتصال بنا يصلنا رقم هاتفك واسمك كما يظهر في واتساب وما تخبرنا به، مثل موديل سيارتك والخدمة المطلوبة، وعنوانك أو موقعك في حال الخدمة المنزلية.",
        ],
      },
      {
        heading: "كيف نستخدمها",
        paragraphs: [
          "نستخدم هذه المعلومات فقط للرد عليك وتقديم عرض السعر وترتيب موعدك أو زيارة الخدمة المنزلية وتنفيذ العمل ومتابعته، بما في ذلك استفسارات الضمان.",
          "لا نبيع معلوماتك ولا نستخدمها لأغراض إعلانية.",
        ],
      },
      {
        heading: "ما يُحفظ على جهازك",
        paragraphs: [
          "يتذكر الموقع لغتك واختيارك للوضع الفاتح أو الداكن ليظهر كما تركته. تُحفظ هذه الإعدادات في متصفحك ولا تُستخدم لتتبعك.",
          "لا نستخدم أدوات تحليلات أو تتبع إعلاني في هذا الموقع.",
        ],
      },
      {
        heading: "محتوى من شركات أخرى",
        paragraphs: [
          "بعض أجزاء الموقع تقدمها شركات أخرى: خرائط الفروع (خرائط Google)، ومقاطع الفيديو (تيك توك وإنستغرام، ولا تُحمّل إلا عند الضغط على التشغيل)، وواتساب للرسائل، وخدمة PayLater إذا اخترت الدفع بالتقسيط. عند استخدامها تصل بعض المعلومات إلى الشركة المعنية وفق سياسة الخصوصية الخاصة بها.",
        ],
      },
      {
        heading: "مشاركة المعلومات",
        paragraphs: [
          "لا نشارك المعلومات إلا عند الحاجة لخدمتك، مثل مشاركتها مع PayLater عند طلبك الدفع بالتقسيط، أو عندما يلزمنا القانون بذلك.",
        ],
      },
      {
        heading: "مدة الاحتفاظ",
        paragraphs: [
          "نحتفظ بالمحادثات وسجلات الخدمة طوال المدة اللازمة لخدمتك ومتابعة الضمان والوفاء بالتزاماتنا القانونية والمحاسبية.",
        ],
      },
      {
        heading: "حقوقك",
        paragraphs: [
          "يمكنك أن تطلب معرفة المعلومات التي نحتفظ بها عنك أو تصحيحها أو حذفها عندما لا تعود هناك حاجة للاحتفاظ بها. تواصل معنا عبر البريد الإلكتروني أو واتساب من خلال البيانات في أسفل هذه الصفحة.",
        ],
      },
      {
        heading: "التعديلات",
        paragraphs: ["إذا عدّلنا هذه السياسة فسننشر النسخة المحدثة في هذه الصفحة مع تاريخ جديد."],
      },
    ],
  },
};

const TERMS: Record<Locale, LegalDoc> = {
  en: {
    title: "Terms of Service",
    intro:
      "These terms apply when you use this website or book a service with Wolf Car Auto Services at our Al Gharrafa or Bin Omran branch, or through our home service.",
    sections: [
      {
        heading: "Information on this website",
        paragraphs: [
          "We keep the services and products on this website up to date, but availability varies by branch and by car model. Photos are for illustration. Product prices on the website are in Qatari riyals and may change; an order sent from the website is a request, not a purchase — our team confirms the price, stock and whether a part fits your car before you pay or any work starts.",
        ],
      },
      {
        heading: "Appointments",
        paragraphs: [
          "A booking sent through the website or WhatsApp is a request. Your appointment is confirmed once our team replies with the time. If you cannot make it, please let us know as early as you can.",
        ],
      },
      {
        heading: "Home service",
        paragraphs: [
          "Home service is available for selected services such as accessory installation, tinting and programming. The home-service fee depends on your area and is agreed with you before the visit. Please make sure there is safe space to work on the car.",
        ],
      },
      {
        heading: "Prices and payment",
        paragraphs: [
          "The price is agreed with you before we start. Any extra work that turns out to be needed is done only after you approve it.",
          "Installment payments through PayLater are subject to PayLater's approval and terms.",
        ],
      },
      {
        heading: "Warranty",
        paragraphs: [
          "Products that come with a manufacturer's warranty (for example paint protection film) are covered under that manufacturer's terms. The warranty that applies to your product or service is explained before the work and noted on your invoice. If something is not right after a service, please contact the branch that did the work as soon as possible.",
        ],
      },
      {
        heading: "Your car",
        paragraphs: [
          "Please remove valuables from the car before handing it over. We take care of every car in our workshop and will tell you straight away if we find something that needs your attention.",
        ],
      },
      {
        heading: "Names and logos",
        paragraphs: [
          "Car makers' names and logos, and the brands of the products we fit, belong to their owners and are used only to show which cars and products we work with.",
        ],
      },
      {
        heading: "Changes and governing law",
        paragraphs: [
          "We may update these terms; the version on this page applies from the date shown. These terms are governed by the laws of the State of Qatar.",
        ],
      },
    ],
  },
  ar: {
    title: "الشروط والأحكام",
    intro:
      "تنطبق هذه الشروط عند استخدامك لهذا الموقع أو حجزك لخدمة لدى وولف كار لخدمات السيارات في فرع الغرافة أو فرع بن عمران أو عبر الخدمة المنزلية.",
    sections: [
      {
        heading: "المعلومات في هذا الموقع",
        paragraphs: [
          "نحرص على تحديث الخدمات والمنتجات في هذا الموقع، لكن التوفر يختلف حسب الفرع وموديل السيارة، والصور للتوضيح فقط. أسعار المنتجات على الموقع بالريال القطري وقد تتغير، والطلب المرسل من الموقع طلبٌ وليس عملية شراء، إذ يؤكد فريقنا السعر والتوفر ومدى توافق القطعة مع سيارتك قبل الدفع أو بدء أي عمل.",
        ],
      },
      {
        heading: "المواعيد",
        paragraphs: [
          "الحجز المرسل عبر الموقع أو واتساب هو طلب موعد، ويُعتبر مؤكدًا عندما يرد فريقنا بالوقت المحدد. إذا تعذّر عليك الحضور، نرجو إبلاغنا في أقرب وقت.",
        ],
      },
      {
        heading: "الخدمة المنزلية",
        paragraphs: [
          "الخدمة المنزلية متاحة لخدمات محددة مثل تركيب الإكسسوارات والتظليل والبرمجة. تختلف رسوم الخدمة المنزلية حسب المنطقة ويتم الاتفاق عليها معك قبل الزيارة. نرجو توفير مكان آمن للعمل على السيارة.",
        ],
      },
      {
        heading: "الأسعار والدفع",
        paragraphs: [
          "يتم الاتفاق على السعر معك قبل البدء، وأي عمل إضافي يتبيّن أنه ضروري لا يُنفّذ إلا بعد موافقتك.",
          "الدفع بالتقسيط عبر PayLater يخضع لموافقة PayLater وشروطها.",
        ],
      },
      {
        heading: "الضمان",
        paragraphs: [
          "المنتجات التي يرافقها ضمان من الشركة المصنّعة (مثل فيلم حماية الطلاء) مشمولة وفق شروط تلك الشركة. نوضح لك الضمان الذي ينطبق على منتجك أو خدمتك قبل العمل ونسجّله في فاتورتك. إذا لاحظت أي مشكلة بعد الخدمة، تواصل مع الفرع الذي نفّذ العمل في أقرب وقت.",
        ],
      },
      {
        heading: "سيارتك",
        paragraphs: [
          "نرجو إخراج المقتنيات الثمينة من السيارة قبل تسليمها. نعتني بكل سيارة في ورشتنا، وسنبلغك فورًا إذا لاحظنا ما يحتاج إلى انتباهك.",
        ],
      },
      {
        heading: "الأسماء والشعارات",
        paragraphs: [
          "أسماء وشعارات شركات السيارات والعلامات التجارية للمنتجات التي نركّبها مملوكة لأصحابها، وتُستخدم فقط لتوضيح السيارات والمنتجات التي نعمل عليها.",
        ],
      },
      {
        heading: "التعديلات والقانون المطبّق",
        paragraphs: [
          "قد نحدّث هذه الشروط، وتسري النسخة المنشورة في هذه الصفحة اعتبارًا من التاريخ المذكور. تخضع هذه الشروط لقوانين دولة قطر.",
        ],
      },
    ],
  },
};

export function getPrivacy(locale: Locale) {
  return PRIVACY[locale];
}
export function getTerms(locale: Locale) {
  return TERMS[locale];
}
