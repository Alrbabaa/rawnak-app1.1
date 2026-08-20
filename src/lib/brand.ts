/**
 * Rawnak — Corporate branding & company identity constants.
 * Parent company: Artistic Minds
 * These values are used across the app for consistency.
 */

export const BRAND = {
  appName: "رَونق",
  appNameEn: "Rawnak",
  tagline: "مساعدتك الذكية للجمال والعناية بالبشرة",
  taglineEn: "Your Personal AI Beauty & Skincare Expert",
  version: "1.0.0",
  appLogo: "/rawnak-logo.jpg",
  appIcon: "/rawnak-icon.jpg",

  parentCompany: {
    name: "Artistic Minds",
    nameAr: "آرتيستيك مايندز",
    logo: "/artistic-minds-logo.png",
    tagline: "A product of Artistic Minds",
    taglineAr: "منتج من Artistic Minds",
    description:
      "Artistic Minds شركة مبدعة متخصصة في تطوير منتجات رقمية فاخرة تجمع بين الفن والتقنية لتقديم تجارب استثنائية تلهم وتُمكّن.",
    descriptionEn:
      "Artistic Minds is a creative company specializing in premium digital products that blend art and technology to deliver exceptional experiences.",
    website: "https://artisticmindsa.com",
    websitePlaceholder: "www.artisticmindsa.com",
    email: "artisticmindsa.r@gmail.com",
    social: {
      instagram: "https://instagram.com/artistic_minds.24",
      twitter: "https://x.com/ArtisticMindsa",
      linkedin: "https://linkedin.com/in/artistic-minds-undefined-813b74423",
      tiktok: "https://tiktok.com/@artistic.minds8",
    },
  },

  contact: {
    email: "rawnakapp@gmail.com",
    supportAr: "rawnakapp@gmail.com",
  },

  website: "https://rawnakapp.com",
  websitePlaceholder: "www.rawnakapp.com",

  legal: {
    copyright: `© ${new Date().getFullYear()} Artistic Minds Inc. جميع الحقوق محفوظة.`,
    copyrightEn: `© ${new Date().getFullYear()} Artistic Minds Inc. All Rights Reserved.`,
    poweredBy: "Powered by Artistic Minds",
    poweredByAr: "بدعم من Artistic Minds",
  },

  vision:
    "أن نكون الرفيق الذكي الأول لكل امرأة في رحلتها نحو الجمال، حيث تفهمها التقنية بعمق وتمنحها ثقة الإشراق في كل يوم.",
  mission:
    "تمكين كل مستخدمة من امتلاك خبيرة جمال شخصية متاحة على مدار الساعة، تقدّم تحليلًا دقيقًا للبشرة، روتينًا مخصصًا، ونصائح مستندة إلى الذكاء الاصطناعي — بأسلوب راقٍ يليق بأناقتها.",
} as const;
