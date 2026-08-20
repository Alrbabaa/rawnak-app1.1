export interface CurrencyConfig {
  code: string;
  symbol: string;
  nameAr: string;
  countryAr: string;
  /** ISO 3166-1 alpha-2 country code (or a broad region marker like GLOBAL) used for product visibility. */
  countryCode: string;
  flag: string;
  rateVsSAR: number; // Conversion multiplier from SAR to this currency
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: "SAR", symbol: "ر.س", nameAr: "ريال سعودي", countryAr: "السعودية", countryCode: "SA", flag: "🇸🇦", rateVsSAR: 1.0, decimals: 0 },
  { code: "MAD", symbol: "د.م.", nameAr: "درهم مغربي", countryAr: "المغرب", countryCode: "MA", flag: "🇲🇦", rateVsSAR: 2.68, decimals: 1 },
  { code: "DZD", symbol: "د.ج", nameAr: "دينار جزائري", countryAr: "الجزائر", countryCode: "DZ", flag: "🇩🇿", rateVsSAR: 35.5, decimals: 0 },
  { code: "TND", symbol: "د.ت", nameAr: "دينار تونسي", countryAr: "تونس", countryCode: "TN", flag: "🇹🇳", rateVsSAR: 0.83, decimals: 2 },
  { code: "LYD", symbol: "د.ل", nameAr: "دينار ليبي", countryAr: "ليبيا", countryCode: "LY", flag: "🇱🇾", rateVsSAR: 1.28, decimals: 2 },
  { code: "EGP", symbol: "ج.م", nameAr: "جنيه مصري", countryAr: "مصر", countryCode: "EG", flag: "🇪🇬", rateVsSAR: 12.8, decimals: 0 },
  { code: "JOD", symbol: "د.أ", nameAr: "دينار أردني", countryAr: "الأردن", countryCode: "JO", flag: "🇯🇴", rateVsSAR: 0.189, decimals: 1 },
  { code: "IQD", symbol: "د.ع", nameAr: "دينار عراقي", countryAr: "العراق", countryCode: "IQ", flag: "🇮🇶", rateVsSAR: 349, decimals: 0 },
  { code: "AED", symbol: "د.إ", nameAr: "درهم إماراتي", countryAr: "الإمارات", countryCode: "AE", flag: "🇦🇪", rateVsSAR: 0.98, decimals: 0 },
  { code: "KWD", symbol: "د.ك", nameAr: "دينار كويتي", countryAr: "الكويت", countryCode: "KW", flag: "🇰🇼", rateVsSAR: 0.082, decimals: 2 },
  { code: "QAR", symbol: "ر.ق", nameAr: "ريال قطري", countryAr: "قطر", countryCode: "QA", flag: "🇶🇦", rateVsSAR: 0.97, decimals: 0 },
  { code: "BHD", symbol: "د.ب", nameAr: "دينار بحريني", countryAr: "البحرين", countryCode: "BH", flag: "🇧🇭", rateVsSAR: 0.10, decimals: 2 },
  { code: "OMR", symbol: "ر.ع", nameAr: "ريال عماني", countryAr: "عُمان", countryCode: "OM", flag: "🇴🇲", rateVsSAR: 0.103, decimals: 2 },
  { code: "MRU", symbol: "أ.م", nameAr: "أوقية موريتانية", countryAr: "موريتانيا", countryCode: "MR", flag: "🇲🇷", rateVsSAR: 10.65, decimals: 1 },
  { code: "SYP", symbol: "ل.س", nameAr: "ليرة سورية", countryAr: "سوريا", countryCode: "SY", flag: "🇸🇾", rateVsSAR: 29.5, decimals: 0 },
  { code: "TRY", symbol: "₺", nameAr: "ليرة تركية", countryAr: "تركيا", countryCode: "TR", flag: "🇹🇷", rateVsSAR: 12.68, decimals: 1 },
  { code: "USD", symbol: "$", nameAr: "دولار أمريكي", countryAr: "دول أمريكا والعالم", countryCode: "GLOBAL", flag: "🇺🇸", rateVsSAR: 0.267, decimals: 1 },
  { code: "EUR", symbol: "€", nameAr: "يورو أوروبي", countryAr: "دول أوروبا", countryCode: "GLOBAL", flag: "🇪🇺", rateVsSAR: 0.245, decimals: 1 },
];

/** Look up the ISO2 country code for the user's currently selected country (Arabic display name). */
export function getCountryCodeForCountryName(countryAr: string): string {
  const found = SUPPORTED_CURRENCIES.find((c) => c.countryAr === countryAr);
  return found?.countryCode || "GLOBAL";
}

export const CURRENCY_MAP: Record<string, CurrencyConfig> = SUPPORTED_CURRENCIES.reduce(
  (acc, curr) => ({ ...acc, [curr.code]: curr }),
  {}
);

/**
  Map country strings or dial codes to standard currency code
 */
export function getCurrencyForCountry(countryOrDialect: string): CurrencyConfig {
  const normalized = (countryOrDialect || "").trim().toLowerCase();

  if (normalized.includes("مغرب") || normalized.includes("morocco") || normalized.includes("maghreb")) {
    return CURRENCY_MAP.MAD;
  }
  if (normalized.includes("الجزائر") || normalized.includes("algeria") || normalized.includes("dz") || normalized.includes("jazaeri")) {
    return CURRENCY_MAP.DZD;
  }
  if (normalized.includes("تونس") || normalized.includes("tunisia")) {
    return CURRENCY_MAP.TND;
  }
  if (normalized.includes("ليبيا") || normalized.includes("libya")) {
    return CURRENCY_MAP.LYD;
  }
  if (normalized.includes("أردن") || normalized.includes("jordan") || normalized.includes("shami")) {
    return CURRENCY_MAP.JOD;
  }
  if (normalized.includes("عراق") || normalized.includes("iraq") || normalized.includes("iraqi")) {
    return CURRENCY_MAP.IQD;
  }
  if (normalized.includes("مصر") || normalized.includes("egypt") || normalized.includes("masri")) {
    return CURRENCY_MAP.EGP;
  }
  if (normalized.includes("إمارات") || normalized.includes("uae") || normalized.includes("dubai")) {
    return CURRENCY_MAP.AED;
  }
  if (normalized.includes("كويت") || normalized.includes("kuwait")) {
    return CURRENCY_MAP.KWD;
  }
  if (normalized.includes("قطر") || normalized.includes("qatar")) {
    return CURRENCY_MAP.QAR;
  }
  if (normalized.includes("بحرين") || normalized.includes("bahrain")) {
    return CURRENCY_MAP.BHD;
  }
  if (normalized.includes("عمان") || normalized.includes("oman")) {
    return CURRENCY_MAP.OMR;
  }
  if (normalized.includes("موريتانيا") || normalized.includes("mauritania")) {
    return CURRENCY_MAP.MRU;
  }
  if (normalized.includes("سوريا") || normalized.includes("syria")) {
    return CURRENCY_MAP.SYP;
  }
  if (normalized.includes("تركيا") || normalized.includes("turkey") || normalized.includes("turkiye") || normalized.includes("türkiye")) {
    return CURRENCY_MAP.TRY;
  }
  if (normalized.includes("سعود") || normalized.includes("saudi") || normalized.includes("khaleeji")) {
    return CURRENCY_MAP.SAR;
  }

  return CURRENCY_MAP.SAR;
}

/**
 * Parses raw price string or number (assuming base SAR value) and converts it to target currency
 * e.g. parseAndConvertPrice("72 ر.س", "JOD") -> "13.6 د.أ"
 */
export function formatConvertedPrice(
  rawPriceSAR: number | string | undefined | null,
  targetCurrencyCode: string = "SAR"
): string {
  if (rawPriceSAR === undefined || rawPriceSAR === null || rawPriceSAR === "") {
    return "";
  }

  const currency = CURRENCY_MAP[targetCurrencyCode] || CURRENCY_MAP.SAR;

  let numSAR = 0;
  if (typeof rawPriceSAR === "number") {
    numSAR = rawPriceSAR;
  } else {
    // Extract first valid numeric floating/integer value from string
    const match = rawPriceSAR.replace(/,/g, "").match(/[\d.]+/);
    if (!match) return String(rawPriceSAR);
    numSAR = parseFloat(match[0]);
  }

  if (isNaN(numSAR) || numSAR <= 0) {
    return String(rawPriceSAR);
  }

  const convertedValue = numSAR * currency.rateVsSAR;
  const formattedNum =
    currency.decimals === 0
      ? Math.round(convertedValue).toLocaleString("ar")
      : convertedValue.toFixed(currency.decimals);

  if (currency.code === "USD") {
    return `$${formattedNum}`;
  }
  if (currency.code === "EUR") {
    return `€${formattedNum}`;
  }

  return `${formattedNum} ${currency.symbol}`;
}
