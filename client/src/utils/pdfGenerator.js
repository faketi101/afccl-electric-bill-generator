import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatAmountInWords } from "./amountInWords";

const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const PDF_LANGUAGE = {
  BANGLA: "bangla",
  ENGLISH: "english",
  BOTH: "bangla_english",
};
const COPY_TYPES = {
  OFFICE: "office",
  CUSTOMER: "customer",
  BOTH: "both",
};
const LEGAL_PAGE = {
  width: 215.9,
  height: 355.6,
  format: "legal",
};
const LEGAL_PRINT_INSET_MM = 4;

function normalizePdfLanguage(language) {
  if (language === "bangla") return PDF_LANGUAGE.BANGLA;
  if (language === "english") return PDF_LANGUAGE.ENGLISH;
  return PDF_LANGUAGE.BOTH;
}

function toBnNum(n) {
  return String(n)
    .split("")
    .map((d) => bnDigits[parseInt(d)] || d)
    .join("");
}

/**
 * Wraps every run of Bangla characters in `text` with a <span> that
 * explicitly sets Tiro Bangla as the font.  Non-Bangla characters are
 * left untouched so they continue to render in Arial.
 */
function bn(text) {
  if (!text) return "";
  return String(text).replace(
    /([\u0980-\u09FF]+)/g,
    `<span style="font-family: 'Tiro Bangla', serif;">$1</span>`,
  );
}

function formatLabel(en, bnVal, language) {
  if (language === PDF_LANGUAGE.BANGLA) return bn(bnVal || en);
  if (language === PDF_LANGUAGE.ENGLISH) return en;
  return `${en} (${bn(bnVal)})`;
}

function formatCopyLabel(en, bnVal, language) {
  if (language === PDF_LANGUAGE.BANGLA) return bn(bnVal);
  if (language === PDF_LANGUAGE.ENGLISH) return en;
  return `${bn(bnVal)} (${en})`;
}

function formatDisplayValue(en, bnVal, language) {
  if (language === PDF_LANGUAGE.BANGLA) return bn(bnVal || en || "");
  if (language === PDF_LANGUAGE.ENGLISH) return en || bnVal || "";
  if (bnVal && en) return `${en} (${bn(bnVal)})`;
  if (bnVal) return bn(bnVal);
  return en || "";
}

function formatSerialNoText(language) {
  const label = formatLabel("Serial no", "সিরিয়াল নং", language);
  return `${label}:`;
}

function formatPercent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function getFineBaseAmount(invoice) {
  const subtotal =
    Number(invoice?.unitCharge || 0) + Number(invoice?.serviceCharge || 0);
  if (subtotal > 0) return subtotal;

  return Math.max(
    Number(invoice?.totalAmount || 0) -
      Number(invoice?.fine || 0) -
      Number(invoice?.vatAmount || 0),
    0,
  );
}

function getConfiguredFineAmount(invoice, config = {}) {
  if ((config.fineType || "percentage") === "fixed") {
    return Number(config.fixedFineAmount || 0);
  }

  return (
    (getFineBaseAmount(invoice) * Number(config.finePercent || 0)) / 100
  );
}

function getPdfFineDetails(invoice, config = {}) {
  const savedFine = Number(invoice.fine || 0);
  const savedFineType = invoice.fineType || config.fineType || "fixed";

  if (savedFine > 0) {
    return {
      amount: savedFine,
      type: savedFineType,
      percent:
        savedFineType === "percentage"
          ? Number(invoice.finePercent || config.finePercent || 0)
          : 0,
      isConfiguredDefault: false,
    };
  }

  if (!config.applyDefaultFineInPdf) {
    return {
      amount: 0,
      type: savedFineType,
      percent: 0,
      isConfiguredDefault: false,
    };
  }

  const configuredType = config.fineType || "percentage";
  const configuredAmount = getConfiguredFineAmount(invoice, config);

  return {
    amount: Number.isFinite(configuredAmount)
      ? Math.max(configuredAmount, 0)
      : 0,
    type: configuredType,
    percent:
      configuredType === "percentage" ? Number(config.finePercent || 0) : 0,
    isConfiguredDefault: true,
  };
}

function getBillMonthParts(bm) {
  if (!bm) return null;
  const trimmed = String(bm).trim();
  const enMonths = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const numericMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (numericMatch) {
    const month = Number(numericMatch[2]);
    if (month >= 1 && month <= 12) {
      return { year: numericMatch[1], month };
    }
  }

  const compactMatch = trimmed.match(/^(\d{4})(\d{2})$/);
  if (compactMatch) {
    const month = Number(compactMatch[2]);
    if (month >= 1 && month <= 12) {
      return { year: compactMatch[1], month };
    }
  }

  const nameMatch = trimmed.match(/^([A-Za-z]+)[\s/-]+(\d{4})$/);
  if (nameMatch) {
    const monthIndex = enMonths.indexOf(nameMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      return { year: nameMatch[2], month: monthIndex + 1 };
    }
  }

  return null;
}

function getSerialPrefix(invoice) {
  const parts = getBillMonthParts(invoice?.billMonth);
  if (parts) return `${parts.year}${String(parts.month).padStart(2, "0")}`;

  const fallbackDate = invoice?.issueDate || invoice?.createdAt || new Date();
  const d = new Date(fallbackDate);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getInvoiceSequence(invoice) {
  const match = String(invoice?.invoiceNo || "").match(/(\d+)\D*$/);
  if (!match) return 1;
  const sequence = Number(match[1]);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : 1;
}

function formatGeneratedSerialNo(invoice, serialIndex = null) {
  const prefix = getSerialPrefix(invoice);
  const sequence =
    serialIndex === null || serialIndex === undefined
      ? getInvoiceSequence(invoice)
      : Number(serialIndex) + 1;
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

function formatSerialNoLine(invoice, language, serialIndex = null) {
  return `${formatSerialNoText(language)} ${formatGeneratedSerialNo(
    invoice,
    serialIndex,
  )}`;
}

function formatNumber(n, language) {
  if (language === PDF_LANGUAGE.BANGLA) return bn(toBnNum(n));
  if (language === PDF_LANGUAGE.ENGLISH) return String(n);
  return `${n} (${bn(toBnNum(n))})`;
}

function formatCurrency(amount, language) {
  const en = amount.toFixed(2);
  const bnStr = bn(toBnNum(en));
  if (language === PDF_LANGUAGE.BANGLA) return `৳ ${bnStr}`;
  if (language === PDF_LANGUAGE.ENGLISH) return `৳ ${en}`;
  return `৳ ${en} (${bnStr})`;
}

function formatDate(date, language) {
  const d = new Date(date);
  const enDay = d.getDate();
  const enMonth = d.getMonth() + 1;
  const enYear = d.getFullYear();
  const bnDay = toBnNum(enDay);
  const bnMonth = toBnNum(enMonth);
  const bnYear = toBnNum(enYear);
  if (language === PDF_LANGUAGE.BANGLA) {
    return bn(`${bnDay}/${bnMonth}/${bnYear}`);
  }
  if (language === PDF_LANGUAGE.ENGLISH) {
    return `${enDay}/${enMonth}/${enYear}`;
  }
  return `${enDay}/${enMonth}/${enYear} (${bn(`${bnDay}/${bnMonth}/${bnYear}`)})`;
}

function formatBillMonth(bm, language) {
  if (!bm) return "";
  const trimmed = String(bm).trim();
  const enMonths = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const bnMonths = [
    "জানুয়ারি",
    "ফেব্রুয়ারি",
    "মার্চ",
    "এপ্রিল",
    "মে",
    "জুন",
    "জুলাই",
    "আগস্ট",
    "সেপ্টেম্বর",
    "অক্টোবর",
    "নভেম্বর",
    "ডিসেম্বর",
  ];
  const monthNameToIndex = enMonths.reduce((acc, name, index) => {
    acc[name.toLowerCase()] = index;
    return acc;
  }, {});

  let monthIndex = null;
  let year = "";
  const numericMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (numericMatch) {
    year = numericMatch[1];
    monthIndex = Number(numericMatch[2]) - 1;
  } else {
    const nameMatch = trimmed.match(/^([A-Za-z]+)[\s/-]+(\d{4})$/);
    if (nameMatch) {
      year = nameMatch[2];
      monthIndex = monthNameToIndex[nameMatch[1].toLowerCase()];
    }
  }

  if (monthIndex !== null && monthIndex >= 0 && monthIndex < 12) {
    const enDisplay = `${enMonths[monthIndex]}-${year}`;
    const bnDisplay = `${bnMonths[monthIndex]}-${toBnNum(year)}`;
    if (language === PDF_LANGUAGE.BANGLA) return bn(bnDisplay);
    if (language === PDF_LANGUAGE.ENGLISH) return enDisplay;
    return `${enDisplay} (${bn(bnDisplay)})`;
  }

  if (language === PDF_LANGUAGE.BANGLA) return bn(toBnNum(trimmed));
  if (language === PDF_LANGUAGE.ENGLISH) return trimmed;
  return `${trimmed} (${bn(toBnNum(trimmed))})`;
}

function formatKwh(language) {
  return language === PDF_LANGUAGE.BANGLA ? bn("কিলোওয়াট ঘণ্টা") : "kWh";
}

function formatAmountWordsInline(amount, language) {
  const amountWords = formatAmountInWords(amount);
  if (language === PDF_LANGUAGE.BANGLA) return bn(amountWords.bangla);
  if (language === PDF_LANGUAGE.ENGLISH) return amountWords.english;
  return `${amountWords.english} (${bn(amountWords.bangla)})`;
}

function buildCopyHTML(
  invoice,
  settings,
  config,
  language,
  withPaidSeal,
  copyLabel,
  layoutMode = "standard",
  serialNoText = "",
) {
  const c = invoice.customer || {};
  const s = settings || {};
  const compact = layoutMode === "compact";
  const layout = compact
    ? {
        padding: "6mm 8mm",
        headerGap: "6px",
        headerMarginBottom: "4px",
        headerPaddingBottom: "4px",
        logoSlotWidth: "42px",
        logoWidth: "36px",
        logoHeight: "30px",
        companyFont: "12.8px",
        companyMetaFont: "9px",
        companyMetaLineHeight: "1.2",
        titleFont: "11.6px",
        copyFont: "9px",
        infoFont: "12px",
        infoGap: "6px",
        tableFont: "12px",
        rowPadding: "2px 6px",
        footerFont: "9px",
        dueDateFont: "11px",
        footerMarginTop: "3px",
        signatureSpacer: "34px",
        signatureWidth: "120px",
        signatureFont: "9px",
        paidSealWidth: "60px",
        paidSealHeight: "28px",
        paidSealBorder: "2px",
        paidSealFont: "9px",
        paidSealDateFont: "9px",
      }
    : {
        padding: "12mm 14mm",
        headerGap: "10px",
        headerMarginBottom: "8px",
        headerPaddingBottom: "6px",
        logoSlotWidth: "60px",
        logoWidth: "52px",
        logoHeight: "40px",
        companyFont: "16px",
        companyMetaFont: "9.6px",
        companyMetaLineHeight: "1.25",
        titleFont: "15px",
        copyFont: "10.5px",
        infoFont: "12px",
        infoGap: "10px",
        tableFont: "12px",
        rowPadding: "4px 8px",
        footerFont: "9.6px",
        dueDateFont: "11px",
        footerMarginTop: "6px",
        signatureSpacer: "60px",
        signatureWidth: "190px",
        signatureFont: "9.6px",
        paidSealWidth: "82px",
        paidSealHeight: "38px",
        paidSealBorder: "3px",
        paidSealFont: "13px",
        paidSealDateFont: "9px",
      };

  const emptyValue = formatDisplayValue("N/A", "প্রযোজ্য নয়", language);
  const displayName =
    formatDisplayValue(c.name, c.nameBn, language) || emptyValue;
  const displayShopNo =
    formatDisplayValue(c.address, c.addressBn, language) || emptyValue;
  const displayMeterNo =
    formatDisplayValue(c.meterNo, c.meterNoBn, language) || emptyValue;
  const displayBillMonth = formatBillMonth(invoice.billMonth, language) || emptyValue;

  const headerPhoneLabel = formatLabel("Phone", "ফোন", language);
  const headerEmailLabel = formatLabel("Email", "ইমেইল", language);
  const companyName = bn(
    s.companyName ||
      (language === PDF_LANGUAGE.BANGLA ? "কোম্পানির নাম" : "Company Name"),
  );
  const companyAddress = bn(s.companyAddress || "");
  const companyPhone = bn(s.companyPhone || "");
  const companyEmail = bn(s.companyEmail || "");
  const footerText = bn(s.footerText || "");
  const invoiceTitle = formatLabel(
    s.invoiceTitle || "ELECTRICITY BILL",
    "বিদ্যুৎ বিল",
    language,
  );
  const paidLabel = formatLabel("PAID", "পরিশোধিত", language);
  const paidDate = invoice.paidAt ? formatDate(invoice.paidAt, language) : "";

  const contactLine = [
    companyPhone ? `${headerPhoneLabel}: ${companyPhone}` : "",
    companyEmail ? `${headerEmailLabel}: ${companyEmail}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const logoHTML = s.logoBase64
    ? `<img src="data:${s.logoMimeType || "image/png"};base64,${s.logoBase64}" style="width:${layout.logoWidth};height:${layout.logoHeight};object-fit:contain;">`
    : "";

  const paidSealHTML =
    withPaidSeal && invoice.status === "paid"
      ? `<div style="width:${layout.paidSealWidth};height:${layout.paidSealHeight};margin-bottom:4px;border:${layout.paidSealBorder} solid #22c55e;color:#22c55e;transform:rotate(-8deg);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:${layout.paidSealFont};font-weight:bold;"><span>${paidLabel}</span><span style="font-size:${layout.paidSealDateFont};font-weight:normal;">${paidDate}</span></div>`
      : "";

  const unitCharge = Number(invoice.unitCharge || 0);
  const vatAmount = Number(invoice.vatAmount || 0);
  const pdfFine = getPdfFineDetails(invoice, config);
  const fineAmount = pdfFine.amount;
  const totalAmount =
    Number(invoice.totalAmount || 0) +
    (pdfFine.isConfiguredDefault ? fineAmount : 0);
  const monthlyTotal = Math.max(totalAmount - fineAmount, 0);
  const vatPercent = Number(invoice.vatPercent || 0);
  const vatPercentText = formatPercent(vatPercent);
  const vatPercentBn = toBnNum(vatPercentText);
  const invoiceFineType = pdfFine.type;
  const finePercent = pdfFine.percent;
  const finePercentText = formatPercent(finePercent);
  const finePercentBn = toBnNum(finePercentText);
  const fineLabel =
    invoiceFineType === "percentage" && finePercent > 0
      ? formatLabel(
          `Fine Amount (${finePercentText}%)`,
          `বিলম্ব মাশুল (${finePercentBn}%)`,
          language,
      )
      : formatLabel("Fine Amount", "বিলম্ব মাশুল", language);
  const monthlyTotalWords = formatAmountWordsInline(monthlyTotal, language);
  const totalAmountWords = formatAmountWordsInline(totalAmount, language);

  const detailRows = [
    {
      label: formatLabel("Current Reading", "বর্তমান রিডিং", language),
      value: formatNumber(Number(invoice.currentReading || 0), language),
    },
    {
      label: formatLabel("Previous Reading", "পূর্ববর্তী রিডিং", language),
      value: formatNumber(Number(invoice.previousReading || 0), language),
    },
    {
      label: formatLabel("Units Consumed", "ব্যবহৃত ইউনিট", language),
      value: formatNumber(Number(invoice.unitsConsumed || 0), language),
    },
    {
      label: formatLabel("Rate per Unit", "প্রতি ইউনিট মূল্য", language),
      value: formatCurrency(Number(invoice.ratePerUnit || 0), language),
    },
    {
      label: formatLabel("Unit Charge", "ব্যবহৃত ইউনিটের মূল্য", language),
      value: formatCurrency(unitCharge, language),
    },
    {
      label: formatLabel(
        `VAT (${vatPercentText}%)`,
        `ভ্যাট (${vatPercentBn}%)`,
        language,
      ),
      value: formatCurrency(vatAmount, language),
    },
    {
      label: `${formatLabel(
        "Monthly Total Electric Bill",
        "মাসের সর্বমোট বিদ্যুৎ বিল",
        language,
      )} (${monthlyTotalWords})`,
      value: formatCurrency(monthlyTotal, language),
    },
    {
      label: fineLabel,
      value: formatCurrency(fineAmount, language),
    },
    {
      label: `${formatLabel(
        "Total Bill with Fine",
        "বিলম্ব মাশুল সহ সর্বমোট বিদ্যুৎ বিল",
        language,
      )} (${totalAmountWords})`,
      value: formatCurrency(totalAmount, language),
    },
  ];

  const labelCellBase = `border-bottom:1px solid #000;padding:${layout.rowPadding};vertical-align:top;`;
  const valueCellBase = `border-bottom:1px solid #000;padding:${layout.rowPadding};vertical-align:top;`;
  const rowsHTML = detailRows
    .map((row) => {
      if (row.fullWidth) {
        return `
        <tr>
          <td colspan="2" style="${valueCellBase}text-align:left;white-space:normal;">
            <span style="font-weight:600;">${row.label}:</span> ${row.value}
          </td>
        </tr>
      `;
      }

      const valueStyle = [
        valueCellBase,
        row.align === "left" ? "text-align:left" : "text-align:right",
        row.monospace === false ? "" : "font-family:monospace",
        row.wrap ? "white-space:normal" : "white-space:nowrap",
      ]
        .filter(Boolean)
        .join(";");

      return `
        <tr>
          <td style="${labelCellBase}font-weight:600;">${row.label}</td>
          <td style="${valueStyle}">${row.value}</td>
        </tr>
      `;
    })
    .join("");

  const detailsHeader = formatLabel(
    "Electricity Bill Details",
    "ব্যবহৃত বিদ্যুৎ বিলের বিবরণ",
    language,
  );
  const dueDateLabel = formatLabel(
    "Bill payment due date",
    "বিদ্যুৎ বিল জমা দেওয়ার শেষ তারিখ",
    language,
  );
  const dueDateValue = invoice.dueDate
    ? formatDate(invoice.dueDate, language)
    : emptyValue;

  const footerNotesHTML = footerText
    ? `<div style="margin-top:${layout.footerMarginTop};font-size:${layout.footerFont};font-style:italic;">${footerText}</div>`
    : "";
  const serialNoHTML = serialNoText
    ? `<div style="font-size:${layout.copyFont};font-weight:600;margin-right:34px;white-space:nowrap;">${serialNoText}</div>`
    : "";

  return `
    <div style="position:relative;padding:${layout.padding};height:100%;color:#000;">
      <div style="display:flex;align-items:center;gap:${layout.headerGap};margin-bottom:${layout.headerMarginBottom};padding-bottom:${layout.headerPaddingBottom};border-bottom:1px solid #000;">
        <div style="width:${layout.logoSlotWidth};flex-shrink:0;">${logoHTML}</div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:${layout.companyFont};font-weight:700;line-height:1.2;">${companyName}</div>
          ${companyAddress ? `<div style="font-size:${layout.companyMetaFont};line-height:${layout.companyMetaLineHeight};">${companyAddress}</div>` : ""}
          ${contactLine ? `<div style="font-size:${layout.companyMetaFont};line-height:${layout.companyMetaLineHeight};">${contactLine}</div>` : ""}
        </div>
        <div style="text-align:right;min-width:120px;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          ${serialNoHTML}
          <div style="font-size:${layout.copyFont};font-weight:600;">${copyLabel}</div>
          <div style="font-size:${layout.titleFont};font-weight:700;margin-top:2px;">${invoiceTitle}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:${layout.infoGap};font-size:${layout.infoFont};font-weight:700;margin-bottom:${layout.headerMarginBottom};">
        <div style="display:flex;align-items:flex-end;gap:4px;min-width:0;">
          <span style="white-space:nowrap;font-weight:700;">${formatLabel("Customer", "গ্রাহক", language)}:</span>
          <span style="flex:1;border-bottom:1px solid #000;padding:0 4px 1px 4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${displayName}</span>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;min-width:0;">
          <span style="white-space:nowrap;font-weight:700;">${formatLabel("Shop No", "দোকান নং", language)}:</span>
          <span style="flex:1;border-bottom:1px solid #000;padding:0 4px 1px 4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${displayShopNo}</span>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;min-width:0;">
          <span style="white-space:nowrap;font-weight:700;">${formatLabel("Meter No", "মিটার নং", language)}:</span>
          <span style="flex:1;border-bottom:1px solid #000;padding:0 4px 1px 4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${displayMeterNo}</span>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;min-width:0;">
          <span style="white-space:nowrap;font-weight:700;">${formatLabel("Month", "মাস", language)}:</span>
          <span style="flex:1;border-bottom:1px solid #000;padding:0 4px 1px 4px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${displayBillMonth}</span>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${layout.tableFont};border:1px solid #000;">
        <colgroup>
          <col style="width:62%;">
          <col style="width:38%;">
        </colgroup>
        <tbody>
          <tr>
            <td style="${labelCellBase}font-weight:700;">${detailsHeader}</td>
            <td style="${valueCellBase}"></td>
          </tr>
          ${rowsHTML}
        </tbody>
      </table>

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:${layout.footerMarginTop};">
        <div style="font-size:${layout.footerFont};max-width:60%;">
          ${paidSealHTML}
          <div style="font-size:${layout.dueDateFont};font-weight:600;">${dueDateLabel}: <span style="border-bottom:1px dotted #000;padding:0 6px;">${dueDateValue}</span></div>
          ${footerNotesHTML}
        </div>
        <div style="text-align:center;display:flex;flex-direction:column;align-items:center;">
          <div style="height:${layout.signatureSpacer};"></div>
          <div style="border-top:1.5px solid #000;width:${layout.signatureWidth};padding-top:2px;font-size:${layout.signatureFont};font-weight:bold;line-height:1;font-family:Arial, sans-serif;color:#000;">
            ${formatLabel("Authorised Signature & Seal", "সংশ্লিষ্ট কর্মকর্তার স্বাক্ষর ও সিল", language)}
          </div>
        </div>
      </div>
    </div>`;
}

function buildFontCSS() {
  return `
    @font-face {
      font-family: 'Tiro Bangla';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/tirobangla/v6/IFSgHe1Tm95E3O8b5i2V8MG9.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Tiro Bangla';
      font-style: italic;
      font-weight: 400;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/tirobangla/v6/IFSiHe1Tm95E3O8b5i2V8PG_80c.ttf') format('truetype');
    }
  `;
}

function getCutLineText(language) {
  if (language === PDF_LANGUAGE.BANGLA) return "✂ এখানে কাটুন";
  if (language === PDF_LANGUAGE.ENGLISH) return "✂ Cut here";
  return "✂ এখানে কাটুন (Cut here)";
}

function sanitizeFilenamePart(value, fallback = "bills") {
  const clean = String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || fallback;
}

function normalizeCopyType(copyType) {
  if (copyType === COPY_TYPES.OFFICE) return COPY_TYPES.OFFICE;
  if (copyType === COPY_TYPES.BOTH) return COPY_TYPES.BOTH;
  return COPY_TYPES.CUSTOMER;
}

function buildBatchCopyItems(invoices, copyType, language) {
  const normalizedCopyType = normalizeCopyType(copyType);

  return invoices.flatMap((invoice, invoiceIndex) => {
    const serialNoText = formatSerialNoLine(invoice, language, invoiceIndex);
    const officeCopy = {
      invoice,
      copyLabel: formatCopyLabel("Office Copy", "অফিস কপি", language),
      serialNoText,
    };
    const customerCopy = {
      invoice,
      copyLabel: formatCopyLabel("Customer Copy", "গ্রাহক কপি", language),
      serialNoText,
    };

    if (normalizedCopyType === COPY_TYPES.OFFICE) return [officeCopy];
    if (normalizedCopyType === COPY_TYPES.BOTH) {
      return [officeCopy, customerCopy];
    }
    return [customerCopy];
  });
}

function buildLegalBatchHTML({
  invoices,
  settings,
  config,
  language,
  withPaidSeal,
  copyType,
}) {
  const cutLineText = getCutLineText(language);
  const copyItems = buildBatchCopyItems(invoices, copyType, language);
  const pages = [];

  for (let i = 0; i < copyItems.length; i += 3) {
    const slots = copyItems.slice(i, i + 3);
    while (slots.length < 3) slots.push(null);

    pages.push(`
      <div class="legal-page">
        ${slots
          .map((slot) => {
            const content = slot
              ? buildCopyHTML(
                  slot.invoice,
                  settings,
                  config,
                  language,
                  withPaidSeal,
                  slot.copyLabel,
                  "compact",
                  slot.serialNoText,
                )
              : "";

            return `<div class="legal-slip">${content}</div>`;
          })
          .join("")}
        <div class="legal-cut-line legal-cut-line-one"></div>
        <div class="legal-cut-line legal-cut-line-two"></div>
      </div>
    `);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${buildFontCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .legal-page {
      width: ${LEGAL_PAGE.width}mm;
      height: ${LEGAL_PAGE.height}mm;
      position: relative;
      background: white;
      overflow: hidden;
    }
    .legal-slip {
      width: 100%;
      height: calc(100% / 3);
      position: relative;
      overflow: hidden;
    }
    .legal-cut-line {
      width: 100%;
      height: 0;
      border-top: 1px dashed #999;
      position: absolute;
      left: 0;
      z-index: 2;
    }
    .legal-cut-line-one {
      top: calc(100% / 3);
    }
    .legal-cut-line-two {
      top: calc(100% * 2 / 3);
    }
    .legal-cut-line::after {
      content: '${cutLineText}';
      position: absolute;
      left: 9mm;
      top: -10px;
      background: white;
      padding: 2px 8px;
      font-size: 9px;
      color: #999;
      font-family: 'Tiro Bangla', Arial, sans-serif;
    }
  </style>
</head>
<body>
  ${pages.join("")}
</body>
</html>`;
}

async function createMonthlyLegalBillsPDF({
  invoices,
  settings,
  config = {},
  billMonth,
  copyType = COPY_TYPES.CUSTOMER,
  withPaidSeal = false,
  autoPrint = false,
}) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    throw new Error("No generated bills found for this month.");
  }

  const language = normalizePdfLanguage(config.pdfLanguage);
  const normalizedCopyType = normalizeCopyType(copyType);
  const fullHTML = buildLegalBatchHTML({
    invoices,
    settings,
    config,
    language,
    withPaidSeal,
    copyType: normalizedCopyType,
  });

  const container = document.createElement("div");
  container.innerHTML = fullHTML;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = `${LEGAL_PAGE.width}mm`;
  document.body.appendChild(container);

  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const pages = Array.from(container.querySelectorAll(".legal-page"));
    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: LEGAL_PAGE.format,
    });
    const printWidth = LEGAL_PAGE.width - LEGAL_PRINT_INSET_MM * 2;
    const printHeight = LEGAL_PAGE.height - LEGAL_PRINT_INSET_MM * 2;

    for (let i = 0; i < pages.length; i += 1) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage(LEGAL_PAGE.format, "p");
      pdf.addImage(
        imgData,
        "JPEG",
        LEGAL_PRINT_INSET_MM,
        LEGAL_PRINT_INSET_MM,
        printWidth,
        printHeight,
      );
    }

    if (autoPrint && typeof pdf.autoPrint === "function") {
      pdf.autoPrint();
    }

    document.body.removeChild(container);

    const monthPart = sanitizeFilenamePart(billMonth, "selected-month");
    const copyPart =
      normalizedCopyType === COPY_TYPES.BOTH
        ? "office-customer"
        : normalizedCopyType;
    const filename = `bills-${monthPart}-${copyPart}-legal.pdf`;

    return { pdf, filename };
  } catch (err) {
    if (container.parentNode) document.body.removeChild(container);
    throw err;
  }
}

async function createInvoicePDF(
  invoice,
  settings,
  withPaidSeal = false,
  config = {},
) {
  const c = invoice.customer || {};
  const language = normalizePdfLanguage(config.pdfLanguage);
  const serialNoText = formatSerialNoLine(invoice, language);

  const officeCopyHTML = buildCopyHTML(
    invoice,
    settings,
    config,
    language,
    withPaidSeal,
    formatCopyLabel("Office Copy", "অফিস কপি", language),
    "standard",
    serialNoText,
  );
  const customerCopyHTML = buildCopyHTML(
    invoice,
    settings,
    config,
    language,
    withPaidSeal,
    formatCopyLabel("Customer Copy", "গ্রাহক কপি", language),
    "standard",
    serialNoText,
  );
  const cutLineText =
    language === PDF_LANGUAGE.BANGLA
      ? "✂ এখানে কাটুন"
      : language === PDF_LANGUAGE.ENGLISH
        ? "✂ Cut here"
        : "✂ এখানে কাটুন (Cut here)";

  const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Tiro Bangla – Bangla script only */
    @font-face {
      font-family: 'Tiro Bangla';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/tirobangla/v6/IFSgHe1Tm95E3O8b5i2V8MG9.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Tiro Bangla';
      font-style: italic;
      font-weight: 400;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/tirobangla/v6/IFSiHe1Tm95E3O8b5i2V8PG_80c.ttf') format('truetype');
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    /* English text uses Arial by default */
    body { font-family: Arial, sans-serif; }
    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      background: white;
    }
    .copy {
      width: 100%;
      height: 50%;
      position: relative;
      overflow: hidden;
    }
    .cut-line {
      width: 100%;
      height: 0;
      border-top: 1px dashed #999;
      position: relative;
    }
    .cut-line::after {
      content: '${cutLineText}';
      position: absolute;
      left: 15mm;
      top: -10px;
      background: white;
      padding: 2px 8px;
      font-size: 9px;
      color: #999;
      font-family: 'Tiro Bangla', Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="copy">${officeCopyHTML}</div>
    <div class="cut-line"></div>
    <div class="copy">${customerCopyHTML}</div>
  </div>
</body>
</html>`;

  const container = document.createElement("div");
  container.innerHTML = fullHTML;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "210mm";
  document.body.appendChild(container);

  // Allow Tiro Bangla font to download and paint before html2canvas captures
  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const canvas = await html2canvas(container.querySelector(".page"), {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = 297;

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

    const meterNoStr = c.meterNo ? `-${c.meterNo}` : "";
    const filename = `${invoice.invoiceNo}-${c.name?.replace(/\s+/g, "_")}${meterNoStr}.pdf`;

    return { pdf, filename };
  } catch (err) {
    if (container.parentNode) document.body.removeChild(container);
    throw err;
  }
}

export async function generateInvoicePDF(
  invoice,
  settings,
  withPaidSeal = false,
  config = {},
) {
  const { pdf, filename } = await createInvoicePDF(
    invoice,
    settings,
    withPaidSeal,
    config,
  );
  pdf.save(filename);
  return filename;
}

export async function viewInvoicePDF(
  invoice,
  settings,
  withPaidSeal = false,
  config = {},
) {
  const previewWindow = window.open("", "_blank");
  const { pdf, filename } = await createInvoicePDF(
    invoice,
    settings,
    withPaidSeal,
    config,
  );
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);

  if (previewWindow) {
    previewWindow.document.title = filename;
    previewWindow.location.href = url;
  } else {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  return filename;
}

export async function generateMonthlyLegalBillsPDF(options) {
  const { pdf, filename } = await createMonthlyLegalBillsPDF(options);
  pdf.save(filename);
  return filename;
}

export async function viewMonthlyLegalBillsPDF(options) {
  const previewWindow = window.open("", "_blank");
  const { pdf, filename } = await createMonthlyLegalBillsPDF(options);
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);

  if (previewWindow) {
    previewWindow.document.title = filename;
    previewWindow.location.href = url;
  } else {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  return filename;
}
