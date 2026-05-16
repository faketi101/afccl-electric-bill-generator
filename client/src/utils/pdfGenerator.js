import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

function toBnNum(n) {
  return String(n).split('').map(d => bnDigits[parseInt(d)] || d).join('');
}

function formatNumber(n) {
  return `${n} (${toBnNum(n)})`;
}

function formatCurrency(amount) {
  const en = amount.toFixed(2);
  const bn = toBnNum(en);
  return `৳ ${en} (${bn})`;
}

function formatDate(date) {
  const d = new Date(date);
  const enDay = d.getDate();
  const enMonth = d.getMonth() + 1;
  const enYear = d.getFullYear();
  const bnDay = toBnNum(enDay);
  const bnMonth = toBnNum(enMonth);
  const bnYear = toBnNum(enYear);
  return `${enDay}/${enMonth}/${enYear} (${bnDay}/${bnMonth}/${bnYear})`;
}

function formatBillMonth(bm) {
  if (!bm) return '';
  const parts = bm.split('-');
  if (parts.length === 2) {
    return `${bm} (${toBnNum(parts[0])}-${toBnNum(parts[1])})`;
  }
  return bm;
}

function getDisplayValue(en, bn) {
  if (bn) return `${en} (${bn})`;
  return en;
}

function buildCopyHTML(invoice, settings, withPaidSeal, copyLabel) {
  const c = invoice.customer || {};
  const s = settings || {};
  
  const displayName = getDisplayValue(c.name, c.nameBn);
  const displayAddress = getDisplayValue(c.address, c.addressBn);
  const displayMeterNo = getDisplayValue(c.meterNo, c.meterNoBn);
  const displayPhone = getDisplayValue(c.phone || '', c.phoneBn);

  const logoHTML = s.logoBase64 
    ? `<img src="data:${s.logoMimeType || 'image/png'};base64,${s.logoBase64}" style="width:55px;height:40px;object-fit:contain;">` 
    : '';

  const paidSealHTML = (withPaidSeal && invoice.status === 'paid')
    ? `<div style="position:absolute;top:25mm;right:15mm;width:85px;height:40px;border:3px solid #22c55e;color:#22c55e;transform:rotate(-15deg);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:14px;font-weight:bold;"><span>PAID</span><span style="font-size:10px;font-weight:normal;">${invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('en-GB').split('/').join('/') : ''}</span></div>`
    : '';

  const rows = [
    { label: 'Previous Reading', bnLabel: 'পূর্ববর্তী রিডিং', value: `${formatNumber(invoice.previousReading)} kWh` },
    { label: 'Current Reading', bnLabel: 'বর্তমান রিডিং', value: `${formatNumber(invoice.currentReading)} kWh` },
    { label: 'Units Consumed', bnLabel: 'ভোক্ত ইউনিট', value: `${formatNumber(invoice.unitsConsumed)} kWh` },
    { label: 'Rate per Unit', bnLabel: 'প্রতি ইউনিট হার', value: formatCurrency(invoice.ratePerUnit) },
    { label: 'Unit Charge', bnLabel: 'ইউনিট চার্জ', value: formatCurrency(invoice.unitCharge) },
    { label: 'Service Charge', bnLabel: 'সার্ভিস চার্জ', value: formatCurrency(invoice.serviceCharge || 0) },
  ];

  if (invoice.fine > 0) {
    const fineLabel = invoice.fineNote ? `Fine (${invoice.fineNote})` : 'Fine';
    const fineLabelBn = invoice.fineNote ? `জরিমানা (${invoice.fineNote})` : 'জরিমানা';
    rows.push({ label: fineLabel, bnLabel: fineLabelBn, value: formatCurrency(invoice.fine) });
  }
  if (invoice.vatPercent > 0) {
    rows.push({ label: `VAT (${invoice.vatPercent}%)`, bnLabel: `ভ্যাট (${invoice.vatPercent}%)`, value: formatCurrency(invoice.vatAmount) });
  }

  const rowsHTML = rows.map(r => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #ddd;font-size:11px;">${r.label} (${r.bnLabel})</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:right;font-size:11px;font-family:monospace;">${r.value}</td>
    </tr>
  `).join('');

  return `
    <div style="position:relative;padding:12.7mm 15mm;height:100%;">
      ${paidSealHTML}
      <div style="display:flex;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #1e3c78;">
        <div style="width:60px;flex-shrink:0;">${logoHTML}</div>
        <div style="flex:1;">
          <div style="font-size:17px;font-weight:700;color:#1e3c78;margin-bottom:3px;">${s.companyName || 'Company Name'}</div>
          <div style="font-size:11px;color:#000;line-height:1.4;">Address: ${s.companyAddress || ''}</div>
          <div style="font-size:10px;color:#000;margin-top:2px;">Phone: ${s.companyPhone || ''}, Email: ${s.companyEmail || ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px;font-weight:700;color:#1e3c78;">${s.invoiceTitle || 'ELECTRICITY BILL'}</div>
          <div style="font-size:11px;color:#000;margin-top:3px;">${copyLabel}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin:10px 0;font-size:11px;">
        <div style="flex:1;">
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Invoice No:</span><span style="color:#000;">${invoice.invoiceNo}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Bill Month:</span><span style="color:#000;">${formatBillMonth(invoice.billMonth)}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Issue Date:</span><span style="color:#000;">${formatDate(invoice.issueDate)}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Due Date:</span><span style="color:#000;">${invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}</span></div>
        </div>
        <div style="flex:1;">
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Customer:</span><span style="color:#000;">${displayName}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Address:</span><span style="color:#000;">${displayAddress}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Meter No:</span><span style="color:#000;">${displayMeterNo}</span></div>
          <div style="display:flex;margin-bottom:5px;"><span style="color:#000;font-weight:600;width:80px;white-space:nowrap;">Phone:</span><span style="color:#000;">${displayPhone || 'N/A'}</span></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;">
        <thead>
          <tr><th style="background:#1e3c78;color:white;padding:10px 12px;text-align:left;font-weight:600;">Description (বিবরণ)</th><th style="background:#1e3c78;color:white;padding:10px 12px;text-align:right;font-weight:600;">Amount (পরিমাণ)</th></tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot>
          <tr><td style="background:#ebf8ff;color:#1e3c78;font-weight:700;padding:12px;font-size:12px;">TOTAL PAYABLE (মোট প্রদেয়)</td><td style="background:#ebf8ff;color:#1e3c78;font-weight:700;padding:12px;text-align:right;font-size:12px;">${formatCurrency(invoice.totalAmount)}</td></tr>
        </tfoot>
      </table>

      <div style="margin-top:10px;font-size:10px;color:#666;font-style:italic;">${s.footerText || ''}</div>
    </div>`;
}

export async function generateInvoicePDF(invoice, settings, withPaidSeal = false) {
  const c = invoice.customer || {};
  
  const officeCopyHTML = buildCopyHTML(invoice, settings, withPaidSeal, 'অফিস কপি (Office Copy)');
  const customerCopyHTML = buildCopyHTML(invoice, settings, withPaidSeal, 'গ্রাহক কপি (Customer Copy)');

  const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; }
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
      content: '✂ এখানে কাটুন (Cut here)';
      position: absolute;
      left: 15mm;
      top: -10px;
      background: white;
      padding: 2px 8px;
      font-size: 9px;
      color: #999;
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

  const container = document.createElement('div');
  container.innerHTML = fullHTML;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '210mm';
  document.body.appendChild(container);

  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    const canvas = await html2canvas(container.querySelector('.page'), {
      scale: 2,
      useCORS: true,
      logging: false
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    const meterNoStr = c.meterNo ? `-${c.meterNo}` : '';
    const filename = `${invoice.invoiceNo}-${c.name?.replace(/\s+/g, '_')}${meterNoStr}.pdf`;
    pdf.save(filename);

    return filename;
  } catch (err) {
    if (container.parentNode) document.body.removeChild(container);
    throw err;
  }
}