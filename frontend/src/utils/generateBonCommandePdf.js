import { jsPDF } from 'jspdf';

// Brand colours (RGB)
const NAVY = [20, 36, 107];
const SOFT = [77, 87, 140];
const ORANGE = [241, 88, 26];
const CYAN = [22, 179, 219];
const GRID = [219, 219, 224];
const MUTED = [158, 158, 168];
const ZEBRA = [247, 247, 250];
const WHITE = [255, 255, 255];

// Load the logo as a data URL (best-effort — the PDF still renders without it).
const loadLogo = async () => {
  try {
    const res = await fetch('/btp_logo_icon_512_transparent.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const fmtHeure = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const generateBonCommandePdf = async ({ numero, demande_par, created_at, items }) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 38;
  const contentW = PW - 2 * M;

  const when = created_at ? new Date(created_at) : new Date();
  const dateStr = fmtDate(when);
  const heureStr = fmtHeure(when);
  const logo = await loadLogo();

  const cols = [
    { label: 'N°', w: 30, align: 'center' },
    { label: 'ARTICLE', w: 275, align: 'left' },
    { label: 'QTÉ', w: 60, align: 'center' },
    { label: 'UNITÉ', w: 72, align: 'center' },
    { label: 'PRÉPARÉ', w: 82, align: 'center' },
  ];
  const colX = [];
  let cx = M;
  cols.forEach((c) => { colX.push(cx); cx += c.w; });
  const tableRight = cx;

  const ROWS_PER_PAGE = 17;
  const ROW_H = 25;
  const list = Array.isArray(items) ? items : [];
  const pages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));

  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const draw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage();
    let y = M;

    // ---- Header: logo + wordmark + company contact ----
    if (logo) {
      try { doc.addImage(logo, 'PNG', M, y, 40, 40); } catch { /* ignore */ }
    }
    doc.setFont('helvetica', 'bold'); text(NAVY); doc.setFontSize(20);
    doc.text('BTP OULIME', M + 48, y + 22);
    doc.setFont('helvetica', 'normal'); text(SOFT); doc.setFontSize(7);
    doc.text('B Â T I M E N T   &   T R A V A U X   P U B L I C S', M + 49, y + 33);

    doc.setFontSize(8); text(SOFT);
    const rx = PW - M;
    doc.text('Adresse : ………………………………', rx, y + 8, { align: 'right' });
    doc.text('Tél : ……………   ICE : ……………', rx, y + 20, { align: 'right' });
    doc.text('Email : ………………………………', rx, y + 32, { align: 'right' });

    y += 56;

    // ---- Title bar ----
    const barH = 34;
    fill(NAVY); doc.rect(M, y, contentW, barH, 'F');
    // cyan checkbox chip with check
    draw(CYAN); doc.setLineWidth(1.5);
    doc.roundedRect(M + 12, y + (barH - 16) / 2, 16, 16, 3, 3, 'S');
    doc.line(M + 16, y + barH / 2 + 1, M + 19, y + barH / 2 + 4);
    doc.line(M + 19, y + barH / 2 + 4, M + 24, y + barH / 2 - 3);
    // title
    doc.setFont('helvetica', 'bold'); text(WHITE); doc.setFontSize(18);
    doc.text('BON DE COMMANDE', M + 40, y + barH / 2 + 6);
    // N° + numero (orange mono)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); text(WHITE);
    doc.text('N°', tableRight - 100, y + barH / 2 + 4);
    doc.setFont('courier', 'bold'); text(ORANGE); doc.setFontSize(16);
    doc.text(numero || 'BC-0000', tableRight - 10, y + barH / 2 + 5, { align: 'right' });

    y += barH + 20;

    // ---- Header line: Demandé par / Date / Heure (auto-filled) ----
    doc.setFontSize(9);
    const pair = (label, value, x) => {
      doc.setFont('helvetica', 'normal'); text(SOFT);
      doc.text(label, x, y);
      const w = doc.getTextWidth(label);
      doc.setFont('helvetica', 'bold'); text(NAVY);
      doc.text(' ' + (value || ''), x + w, y);
    };
    pair('Demandé par :', demande_par, M);
    pair('Date :', dateStr, M + contentW * 0.55);
    pair('Heure :', heureStr, M + contentW * 0.80);

    y += 18;

    // ---- Table header ----
    const headH = 26;
    fill(NAVY); doc.rect(M, y, contentW, headH, 'F');
    doc.setFont('helvetica', 'bold'); text(WHITE); doc.setFontSize(9);
    cols.forEach((c, i) => {
      if (c.align === 'left') doc.text(c.label, colX[i] + 8, y + headH / 2 + 3);
      else doc.text(c.label, colX[i] + c.w / 2, y + headH / 2 + 3, { align: 'center' });
    });
    const bodyTop = y + headH;

    // ---- Rows ----
    const startIdx = p * ROWS_PER_PAGE;
    for (let r = 0; r < ROWS_PER_PAGE; r++) {
      const idx = startIdx + r;
      const item = list[idx];
      const top = bodyTop + r * ROW_H;
      if (r % 2 === 1) { fill(ZEBRA); doc.rect(M, top, contentW, ROW_H, 'F'); }
      // N°
      doc.setFont('courier', 'normal'); text(MUTED); doc.setFontSize(9);
      doc.text(String(idx + 1).padStart(2, '0'), colX[0] + cols[0].w / 2, top + ROW_H / 2 + 3, { align: 'center' });
      if (item) {
        doc.setFont('helvetica', 'normal'); text(NAVY); doc.setFontSize(9);
        let art = String(item.article || '');
        const maxW = cols[1].w - 12;
        if (doc.getTextWidth(art) > maxW) {
          while (art.length > 1 && doc.getTextWidth(art + '…') > maxW) art = art.slice(0, -1);
          art += '…';
        }
        doc.text(art, colX[1] + 8, top + ROW_H / 2 + 3);
        doc.text(String(item.qte ?? ''), colX[2] + cols[2].w / 2, top + ROW_H / 2 + 3, { align: 'center' });
        doc.text(String(item.unite ?? ''), colX[3] + cols[3].w / 2, top + ROW_H / 2 + 3, { align: 'center' });
      }
      // PRÉPARÉ checkbox in every row
      draw(GRID); doc.setLineWidth(1);
      doc.roundedRect(colX[4] + cols[4].w / 2 - 8, top + ROW_H / 2 - 8, 16, 16, 2, 2, 'S');
    }
    const bodyBottom = bodyTop + ROWS_PER_PAGE * ROW_H;

    // ---- Grid + border ----
    draw(GRID); doc.setLineWidth(0.5);
    [colX[1], colX[2], colX[3], colX[4]].forEach((vx) => doc.line(vx, y, vx, bodyBottom));
    for (let r = 1; r < ROWS_PER_PAGE; r++) doc.line(M, bodyTop + r * ROW_H, tableRight, bodyTop + r * ROW_H);
    doc.line(M, bodyTop, tableRight, bodyTop);
    draw(NAVY); doc.setLineWidth(1);
    doc.rect(M, y, contentW, headH + ROWS_PER_PAGE * ROW_H, 'S');

    // ---- Signatures (last page) ----
    if (p === pages - 1) {
      const sigY = bodyBottom + 42;
      const boxW = (contentW - 30) / 2;
      const boxH = 70;
      doc.setFont('helvetica', 'bold'); text(NAVY); doc.setFontSize(10);
      doc.text('Demandé par', M + boxW / 2, sigY, { align: 'center' });
      doc.text('Magasinier', M + boxW + 30 + boxW / 2, sigY, { align: 'center' });
      draw(GRID); doc.setLineWidth(1);
      doc.rect(M, sigY + 8, boxW, boxH, 'S');
      doc.rect(M + boxW + 30, sigY + 8, boxW, boxH, 'S');
    }

    // ---- Footer ----
    const footY = PH - M;
    draw(CYAN); doc.setLineWidth(1);
    doc.line(M, footY - 14, tableRight, footY - 14);
    doc.setFont('helvetica', 'normal'); text(SOFT); doc.setFontSize(8);
    doc.text('BTP OULIME — Bâtiment & Travaux Publics', M, footY - 3);
    doc.text(`Bon de commande interne — liste des articles à préparer.    Page ${p + 1}/${pages}`, tableRight, footY - 3, { align: 'right' });
  }

  doc.save(`${numero || 'bon-commande'}.pdf`);
};
