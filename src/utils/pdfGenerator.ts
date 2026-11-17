import { jsPDF } from 'jspdf';
import { CONFIG } from '../config';
import { ExamResult, Question } from '../types';
import {
  computeItemStatistics,
  evaluateSingleQuestion,
  formatCorrectAnswerDisplay,
  isResultTuntas,
} from './scoring';

/**
 * Format tanggal dalam bahasa Indonesia
 */
export function formatIndonesianDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Helper memuat URL gambar ke base64 DataURL untuk disematkan ke jsPDF
 */
async function loadImageAsDataURL(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 400;
          canvas.height = img.naturalHeight || 300;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            width: canvas.width,
            height: canvas.height,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Helper menggambar Kop Surat Resmi SD Negeri 3 Loloan Timur
 */
function drawSchoolHeader(doc: jsPDF, marginLeft: number, marginRight: number, startY = 14): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('PEMERINTAH KABUPATEN JEMBRANA', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.text('DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA', pageWidth / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFontSize(13.5);
  doc.text(CONFIG.SEKOLAH.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(CONFIG.ALAMAT_SEKOLAH, pageWidth / 2, y, { align: 'center' });
  y += 2.5;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, y + 0.9, pageWidth - marginRight, y + 0.9);
  doc.setTextColor(0, 0, 0);

  return y + 6.5;
}

/**
 * 1. Download Lembar Hasil Tes Siswa (Tanda Tangan Guru & Orang Tua/Wali)
 */
export function downloadStudentResultPDF(result: ExamResult): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawSchoolHeader(doc, 15, 15, 16);

  // --- JUDUL DOKUMEN ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LEMBAR LAPORAN HASIL TES SUMATIF', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Tahun Ajaran 2025/2026', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // --- DATA IDENTITAS SISWA ---
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, pageWidth - 30, 38, 2, 2, 'FD');

  doc.setFontSize(9.5);
  const leftX = 20;
  const col2X = 58;
  const rightX = 114;
  const col4X = 148;

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Nama Peserta', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${result.nama}`, col2X, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Mata Pelajaran', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${CONFIG.MATA_PELAJARAN}`, col4X, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Nomor Absen', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${result.noAbsen}`, col2X, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Kelas', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${result.kelas || CONFIG.KELAS}`, col4X, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Durasi Pengerjaan', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${result.durasi || '-'}`, col2X, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Standar KKTP', rightX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${CONFIG.KKTP} (Skala 100)`, col4X, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Waktu Submit', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${result.timestamp}`, col2X, y);

  y += 14;

  // --- TABEL PEROLEHAN HASIL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('A. Hasil Perolehan Nilai Tes', 15, y);
  y += 4.5;

  doc.setFillColor(30, 58, 138);
  doc.rect(15, y, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Komponen Penilaian', 20, y + 5.5);
  doc.text('Jumlah / Nilai', pageWidth - 20, y + 5.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 8;

  const totalQuestionsCount =
    (result.benar || 0) + (result.benarSebagian || 0) + (result.salah || 0) > 0
      ? (result.benar || 0) + (result.benarSebagian || 0) + (result.salah || 0)
      : 30;

  const tableRows = [
    { label: 'Jumlah Soal Keseluruhan', value: `${totalQuestionsCount} Butir Soal` },
    { label: 'Jumlah Jawaban Benar Penuh', value: `${result.benar} Soal` },
    { label: 'Jumlah Jawaban Benar Sebagian (PGK Kategori)', value: `${result.benarSebagian ?? 0} Soal` },
    { label: 'Jumlah Jawaban Salah', value: `${result.salah} Soal` },
    { label: 'Total Skor Diperoleh', value: `${result.totalSkor ?? result.nilai} / ${result.maxSkor ?? 100}` },
    { label: 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)', value: `${CONFIG.KKTP}` },
  ];

  doc.setFont('helvetica', 'normal');
  tableRows.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, pageWidth - 30, 7.5, 'FD');
    doc.text(row.label, 20, y + 5);
    doc.text(row.value, pageWidth - 20, y + 5, { align: 'right' });
    y += 7.5;
  });

  const isPass = isResultTuntas(result);
  doc.setFillColor(isPass ? 240 : 254, isPass ? 253 : 242, isPass ? 244 : 242);
  doc.rect(15, y, pageWidth - 30, 10, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NILAI AKHIR TES SUMATIF (Skala 0 - 100)', 20, y + 6.5);
  doc.setFontSize(13);
  doc.setTextColor(isPass ? 22 : 185, isPass ? 101 : 28, isPass ? 52 : 28);
  doc.text(String(result.nilai), pageWidth - 20, y + 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, pageWidth - 30, 9, 'FD');
  doc.setFontSize(10);
  doc.text('Status Ketercapaian', 20, y + 6);
  doc.setTextColor(isPass ? 22 : 185, isPass ? 101 : 28, isPass ? 52 : 28);
  doc.text(isPass ? 'TUNTAS (Mencapai KKTP)' : 'REMEDIAL (Belum Mencapai KKTP)', pageWidth - 20, y + 6, {
    align: 'right',
  });
  doc.setTextColor(0, 0, 0);
  y += 14;

  // --- CATATAN GURU ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`B. Catatan Guru Kelas ${CONFIG.KELAS}:`, 15, y);
  y += 4.5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const note = isPass
    ? 'Selamat atas pencapaian yang memuaskan dalam mata pelajaran Matematika (Membilang sampai dengan 10.000, Pecahan, Pola Gambar dan Pola Bilangan). Terus pertahankan ketelitian berhitung dan kemampuan bernalar dalam menyelesaikan soal.'
    : 'Perlu bimbingan dan latihan remedial dalam memahami membilang sampai dengan 10.000, konsep pecahan, serta aturan pola gambar dan pola bilangan. Tetap semangat berlatih soal secara bertahap.';
  doc.text(note, 15, y, { maxWidth: pageWidth - 30 });
  y += 16;

  // --- TANDA TANGAN (GURU & ORANG TUA/WALI) ---
  const ttdY = Math.max(y, 224);
  const colLeft = 20;
  const colRight = pageWidth - 72;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  doc.text('Mengetahui,', colLeft, ttdY);
  doc.text('Orang Tua / Wali Siswa,', colLeft, ttdY + 5);

  const tglFormatted = formatIndonesianDate();
  doc.text(`${CONFIG.KOTA}, ${tglFormatted}`, colRight, ttdY);
  doc.text(`Guru Kelas ${CONFIG.KELAS},`, colRight, ttdY + 5);

  const lineY = ttdY + 27;

  doc.line(colLeft, lineY, colLeft + 50, lineY);
  doc.text('( ......................................... )', colLeft, lineY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.text(CONFIG.GURU, colRight, lineY - 1);
  doc.line(colRight, lineY, colRight + 55, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`NIP. ${CONFIG.NIP_GURU}`, colRight, lineY + 4.5);

  const safeName = (result.nama || 'siswa').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Hasil_Tes_Sumatif_Matematika_${safeName}_Absen_${result.noAbsen}.pdf`);
}

/**
 * 2. Download Naskah Soal Ujian (PDF) lengkap dengan gambar soal
 */
export async function downloadExamQuestionsPDF(questions: Question[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = drawSchoolHeader(doc, 15, 15, 14);

  const addPageHeader = () => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${CONFIG.SEKOLAH} | Naskah Soal Tes Sumatif ${CONFIG.MATA_PELAJARAN} Kelas ${CONFIG.KELAS}`,
      pageWidth / 2,
      9,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = 16;
      addPageHeader();
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(`NASKAH SOAL TES SUMATIF ${CONFIG.MATA_PELAJARAN.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(8.8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mata Pelajaran : ${CONFIG.MATA_PELAJARAN}`, 16, y);
  doc.text(`Kelas : ${CONFIG.KELAS}`, 130, y);
  y += 4.5;
  doc.text(`Guru Pengampu  : ${CONFIG.GURU}`, 16, y);
  doc.text(`Jumlah Soal : ${questions.length} Butir`, 130, y);
  y += 4.5;
  doc.text(`Kriteria KKTP  : ${CONFIG.KKTP}`, 16, y);
  doc.text(`Alokasi Waktu : 60 Menit`, 130, y);
  y += 6;

  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(245, 247, 250);
  doc.rect(15, y, pageWidth - 30, 11, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('PETUNJUK UMUM:', 18, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    '1. Tulislah identitas diri dengan lengkap. 2. Kerjakan seluruh soal pilihan ganda dengan teliti dan cermat. 3. Periksa kembali jawaban Anda sebelum dikumpulkan.',
    18,
    y + 8,
    { maxWidth: pageWidth - 36 }
  );
  y += 15;

  // Preload unique images
  const imageCache = new Map<string, { dataUrl: string; width: number; height: number } | null>();
  for (const q of questions) {
    if (q.imageUrl && !imageCache.has(q.imageUrl)) {
      const loaded = await loadImageAsDataURL(q.imageUrl);
      imageCache.set(q.imageUrl, loaded);
    }
  }

  questions.forEach((q, idx) => {
    checkPageBreak(25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);

    let typeLabel = 'Pilihan Ganda';
    if (q.type === 'pgk') typeLabel = 'Pilihan Ganda Kompleks';
    if (q.type === 'pgk_kategori') typeLabel = 'PGK Kategori (Benar / Salah)';
    if (q.type === 'isian') typeLabel = 'Isian Singkat';

    doc.setTextColor(30, 58, 138);
    doc.text(`Soal No. ${idx + 1} [${typeLabel} • ${q.topic} • Bobot ${q.weight}]`, 15, y);
    doc.setTextColor(0, 0, 0);
    y += 4.5;

    // Gambar soal jika ada
    if (q.imageUrl) {
      const imgData = imageCache.get(q.imageUrl);
      if (imgData) {
        const imgW = 55;
        const imgH = Math.min(42, (imgData.height / imgData.width) * imgW);
        checkPageBreak(imgH + 10);
        doc.addImage(imgData.dataUrl, 'JPEG', 16, y, imgW, imgH);
        y += imgH + 3;
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const textLines = doc.splitTextToSize(q.text, pageWidth - 32);
    checkPageBreak(textLines.length * 4.3 + 12);
    doc.text(textLines, 16, y);
    y += textLines.length * 4.3 + 2;

    if (q.options && q.options.length > 0) {
      q.options.forEach((opt) => {
        checkPageBreak(7);
        const optLines = doc.splitTextToSize(`${opt.id}. ${opt.text}`, pageWidth - 36);
        doc.text(optLines, 20, y);
        y += optLines.length * 4.1 + 0.8;
      });
      y += 2.5;
    }

    if (q.statements && q.statements.length > 0) {
      q.statements.forEach((st, sIdx) => {
        checkPageBreak(10);
        const stLines = doc.splitTextToSize(
          `Pernyataan ${sIdx + 1}: ${st.text}   [  ] Benar   [  ] Salah`,
          pageWidth - 36
        );
        doc.text(stLines, 20, y);
        y += stLines.length * 4.2 + 1.2;
      });
      y += 2.5;
    }

    if (q.type === 'isian') {
      checkPageBreak(9);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text('Jawaban: ....................................................................................', 20, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 7;
    }
  });

  doc.save(`Naskah_Soal_Matematika_Kelas_${CONFIG.KELAS}_SDN3_Loloan_Timur.pdf`);
}

/**
 * 3. Download Kisi-Kisi Soal Resmi (Format Kedinasan Landscape A4)
 */
export function downloadKisiKisiPDF(questions: Question[]): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight; // 273mm

  let y = drawSchoolHeader(doc, marginLeft, marginRight, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('KISI-KISI PENULISAN SOAL TES SUMATIF', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Satuan Pendidikan : ${CONFIG.SEKOLAH}`, marginLeft, y);
  doc.text(`Kelas / Fase : ${CONFIG.KELAS} / Fase B`, 135, y);
  doc.text(`KKTP : ${CONFIG.KKTP}`, 225, y);
  y += 4.2;
  doc.text(`Mata Pelajaran     : ${CONFIG.MATA_PELAJARAN}`, marginLeft, y);
  doc.text(`Jumlah Soal  : ${questions.length} Butir`, 135, y);
  doc.text(`Total Bobot : ${questions.reduce((s, q) => s + (q.weight || 1), 0)} Poin`, 225, y);
  y += 4.2;
  doc.text(`Lingkup Materi     : ${CONFIG.MATERI}`, marginLeft, y);
  y += 5.5;

  // Hitung ringkasan distribusi
  const countBy = (fn: (q: Question) => string) => {
    const map: Record<string, number> = {};
    questions.forEach((q) => {
      const k = fn(q);
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  };

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 12, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Distribusi Soal:', marginLeft + 3, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Elemen: ${countBy((q) => q.element)}   •   Level Kognitif: ${countBy((q) => q.cognitiveLevel)}`,
    marginLeft + 3,
    y + 7.5
  );
  doc.text(
    `Tingkat Kesukaran: ${countBy((q) => q.difficulty)}   •   Bentuk Soal: ${countBy((q) =>
      q.type === 'pg' ? 'PG' : q.type === 'pgk_kategori' ? 'PGK Kategori' : q.type === 'isian' ? 'Isian' : 'PGK'
    )}`,
    marginLeft + 3,
    y + 10.8
  );
  y += 15;

  const cols = [
    { title: 'No', width: 9, align: 'center' as const },
    { title: 'Lingkup Materi', width: 42, align: 'left' as const },
    { title: 'Elemen / Kompetensi', width: 40, align: 'left' as const },
    { title: 'Indikator Soal', width: 95, align: 'left' as const },
    { title: 'Bentuk Soal', width: 24, align: 'center' as const },
    { title: 'Level', width: 13, align: 'center' as const },
    { title: 'Kesukaran', width: 18, align: 'center' as const },
    { title: 'Bobot', width: 12, align: 'center' as const },
    { title: 'Kunci', width: 20, align: 'center' as const },
  ];

  const drawHeader = (curY: number) => {
    doc.setFillColor(30, 58, 138);
    doc.rect(marginLeft, curY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let cx = marginLeft;
    cols.forEach((c) => {
      const tx = c.align === 'center' ? cx + c.width / 2 : cx + 2;
      doc.text(c.title, tx, curY + 4.7, { align: c.align });
      cx += c.width;
    });
    doc.setTextColor(0, 0, 0);
  };

  drawHeader(y);
  y += 7;

  questions.forEach((q, idx) => {
    const typeText =
      q.type === 'pg'
        ? 'PG'
        : q.type === 'pgk_kategori'
        ? 'PGK Kategori'
        : q.type === 'isian'
        ? 'Isian'
        : 'PGK';

    let keyText = '-';
    if (q.type === 'pg' || q.type === 'isian') {
      keyText = String(q.correctAnswer || '-');
    } else if (q.type === 'pgk_kategori') {
      keyText = (q.statements || [])
        .map((st, i) => `P${i + 1}:${st.correctAnswer ? 'B' : 'S'}`)
        .join(', ');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const indLines = doc.splitTextToSize(q.indicator || '-', cols[3].width - 3);
    const topicLines = doc.splitTextToSize(q.topic || '-', cols[1].width - 3);
    const elLines = doc.splitTextToSize(q.element || '-', cols[2].width - 3);
    const keyLines = doc.splitTextToSize(keyText, cols[8].width - 2);
    const maxLines = Math.max(indLines.length, topicLines.length, elLines.length, keyLines.length, 1);
    const rowH = Math.max(6.2, maxLines * 3.5 + 2.5);

    if (y + rowH > pageHeight - 18) {
      doc.addPage();
      y = 14;
      drawHeader(y);
      y += 7;
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, rowH, 'FD');

    let cx = marginLeft;
    // Vertical grid lines
    cols.forEach((c, cIdx) => {
      if (cIdx > 0) doc.line(cx, y, cx, y + rowH);
      cx += c.width;
    });

    cx = marginLeft;
    doc.setFont('helvetica', 'bold');
    doc.text(String(q.id), cx + cols[0].width / 2, y + 4.3, { align: 'center' });
    cx += cols[0].width;

    doc.setFont('helvetica', 'normal');
    doc.text(topicLines, cx + 1.5, y + 4);
    cx += cols[1].width;

    doc.text(elLines, cx + 1.5, y + 4);
    cx += cols[2].width;

    doc.text(indLines, cx + 1.5, y + 4);
    cx += cols[3].width;

    doc.text(typeText, cx + cols[4].width / 2, y + 4.3, { align: 'center' });
    cx += cols[4].width;

    doc.setFont('helvetica', 'bold');
    doc.text(q.cognitiveLevel || 'L1', cx + cols[5].width / 2, y + 4.3, { align: 'center' });
    cx += cols[5].width;

    doc.setFont('helvetica', 'normal');
    doc.text(q.difficulty, cx + cols[6].width / 2, y + 4.3, { align: 'center' });
    cx += cols[6].width;

    doc.text(String(q.weight ?? 1), cx + cols[7].width / 2, y + 4.3, { align: 'center' });
    cx += cols[7].width;

    doc.setFont('helvetica', 'bold');
    doc.text(keyLines, cx + cols[8].width / 2, y + 4.3, { align: 'center' });

    y += rowH;
  });

  // Tanda tangan
  if (y + 38 > pageHeight - 10) {
    doc.addPage();
    y = 18;
  } else {
    y += 7;
  }

  const tglStr = formatIndonesianDate();
  const colLeftX = marginLeft + 15;
  const colRightX = pageWidth - marginRight - 70;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Mengetahui,', colLeftX, y);
  doc.text('Kepala Sekolah,', colLeftX, y + 4.2);

  doc.text(`${CONFIG.KOTA}, ${tglStr}`, colRightX, y);
  doc.text(`Guru Kelas ${CONFIG.KELAS},`, colRightX, y + 4.2);

  const sigY = y + 21;
  doc.setFont('helvetica', 'bold');
  doc.text(CONFIG.KEPALA_SEKOLAH, colLeftX, sigY);
  doc.line(colLeftX, sigY + 1, colLeftX + 55, sigY + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${CONFIG.NIP_KEPALA_SEKOLAH}`, colLeftX, sigY + 4.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(CONFIG.GURU, colRightX, sigY);
  doc.line(colRightX, sigY + 1, colRightX + 55, sigY + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${CONFIG.NIP_GURU}`, colRightX, sigY + 4.8);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Kisi-Kisi Soal Resmi • ${CONFIG.SEKOLAH} • ${CONFIG.MATA_PELAJARAN} Kelas ${CONFIG.KELAS}`, marginLeft, pageHeight - 6);
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginRight, pageHeight - 6, { align: 'right' });
  }

  doc.save(`Kisi_Kisi_Soal_Matematika_Kelas_${CONFIG.KELAS}.pdf`);
}

/**
 * 4. Export Rekap Nilai ke Format CSV
 */
export function exportResultsToCSV(results: ExamResult[]): void {
  const headers = [
    'Timestamp',
    'Nama Siswa',
    'Kelas',
    'Nomor Absen',
    'Tanggal Lahir',
    'Durasi',
    'Benar Penuh',
    'Benar Sebagian',
    'Salah',
    'Total Skor',
    'Nilai Akhir',
    'Status',
  ];

  const rows = results.map((r) => [
    `"${r.timestamp || ''}"`,
    `"${r.nama || ''}"`,
    `"${r.kelas || CONFIG.KELAS}"`,
    `"${r.noAbsen || ''}"`,
    `"${r.tglLahir || ''}"`,
    `"${r.durasi || '-'}"`,
    r.benar,
    r.benarSebagian ?? 0,
    r.salah,
    r.totalSkor ?? r.nilai,
    r.nilai,
    `"${isResultTuntas(r) ? 'Tuntas' : 'Remedial'}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Rekap_Nilai_Matematika_Kelas_${CONFIG.KELAS}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 5. Download Rekapitulasi Data Nilai Siswa (PDF Resmi Berkop dan Bertanda Tangan)
 */
export function downloadResultsRecapPDF(results: ExamResult[]): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;

  const total = results.length;
  const lulus = results.filter((r) => isResultTuntas(r)).length;
  const belumLulus = total - lulus;
  const persenLulus = total > 0 ? Math.round((lulus / total) * 100) : 0;
  const rataRata = total > 0 ? (results.reduce((acc, r) => acc + (r.nilai || 0), 0) / total).toFixed(1) : '0';
  const nilaiTertinggi = total > 0 ? Math.max(...results.map((r) => r.nilai || 0)) : 0;
  const nilaiTerendah = total > 0 ? Math.min(...results.map((r) => r.nilai || 0)) : 0;

  let y = drawSchoolHeader(doc, marginLeft, marginRight, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DAFTAR REKAPITULASI NILAI HASIL TES SUMATIF', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Mata Pelajaran: ${CONFIG.MATA_PELAJARAN} • Kelas ${CONFIG.KELAS} • KKTP: ${CONFIG.KKTP}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 6;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginLeft, y, contentWidth, 14, 1.5, 1.5, 'FD');

  const statCols = [
    { label: 'Total Peserta', val: `${total} Siswa` },
    { label: 'Tuntas', val: `${lulus} Siswa (${persenLulus}%)` },
    { label: 'Remedial', val: `${belumLulus} Siswa` },
    { label: 'Rata-rata', val: `${rataRata}` },
    { label: 'Tertinggi / Terendah', val: `${nilaiTertinggi} / ${nilaiTerendah}` },
  ];
  const colW = contentWidth / statCols.length;
  statCols.forEach((col, idx) => {
    const cx = marginLeft + idx * colW + colW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(col.label, cx, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(col.val, cx, y + 10.5, { align: 'center' });
  });

  doc.setTextColor(0, 0, 0);
  y += 18;

  const cols = [
    { key: 'no', title: 'No', width: 9, align: 'center' as const },
    { key: 'noAbsen', title: 'Absen', width: 13, align: 'center' as const },
    { key: 'nama', title: 'Nama Siswa', width: 54, align: 'left' as const },
    { key: 'durasi', title: 'Durasi', width: 18, align: 'center' as const },
    { key: 'benar', title: 'Benar', width: 14, align: 'center' as const },
    { key: 'salah', title: 'Salah', width: 14, align: 'center' as const },
    { key: 'nilai', title: 'Nilai', width: 16, align: 'center' as const },
    { key: 'status', title: 'Keterangan', width: 22, align: 'center' as const },
    { key: 'timestamp', title: 'Waktu Submit', width: 26, align: 'center' as const },
  ];

  const drawTableHeader = (curY: number) => {
    doc.setFillColor(30, 58, 138);
    doc.rect(marginLeft, curY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);

    let curX = marginLeft;
    cols.forEach((col) => {
      const textX = col.align === 'center' ? curX + col.width / 2 : curX + 2;
      doc.text(col.title, textX, curY + 4.8, { align: col.align });
      curX += col.width;
    });
    doc.setTextColor(0, 0, 0);
  };

  drawTableHeader(y);
  y += 7;

  if (results.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Belum ada data nilai siswa yang tersimpan.', pageWidth / 2, y + 8, { align: 'center' });
    y += 16;
  } else {
    results.forEach((r, idx) => {
      if (y + 6.5 > pageHeight - 38) {
        doc.addPage();
        y = 15;
        drawTableHeader(y);
        y += 7;
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(marginLeft, y, contentWidth, 6.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginLeft, y, contentWidth, 6.5, 'S');

      let curX = marginLeft;
      const isLulus = isResultTuntas(r);

      cols.forEach((col) => {
        let val = '';
        if (col.key === 'no') val = String(idx + 1);
        else if (col.key === 'noAbsen') val = String(r.noAbsen || '-');
        else if (col.key === 'nama') val = r.nama || '-';
        else if (col.key === 'durasi') val = r.durasi || '-';
        else if (col.key === 'benar') val = String(r.benar ?? 0);
        else if (col.key === 'salah') val = String(r.salah ?? 0);
        else if (col.key === 'nilai') val = String(r.nilai ?? 0);
        else if (col.key === 'status') val = isLulus ? 'Tuntas' : 'Remedial';
        else if (col.key === 'timestamp') val = (r.timestamp || '-').substring(0, 16);

        doc.setFont('helvetica', col.key === 'nilai' ? 'bold' : 'normal');
        doc.setFontSize(7.5);

        if (col.key === 'status') {
          doc.setTextColor(isLulus ? 22 : 185, isLulus ? 101 : 28, isLulus ? 52 : 28);
        } else {
          doc.setTextColor(30, 41, 59);
        }

        const textX = col.align === 'center' ? curX + col.width / 2 : curX + 2;
        if (col.key === 'nama') {
          const truncated = doc.splitTextToSize(val, col.width - 3)[0] || val;
          doc.text(truncated, textX, y + 4.5);
        } else {
          doc.text(val, textX, y + 4.5, { align: col.align });
        }

        curX += col.width;
      });

      doc.setTextColor(0, 0, 0);
      y += 6.5;
    });
  }

  if (y + 38 > pageHeight - 16) {
    doc.addPage();
    y = 18;
  } else {
    y += 8;
  }

  const tglStr = formatIndonesianDate();
  const colLeftX = marginLeft + 8;
  const colRightX = pageWidth - marginRight - 58;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  doc.text('Mengetahui,', colLeftX, y);
  doc.text('Kepala Sekolah,', colLeftX, y + 4.5);

  doc.text(`${CONFIG.KOTA}, ${tglStr}`, colRightX, y);
  doc.text(`Guru Kelas ${CONFIG.KELAS},`, colRightX, y + 4.5);

  const sigLineY = y + 23;
  doc.setFont('helvetica', 'bold');
  doc.text(CONFIG.KEPALA_SEKOLAH, colLeftX, sigLineY);
  doc.line(colLeftX, sigLineY + 1, colLeftX + 52, sigLineY + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${CONFIG.NIP_KEPALA_SEKOLAH}`, colLeftX, sigLineY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(CONFIG.GURU, colRightX, sigLineY);
  doc.line(colRightX, sigLineY + 1, colRightX + 52, sigLineY + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${CONFIG.NIP_GURU}`, colRightX, sigLineY + 5);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dokumen Rekapitulasi Nilai Resmi • ${CONFIG.SEKOLAH}`,
      marginLeft,
      pageHeight - 6
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginRight, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Rekap_Nilai_Matematika_Kelas_${CONFIG.KELAS}.pdf`);
}

/**
 * 6. Ekspor Laporan "Analisis Butir Soal & Matriks Jawaban" ke Format Excel / CSV
 */
export function exportItemAnalysisToCSV(questions: Question[], results: ExamResult[]): void {
  const itemStats = computeItemStatistics(questions, results);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  const lines: string[] = [];
  lines.push([esc('LAPORAN ANALISIS BUTIR SOAL & MATRIKS JAWABAN SISWA')].join(','));
  lines.push([esc(`Sekolah: ${CONFIG.SEKOLAH}`), esc(`Mata Pelajaran: ${CONFIG.MATA_PELAJARAN}`), esc(`Kelas: ${CONFIG.KELAS}`), esc(`KKTP: ${CONFIG.KKTP}`)].join(','));
  lines.push([esc(`Guru Pengampu: ${CONFIG.GURU} (NIP. ${CONFIG.NIP_GURU})`)].join(','));
  lines.push('');

  const headerRow = [
    'No',
    'Nama Siswa',
    'Absen',
    'Kelas',
    ...questions.map((q) => `S${q.id}`),
    'Total Skor',
    'Nilai Akhir',
    'Status',
    'Durasi',
  ];
  lines.push(headerRow.map(esc).join(','));

  results.forEach((r, idx) => {
    const hasDetail = r.detailJawaban && Object.keys(r.detailJawaban).length > 0;
    const itemCells = questions.map((q) => {
      if (!hasDetail) return '-';
      const ev = evaluateSingleQuestion(q, r.detailJawaban?.[q.id]);
      if (ev.status === 'correct') return `B (${ev.score})`;
      if (ev.status === 'partial') return `BS (${ev.score})`;
      return `S (0)`;
    });

    const row = [
      idx + 1,
      r.nama,
      r.noAbsen,
      r.kelas || CONFIG.KELAS,
      ...itemCells,
      r.totalSkor ?? r.nilai,
      r.nilai,
      isResultTuntas(r) ? 'Tuntas' : 'Remedial',
      r.durasi || '-',
    ];
    lines.push(row.map(esc).join(','));
  });

  lines.push('');
  lines.push(
    [
      '',
      'Jumlah Siswa Benar Penuh',
      '',
      '',
      ...itemStats.map((st) => st.correctCount),
      '',
      '',
      '',
      '',
    ]
      .map(esc)
      .join(',')
  );
  lines.push(
    [
      '',
      'Persentase Ketercapaian (%)',
      '',
      '',
      ...itemStats.map((st) => `${st.achievementPercent}%`),
      '',
      '',
      '',
      '',
    ]
      .map(esc)
      .join(',')
  );
  lines.push(
    [
      '',
      'Klasifikasi Kesukaran Empiris',
      '',
      '',
      ...itemStats.map((st) => st.empiricalDifficulty),
      '',
      '',
      '',
      '',
    ]
      .map(esc)
      .join(',')
  );

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Analisis_Butir_Soal_Matriks_Matematika_Kelas_${CONFIG.KELAS}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 7. Unduh PDF Laporan Analisis Butir Soal lengkap dengan Kop Sekolah, Matriks Jawaban, Statistik Butir & Tanda Tangan Guru
 */
export function downloadItemAnalysisPDF(questions: Question[], results: ExamResult[]): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginLeft = 10;
  const marginRight = 10;
  const contentWidth = pageWidth - marginLeft - marginRight; // 277mm

  let y = drawSchoolHeader(doc, marginLeft, marginRight, 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LAPORAN ANALISIS BUTIR SOAL & MATRIKS RESPON SISWA', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    `Mata Pelajaran: ${CONFIG.MATA_PELAJARAN} • Kelas ${CONFIG.KELAS} • Jumlah Soal: ${questions.length} Butir • KKTP: ${CONFIG.KKTP}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 5.5;

  const itemStats = computeItemStatistics(questions, results);
  const totalStudents = results.length;
  const tuntasCount = results.filter((r) => isResultTuntas(r)).length;
  const avgScore =
    totalStudents > 0
      ? (results.reduce((s, r) => s + (r.nilai || 0), 0) / totalStudents).toFixed(1)
      : '0';

  // Ringkasan KPI
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginLeft, y, contentWidth, 11, 1.5, 1.5, 'FD');
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Peserta: ${totalStudents} Siswa   |   Tuntas (≥${CONFIG.KKTP}): ${tuntasCount}   |   Remedial (<${CONFIG.KKTP}): ${
      totalStudents - tuntasCount
    }   |   Rata-rata Kelas: ${avgScore}   |   Keterangan Matriks: B = Benar (Hijau), BS = Benar Sebagian (Kuning), S = Salah (Merah)`,
    pageWidth / 2,
    y + 6.8,
    { align: 'center' }
  );
  y += 14;

  // --- BAGIAN A: MATRIKS RESPON SISWA (dibagi 2 blok kolom agar terbaca jelas) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('A. Matriks Respon Siswa Per Butir Soal', marginLeft, y);
  y += 4;

  const chunkRanges = [
    { start: 0, end: Math.ceil(questions.length / 2), label: `Butir Soal 1 – ${Math.ceil(questions.length / 2)}` },
    { start: Math.ceil(questions.length / 2), end: questions.length, label: `Butir Soal ${Math.ceil(questions.length / 2) + 1} – ${questions.length} & Rekap` },
  ];

  chunkRanges.forEach((chunk, chunkIdx) => {
    const sliceQuestions = questions.slice(chunk.start, chunk.end);
    const isLastChunk = chunkIdx === chunkRanges.length - 1;

    if (y + 20 > pageHeight - 18) {
      doc.addPage();
      y = 14;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text(chunk.label, marginLeft, y);
    doc.setTextColor(0, 0, 0);
    y += 2.5;

    const noW = 7;
    const nameW = 42;
    const recapW = isLastChunk ? 48 : 0;
    const itemW = (contentWidth - noW - nameW - recapW) / Math.max(1, sliceQuestions.length);

    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(marginLeft, y, contentWidth, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);

    let cx = marginLeft;
    doc.text('No', cx + noW / 2, y + 4.1, { align: 'center' });
    cx += noW;
    doc.text('Nama Siswa', cx + 1.5, y + 4.1);
    cx += nameW;

    sliceQuestions.forEach((q) => {
      doc.text(String(q.id), cx + itemW / 2, y + 4.1, { align: 'center' });
      cx += itemW;
    });

    if (isLastChunk) {
      doc.text('Skor', cx + 6, y + 4.1, { align: 'center' });
      doc.text('Nilai', cx + 17, y + 4.1, { align: 'center' });
      doc.text('Status', cx + 30, y + 4.1, { align: 'center' });
      doc.text('Durasi', cx + 43, y + 4.1, { align: 'center' });
    }

    doc.setTextColor(0, 0, 0);
    y += 6;

    if (results.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.rect(marginLeft, y, contentWidth, 7, 'S');
      doc.text('Belum ada data respon siswa.', pageWidth / 2, y + 4.7, { align: 'center' });
      y += 9;
    } else {
      results.forEach((r, rIdx) => {
        if (y + 5.5 > pageHeight - 16) {
          doc.addPage();
          y = 14;
        }
        const hasDetail = r.detailJawaban && Object.keys(r.detailJawaban).length > 0;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
        doc.rect(marginLeft, y, contentWidth, 5.5, 'FD');

        cx = marginLeft;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.6);
        doc.text(String(rIdx + 1), cx + noW / 2, y + 3.8, { align: 'center' });
        cx += noW;

        const truncName = doc.splitTextToSize(r.nama || '-', nameW - 2)[0] || r.nama;
        doc.text(truncName, cx + 1.5, y + 3.8);
        cx += nameW;

        sliceQuestions.forEach((q) => {
          if (!hasDetail) {
            doc.setTextColor(148, 163, 184);
            doc.text('-', cx + itemW / 2, y + 3.8, { align: 'center' });
          } else {
            const ev = evaluateSingleQuestion(q, r.detailJawaban?.[q.id]);
            if (ev.status === 'correct') {
              doc.setFillColor(220, 252, 231);
              doc.rect(cx, y, itemW, 5.5, 'FD');
              doc.setTextColor(21, 128, 61);
              doc.setFont('helvetica', 'bold');
              doc.text('B', cx + itemW / 2, y + 3.8, { align: 'center' });
            } else if (ev.status === 'partial') {
              doc.setFillColor(254, 243, 199);
              doc.rect(cx, y, itemW, 5.5, 'FD');
              doc.setTextColor(180, 83, 9);
              doc.setFont('helvetica', 'bold');
              doc.text('BS', cx + itemW / 2, y + 3.8, { align: 'center' });
            } else {
              doc.setFillColor(254, 226, 226);
              doc.rect(cx, y, itemW, 5.5, 'FD');
              doc.setTextColor(185, 28, 28);
              doc.setFont('helvetica', 'bold');
              doc.text('S', cx + itemW / 2, y + 3.8, { align: 'center' });
            }
          }
          doc.setTextColor(0, 0, 0);
          cx += itemW;
        });

        if (isLastChunk) {
          const isPass = isResultTuntas(r);
          doc.setFont('helvetica', 'bold');
          doc.text(String(r.totalSkor ?? r.nilai), cx + 6, y + 3.8, { align: 'center' });
          doc.text(String(r.nilai), cx + 17, y + 3.8, { align: 'center' });
          doc.setTextColor(isPass ? 21 : 185, isPass ? 128 : 28, isPass ? 61 : 28);
          doc.text(isPass ? 'Tuntas' : 'Remedial', cx + 30, y + 3.8, { align: 'center' });
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.text(r.durasi || '-', cx + 43, y + 3.8, { align: 'center' });
        }

        y += 5.5;
      });
    }

    y += 4;
  });

  // --- BAGIAN B: STATISTIK ANALISIS PER BUTIR SOAL ---
  if (y + 30 > pageHeight - 16) {
    doc.addPage();
    y = 14;
  } else {
    y += 3;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('B. Rekapitulasi Statistik & Tingkat Kesukaran Empiris Per Butir Soal', marginLeft, y);
  y += 4;

  const statCols = [
    { title: 'No Soal', width: 16, align: 'center' as const },
    { title: 'Lingkup Materi', width: 65, align: 'left' as const },
    { title: 'Bentuk Soal', width: 32, align: 'center' as const },
    { title: 'Bobot', width: 16, align: 'center' as const },
    { title: 'Jml Benar', width: 24, align: 'center' as const },
    { title: 'Jml Sebagian', width: 24, align: 'center' as const },
    { title: '% Ketercapaian', width: 28, align: 'center' as const },
    { title: 'Kesukaran Empiris', width: 32, align: 'center' as const },
    { title: 'Rekomendasi Butir', width: 40, align: 'center' as const },
  ];

  const drawStatHeader = (curY: number) => {
    doc.setFillColor(30, 58, 138);
    doc.rect(marginLeft, curY, contentWidth, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let cx = marginLeft;
    statCols.forEach((c) => {
      const tx = c.align === 'center' ? cx + c.width / 2 : cx + 2;
      doc.text(c.title, tx, curY + 4.4, { align: c.align });
      cx += c.width;
    });
    doc.setTextColor(0, 0, 0);
  };

  drawStatHeader(y);
  y += 6.5;

  itemStats.forEach((st, idx) => {
    if (y + 5.8 > pageHeight - 15) {
      doc.addPage();
      y = 14;
      drawStatHeader(y);
      y += 6.5;
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, 5.8, 'FD');

    const typeLabel =
      st.question.type === 'pg'
        ? 'Pilihan Ganda'
        : st.question.type === 'pgk_kategori'
        ? 'PGK Kategori'
        : st.question.type === 'isian'
        ? 'Isian Singkat'
        : 'PGK';

    const actionNote =
      st.empiricalDifficulty === '-'
        ? 'Belum ada data'
        : st.empiricalDifficulty === 'Sukar'
        ? 'Perlu Penguatan / Revisi'
        : st.empiricalDifficulty === 'Sedang'
        ? 'Baik (Dipertahankan)'
        : 'Sangat Dikuasai';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    let cx = marginLeft;

    doc.setFont('helvetica', 'bold');
    doc.text(String(st.question.id), cx + statCols[0].width / 2, y + 4, { align: 'center' });
    cx += statCols[0].width;

    doc.setFont('helvetica', 'normal');
    doc.text(st.question.topic, cx + 2, y + 4);
    cx += statCols[1].width;

    doc.text(typeLabel, cx + statCols[2].width / 2, y + 4, { align: 'center' });
    cx += statCols[2].width;

    doc.text(String(st.question.weight), cx + statCols[3].width / 2, y + 4, { align: 'center' });
    cx += statCols[3].width;

    doc.text(String(st.correctCount), cx + statCols[4].width / 2, y + 4, { align: 'center' });
    cx += statCols[4].width;

    doc.text(String(st.partialCount), cx + statCols[5].width / 2, y + 4, { align: 'center' });
    cx += statCols[5].width;

    doc.setFont('helvetica', 'bold');
    doc.text(st.respondentsWithDetail > 0 ? `${st.achievementPercent}%` : '-', cx + statCols[6].width / 2, y + 4, { align: 'center' });
    cx += statCols[6].width;

    if (st.empiricalDifficulty === 'Mudah') doc.setTextColor(21, 128, 61);
    else if (st.empiricalDifficulty === 'Sukar') doc.setTextColor(185, 28, 28);
    else if (st.empiricalDifficulty === 'Sedang') doc.setTextColor(180, 83, 9);
    doc.text(st.empiricalDifficulty, cx + statCols[7].width / 2, y + 4, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    cx += statCols[7].width;

    doc.setFont('helvetica', 'normal');
    doc.text(actionNote, cx + statCols[8].width / 2, y + 4, { align: 'center' });

    y += 5.8;
  });

  // --- TANDA TANGAN KEPALA SEKOLAH & GURU ---
  if (y + 38 > pageHeight - 10) {
    doc.addPage();
    y = 18;
  } else {
    y += 8;
  }

  const tglStr = formatIndonesianDate();
  const colLeftX = marginLeft + 18;
  const colRightX = pageWidth - marginRight - 70;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Mengetahui,', colLeftX, y);
  doc.text('Kepala Sekolah,', colLeftX, y + 4.3);

  doc.text(`${CONFIG.KOTA}, ${tglStr}`, colRightX, y);
  doc.text(`Guru Kelas ${CONFIG.KELAS},`, colRightX, y + 4.3);

  const sigY = y + 21;
  doc.setFont('helvetica', 'bold');
  doc.text(CONFIG.KEPALA_SEKOLAH, colLeftX, sigY);
  doc.line(colLeftX, sigLineOrVal(sigY), colLeftX + 55, sigLineOrVal(sigY));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${CONFIG.NIP_KEPALA_SEKOLAH}`, colLeftX, sigY + 4.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(CONFIG.GURU, colRightX, sigY);
  doc.line(colRightX, sigLineOrVal(sigY), colRightX + 55, sigLineOrVal(sigY));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${CONFIG.NIP_GURU}`, colRightX, sigY + 4.8);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Laporan Analisis Butir Soal • ${CONFIG.SEKOLAH} • ${CONFIG.MATA_PELAJARAN} Kelas ${CONFIG.KELAS}`,
      marginLeft,
      pageHeight - 5
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginRight, pageHeight - 5, {
      align: 'right',
    });
  }

  doc.save(`Laporan_Analisis_Butir_Soal_Matematika_Kelas_${CONFIG.KELAS}.pdf`);
}

function sigLineOrVal(y: number): number {
  return y + 1;
}
