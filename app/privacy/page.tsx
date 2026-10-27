"use client";

import { useEffect, useState } from "react";
import type { Language } from "../../lib/types";

type Section = { title: string; body: string[] };
type Notice = {
  back: string;
  title: string;
  intro: string;
  sections: Section[];
  updated: string;
};

/**
 * Plain-language notice for customers and owners. Restaurants that collect
 * orders remain responsible for their customers' data under Moroccan Law 09-08.
 */
const notices: Record<Language, Notice> = {
  en: {
    back: "← Back to the menu",
    title: "Your privacy",
    intro:
      "TableTap lets you order from a restaurant's menu on WhatsApp. Here is what we keep, why, and for how long.",
    sections: [
      {
        title: "When you order",
        body: [
          "We save your name, order type, table number or delivery address, notes, and the dishes you chose, so the restaurant can see and prepare your order.",
          "This happens when you tap “Continue to WhatsApp”. Your WhatsApp message itself goes directly from your phone to the restaurant; we never see it.",
          "Each restaurant keeps its latest 500 orders. Older ones are deleted automatically.",
        ],
      },
      {
        title: "Restaurant owners",
        body: [
          "We keep your email address to send sign-in codes, and the menu, photos and details you save.",
          "Sign-in codes expire after 10 minutes. We store only a scrambled (hashed) version of codes and session keys.",
        ],
      },
      {
        title: "Spam protection",
        body: [
          "To stop fake orders, we count requests per connection. We store only a scrambled version of your IP address, never the address itself, and the counts are deleted within a day.",
        ],
      },
      {
        title: "In your browser",
        body: [
          "Your cart and language are saved on your device only. Owners get one sign-in cookie. There are no advertising or tracking cookies.",
        ],
      },
      {
        title: "Your rights",
        body: [
          "Under Moroccan Law 09-08 you can ask to see, correct or delete your information. For an order, contact the restaurant you ordered from: it decides how your order data is used.",
        ],
      },
    ],
    updated: "Last updated: October 2026",
  },
  fr: {
    back: "← Retour à la carte",
    title: "Votre vie privée",
    intro:
      "TableTap vous permet de commander sur WhatsApp depuis la carte d’un restaurant. Voici ce que nous conservons, pourquoi, et pendant combien de temps.",
    sections: [
      {
        title: "Quand vous commandez",
        body: [
          "Nous enregistrons votre nom, le type de commande, le numéro de table ou l’adresse de livraison, vos remarques et les plats choisis, pour que le restaurant puisse voir et préparer votre commande.",
          "Cela se produit lorsque vous touchez « Continuer sur WhatsApp ». Votre message WhatsApp va directement de votre téléphone au restaurant ; nous ne le voyons jamais.",
          "Chaque restaurant conserve ses 500 dernières commandes. Les plus anciennes sont supprimées automatiquement.",
        ],
      },
      {
        title: "Restaurateurs",
        body: [
          "Nous conservons votre adresse e-mail pour envoyer les codes de connexion, ainsi que la carte, les photos et les informations que vous enregistrez.",
          "Les codes expirent après 10 minutes. Nous ne stockons qu’une version chiffrée (hachée) des codes et des clés de session.",
        ],
      },
      {
        title: "Protection contre le spam",
        body: [
          "Pour bloquer les fausses commandes, nous comptons les demandes par connexion. Nous ne stockons qu’une version chiffrée de votre adresse IP, jamais l’adresse elle-même, et les compteurs sont supprimés en moins d’un jour.",
        ],
      },
      {
        title: "Dans votre navigateur",
        body: [
          "Votre panier et votre langue restent sur votre appareil. Les restaurateurs reçoivent un seul cookie de connexion. Aucun cookie publicitaire ni de suivi.",
        ],
      },
      {
        title: "Vos droits",
        body: [
          "Selon la loi marocaine 09-08, vous pouvez demander à consulter, corriger ou supprimer vos données. Pour une commande, contactez le restaurant concerné : c’est lui qui décide de l’usage de vos données de commande.",
        ],
      },
    ],
    updated: "Dernière mise à jour : octobre 2026",
  },
  ar: {
    back: "→ العودة إلى القائمة",
    title: "خصوصيتك",
    intro:
      "يتيح لك TableTap الطلب عبر واتساب من قائمة المطعم. إليك ما نحتفظ به، ولماذا، وإلى متى.",
    sections: [
      {
        title: "عند الطلب",
        body: [
          "نحفظ اسمك ونوع الطلب ورقم الطاولة أو عنوان التوصيل وملاحظاتك والأطباق التي اخترتها، حتى يتمكن المطعم من رؤية طلبك وتحضيره.",
          "يحدث ذلك عند الضغط على «المتابعة إلى واتساب». رسالتك على واتساب تذهب مباشرة من هاتفك إلى المطعم، ولا نطّلع عليها أبدًا.",
          "يحتفظ كل مطعم بآخر 500 طلب فقط، وتُحذف الطلبات الأقدم تلقائيًا.",
        ],
      },
      {
        title: "أصحاب المطاعم",
        body: [
          "نحتفظ ببريدك الإلكتروني لإرسال رموز الدخول، وبالقائمة والصور والمعلومات التي تحفظها.",
          "تنتهي صلاحية رموز الدخول بعد 10 دقائق، ولا نخزّن إلا نسخة مشفّرة منها ومن مفاتيح الجلسة.",
        ],
      },
      {
        title: "الحماية من الرسائل المزعجة",
        body: [
          "لمنع الطلبات الوهمية، نعدّ الطلبات لكل اتصال. لا نخزّن إلا نسخة مشفّرة من عنوان IP الخاص بك، وتُحذف هذه العدّادات خلال يوم واحد.",
        ],
      },
      {
        title: "في متصفحك",
        body: [
          "تبقى سلتك ولغتك على جهازك فقط. يحصل أصحاب المطاعم على ملف تعريف ارتباط واحد لتسجيل الدخول. لا توجد ملفات تعريف ارتباط إعلانية أو للتتبع.",
        ],
      },
      {
        title: "حقوقك",
        body: [
          "بموجب القانون المغربي 09-08، يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها. بالنسبة للطلبات، تواصل مع المطعم الذي طلبت منه، فهو من يقرر كيفية استخدام بيانات طلبك.",
        ],
      },
    ],
    updated: "آخر تحديث: أكتوبر 2026",
  },
};

export default function Privacy() {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tabletap:language");
      if (saved === "fr" || saved === "ar") setLanguage(saved);
    } catch {}
  }, []);
  const notice = notices[language];
  return (
    <main
      className="credits-page privacy-page"
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <a className="back-link" href="/menu">
        {notice.back}
      </a>
      <div className="privacy-languages" aria-label="Language">
        {(["en", "fr", "ar"] as const).map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={language === id}
            onClick={() => setLanguage(id)}
          >
            {id === "ar" ? "عربي" : id.toUpperCase()}
          </button>
        ))}
      </div>
      <h1>{notice.title}</h1>
      <p>{notice.intro}</p>
      {notice.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p className="privacy-updated">{notice.updated}</p>
    </main>
  );
}
