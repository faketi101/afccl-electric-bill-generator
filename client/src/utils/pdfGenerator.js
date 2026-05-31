import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatAmountInWords } from "./amountInWords";

const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const PDF_LANGUAGE = {
  BANGLA: "bangla",
  ENGLISH: "english",
  BOTH: "bangla_english",
};

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
  if (bnVal) return `${en} (${bn(bnVal)})`;
  return en || "";
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
  const parts = bm.split("-");
  if (parts.length === 2) {
    if (language === PDF_LANGUAGE.BANGLA) {
      return bn(`${toBnNum(parts[0])}-${toBnNum(parts[1])}`);
    }
    if (language === PDF_LANGUAGE.ENGLISH) {
      return bm;
    }
    return `${bm} (${bn(`${toBnNum(parts[0])}-${toBnNum(parts[1])}`)})`;
  }
  return bm;
}

function formatKwh(language) {
  return language === PDF_LANGUAGE.BANGLA ? bn("কিলোওয়াট ঘণ্টা") : "kWh";
}

function formatAmountWords(amount, language) {
  const amountWords = formatAmountInWords(amount);
  if (language === PDF_LANGUAGE.BANGLA) {
    return `
          <div style="border:1px solid #ddd;border-top:0;padding:6px 12px;font-size:9.5px;line-height:1.35;color:#1a202c;background:#fff;">
            <div><strong>${bn("কথায়")}:</strong> ${bn(amountWords.bangla)}</div>
          </div>
        `;
  }
  if (language === PDF_LANGUAGE.ENGLISH) {
    return `
          <div style="border:1px solid #ddd;border-top:0;padding:6px 12px;font-size:9.5px;line-height:1.35;color:#1a202c;background:#fff;">
            <div><strong>In words:</strong> ${amountWords.english}</div>
          </div>
        `;
  }

  return `
          <div style="border:1px solid #ddd;border-top:0;padding:6px 12px;font-size:9.5px;line-height:1.35;color:#1a202c;background:#fff;">
            <div><strong>In words:</strong> ${amountWords.english}</div>
            <div><strong>${bn("কথায়")}:</strong> ${bn(amountWords.bangla)}</div>
          </div>
        `;
}

function buildCopyHTML(
  invoice,
  settings,
  language,
  withPaidSeal,
  copyLabel,
) {
  const c = invoice.customer || {};
  const s = settings || {};

  const displayName = formatDisplayValue(c.name, c.nameBn, language);
  const displayAddress = formatDisplayValue(c.address, c.addressBn, language);
  const displayMeterNo = formatDisplayValue(c.meterNo, c.meterNoBn, language);
  const displayPhone = formatDisplayValue(c.phone || "", c.phoneBn, language);
  const kwh = formatKwh(language);
  const headerAddressLabel = formatLabel("Address", "ঠিকানা", language);
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
  const invoiceTitle =
    language === PDF_LANGUAGE.BANGLA
      ? bn("বিদ্যুৎ বিল")
      : bn(s.invoiceTitle || "ELECTRICITY BILL");
  const paidLabel = formatLabel("PAID", "পরিশোধিত", language);
  const paidDate = invoice.paidAt ? formatDate(invoice.paidAt, language) : "";

  const logoHTML = s.logoBase64
    ? `<img src="data:${s.logoMimeType || "image/png"};base64,${s.logoBase64}" style="width:55px;height:40px;object-fit:contain;">`
    : "";

  const paidSealHTML =
    withPaidSeal && invoice.status === "paid"
      ? `<div style="position:absolute;top:25mm;right:15mm;width:85px;height:40px;border:3px solid #22c55e;color:#22c55e;transform:rotate(-15deg);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:14px;font-weight:bold;"><span>${paidLabel}</span><span style="font-size:10px;font-weight:normal;">${paidDate}</span></div>`
      : "";

  const rows = [
    {
      label: "Previous Reading",
      bnLabel: "পূর্ববর্তী রিডিং",
      value: `${formatNumber(invoice.previousReading, language)} ${kwh}`,
    },
    {
      label: "Current Reading",
      bnLabel: "বর্তমান রিডিং",
      value: `${formatNumber(invoice.currentReading, language)} ${kwh}`,
    },
    {
      label: "Units Consumed",
      bnLabel: "ভোক্ত ইউনিট",
      value: `${formatNumber(invoice.unitsConsumed, language)} ${kwh}`,
    },
    {
      label: "Rate per Unit",
      bnLabel: "প্রতি ইউনিট হার",
      value: formatCurrency(invoice.ratePerUnit, language),
    },
    {
      label: "Unit Charge",
      bnLabel: "ইউনিট চার্জ",
      value: formatCurrency(invoice.unitCharge, language),
    },
    {
      label: "Service Charge",
      bnLabel: "সার্ভিস চার্জ",
      value: formatCurrency(invoice.serviceCharge || 0, language),
    },
  ];

  if (invoice.fine > 0) {
    const fineLabel = invoice.fineNote ? `Fine (${invoice.fineNote})` : "Fine";
    const fineLabelBn = invoice.fineNote
      ? `জরিমানা (${invoice.fineNote})`
      : "জরিমানা";
    rows.push({
      label: fineLabel,
      bnLabel: fineLabelBn,
      value: formatCurrency(invoice.fine, language),
    });
  }
  if (invoice.vatPercent > 0) {
    const vatPercentBn = toBnNum(invoice.vatPercent);
    rows.push({
      label: `VAT (${invoice.vatPercent}%)`,
      bnLabel: `ভ্যাট (${vatPercentBn}%)`,
      value: formatCurrency(invoice.vatAmount, language),
    });
  }

  const rowsHTML = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:4px 12px;border:1px solid #ddd;font-size:11px;">${formatLabel(r.label, r.bnLabel, language)}</td>
      <td style="padding:4px 12px;border:1px solid #ddd;text-align:right;font-size:11px;font-family:monospace;">${r.value}</td>
    </tr>
  `,
    )
    .join("");

  const totalAmountWordsHTML = formatAmountWords(invoice.totalAmount, language);

  return `
    <div style="position:relative;padding:12.7mm 15mm;height:100%;">
      ${paidSealHTML}
      <div style="display:flex;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #1e3c78;">
        <div style="width:60px;flex-shrink:0;">${logoHTML}</div>
        <div style="flex:1;">
          <div style="font-size:17px;font-weight:700;color:#1e3c78;margin-bottom:3px;">${companyName}</div>
          <div style="font-size:11px;color:#000;line-height:1.4;">${headerAddressLabel}: ${companyAddress}</div>
          <div style="font-size:10px;color:#000;margin-top:2px;">${headerPhoneLabel}: ${companyPhone}, ${headerEmailLabel}: ${companyEmail}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px;font-weight:700;color:#1e3c78;">${invoiceTitle}</div>
          <div style="font-size:11px;color:#000;margin-top:3px;">${copyLabel}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:11px;">
       
        <div style="flex:1;">
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Customer", "গ্রাহক", language)}:</span><span style="color:#000;">${displayName}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Address", "ঠিকানা", language)}:</span><span style="color:#000;">${displayAddress}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Meter No", "মিটার নং", language)}:</span><span style="color:#000;">${displayMeterNo}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Phone", "ফোন", language)}:</span><span style="color:#000;">${displayPhone || (language === PDF_LANGUAGE.BANGLA ? bn("প্রযোজ্য নয়") : "N/A")}</span></div>
        </div>
         <div style="flex:1;">
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Invoice No", "ইনভয়েস নং", language)}:</span><span style="color:#000;">${formatDisplayValue(invoice.invoiceNo, toBnNum(invoice.invoiceNo), language)}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Bill Month", "বিলের মাস", language)}:</span><span style="color:#000;">${formatBillMonth(invoice.billMonth, language)}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Issue Date", "ইস্যুর তারিখ", language)}:</span><span style="color:#000;">${formatDate(invoice.issueDate, language)}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">${formatLabel("Due Date", "শেষ তারিখ", language)}:</span><span style="color:#000;">${invoice.dueDate ? formatDate(invoice.dueDate, language) : language === PDF_LANGUAGE.BANGLA ? bn("প্রযোজ্য নয়") : "N/A"}</span></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:11px;">
        <thead>
          <tr><th style="background:#1e3c78;color:white;padding:6px 12px;text-align:left;font-weight:600;">${formatLabel("Description", "বিবরণ", language)}</th><th style="background:#1e3c78;color:white;padding:10px 12px;text-align:right;font-weight:600;">${formatLabel("Amount", "পরিমাণ", language)}</th></tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot>
          <tr><td style="background:#ebf8ff;color:#1e3c78;font-weight:700;padding:8px 12px;font-size:12px;">${formatLabel("TOTAL PAYABLE", "মোট প্রদেয়", language)}</td><td style="background:#ebf8ff;color:#1e3c78;font-weight:700;padding:8px 12px;text-align:right;font-size:12px;">${formatCurrency(invoice.totalAmount, language)}</td></tr>
        </tfoot>
      </table>
      ${totalAmountWordsHTML}

      <div style="position:absolute;bottom:6mm;left:15mm;right:15mm;display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="font-size:10px;color:#666;font-style:italic;max-width:55%;line-height:1.3;">
          ${footerText}
        </div>
        <div style="text-align:center;display:flex;flex-direction:column;align-items:center;margin-top:40px">
          <div style="height:90px;"></div>
          <div style="border-top:1.5px solid #000;width:210px;padding-top:2px;font-size:12px;font-weight:bold;line-height:1;font-family:Arial, sans-serif;color:#000;">
            ${formatLabel("Authorised Signature & Seal", "সংশ্লিষ্ট কর্মকর্তার স্বাক্ষর ও সিল", language)}
          </div>
        </div>
        
      </div>
      
    </div>`;
}

async function createInvoicePDF(
  invoice,
  settings,
  withPaidSeal = false,
  config = {},
) {
  const c = invoice.customer || {};
  const language = normalizePdfLanguage(config.pdfLanguage);

  const officeCopyHTML = buildCopyHTML(
    invoice,
    settings,
    language,
    withPaidSeal,
    formatCopyLabel("Office Copy", "অফিস কপি", language),
  );
  const customerCopyHTML = buildCopyHTML(
    invoice,
    settings,
    language,
    withPaidSeal,
    formatCopyLabel("Customer Copy", "গ্রাহক কপি", language),
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
