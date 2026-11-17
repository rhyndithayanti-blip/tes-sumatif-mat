import { CONFIG } from '../config';
import { ExamResult } from '../types';

/**
 * Service untuk komunikasi dengan Google Apps Script Web App & Penyimpanan Lokal
 */

const STORAGE_LOCAL_RESULTS_KEY = 'sdn3_loloan_timur_matematika4_results_v1';
const STORAGE_CUSTOM_GAS_URL_KEY = 'sd3_custom_gas_url';

export const gasService = {
  /**
   * Mendapatkan URL Google Apps Script yang aktif
   */
  getGasUrl(): string {
    try {
      const custom = localStorage.getItem(STORAGE_CUSTOM_GAS_URL_KEY);
      if (custom && custom.trim().startsWith('http')) {
        if (custom.includes('AKfycbzBuJrheUE3MRAvNlUEZut3q0LQL5-J62sy8w_rfsBz72VJGt7IHyFPj0WORSB8dUCmeQ')) {
          localStorage.removeItem(STORAGE_CUSTOM_GAS_URL_KEY);
          return CONFIG.GOOGLE_APPS_SCRIPT_URL;
        }
        return custom.trim();
      }
    } catch {
      // ignore
    }
    return CONFIG.GOOGLE_APPS_SCRIPT_URL;
  },

  /**
   * Menyimpan URL Google Apps Script kustom
   */
  setGasUrl(url: string): void {
    try {
      if (!url || !url.trim()) {
        localStorage.removeItem(STORAGE_CUSTOM_GAS_URL_KEY);
      } else {
        localStorage.setItem(STORAGE_CUSTOM_GAS_URL_KEY, url.trim());
      }
    } catch (e) {
      console.warn('Gagal menyimpan URL GAS kustom ke localStorage:', e);
    }
  },

  /**
   * Mengembalikan URL ke default
   */
  resetGasUrl(): void {
    try {
      localStorage.removeItem(STORAGE_CUSTOM_GAS_URL_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Mengambil hasil tes yang tersimpan di perangkat lokal
   */
  getLocalExamResults(): ExamResult[] {
    try {
      const saved = localStorage.getItem(STORAGE_LOCAL_RESULTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Gagal membaca data hasil tes lokal:', e);
    }
    return [];
  },

  /**
   * Menyimpan hasil tes ke penyimpanan lokal (Zero Data Loss)
   */
  saveLocalExamResult(result: ExamResult): void {
    try {
      const current = this.getLocalExamResults();
      const existingIdx = current.findIndex(
        (item) =>
          item.id === result.id ||
          (item.nama.toLowerCase() === result.nama.toLowerCase() &&
            item.timestamp === result.timestamp)
      );

      if (existingIdx >= 0) {
        current[existingIdx] = result;
      } else {
        current.unshift(result);
      }

      localStorage.setItem(STORAGE_LOCAL_RESULTS_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Gagal menyimpan hasil tes ke localStorage:', e);
    }
  },

  /**
   * Menghapus hasil tes dari penyimpanan lokal
   */
  deleteLocalExamResult(idOrTimestamp: string, nama?: string): void {
    try {
      const current = this.getLocalExamResults();
      const filtered = current.filter(
        (r) =>
          r.id !== idOrTimestamp &&
          r.timestamp !== idOrTimestamp &&
          !(nama && r.nama.toLowerCase() === nama.toLowerCase())
      );
      localStorage.setItem(STORAGE_LOCAL_RESULTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Gagal menghapus data hasil tes lokal:', e);
    }
  },

  /**
   * Menguji koneksi ke URL Google Apps Script
   */
  async testGasConnection(
    customUrl?: string
  ): Promise<{ success: boolean; message: string; rowCount?: number }> {
    const url = (customUrl || this.getGasUrl()).trim();
    if (!url || !url.startsWith('http')) {
      return { success: false, message: 'URL Google Apps Script tidak valid.' };
    }

    try {
      const testUrl = `${url}${url.includes('?') ? '&' : '?'}action=read&t=${Date.now()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(testUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            message:
              'Server merespons HTTP 404 (Not Found). Pastikan Web App sudah di-Deploy dengan jenis "Web App" dan akses "Anyone" (Siapa saja).',
          };
        }
        return {
          success: false,
          message: `Server merespons status HTTP ${response.status}`,
        };
      }

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        return {
          success: true,
          message: 'Terhubung ke server Google Apps Script (Respons non-JSON).',
          rowCount: 0,
        };
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.rows)
        ? data.rows
        : [];

      return {
        success: true,
        message: `Koneksi berhasil! Terhubung ke Google Spreadsheet (${list.length} baris data ditemukan).`,
        rowCount: list.length,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Koneksi waktu habis (Timeout 8 detik). Server Google Apps Script lambat merespons.',
        };
      }
      return {
        success: false,
        message:
          err.message ||
          'Gagal terhubung ke Google Apps Script. Periksa koneksi internet atau hak akses Web App.',
      };
    }
  },

  /**
   * Mengirim hasil tes siswa ke Google Apps Script Web App & Penyimpanan Lokal
   */
  async submitExamResult(
    result: ExamResult
  ): Promise<{ success: boolean; message: string; savedLocally: boolean }> {
    this.saveLocalExamResult(result);

    const url = this.getGasUrl();
    if (!url || !url.startsWith('http')) {
      return {
        success: true,
        savedLocally: true,
        message: 'Hasil tes berhasil disimpan di perangkat ini.',
      };
    }

    const payload = {
      action: 'submit',
      id: result.id || `res-${Date.now()}`,
      timestamp: result.timestamp || new Date().toLocaleString('id-ID'),
      nama: result.nama,
      kelas: result.kelas || CONFIG.KELAS,
      noAbsen: result.noAbsen,
      tglLahir: result.tglLahir || '',
      benar: result.benar,
      benarSebagian: result.benarSebagian ?? 0,
      salah: result.salah,
      totalSkor: result.totalSkor ?? result.nilai,
      maxSkor: result.maxSkor ?? 100,
      nilai: result.nilai,
      status: result.status,
      durasi: result.durasi || '-',
      durationSeconds: result.durationSeconds ?? 0,
      mataPelajaran: CONFIG.MATA_PELAJARAN,
      sekolah: CONFIG.SEKOLAH,
      studentName: result.nama,
      className: result.kelas || CONFIG.KELAS,
      absenNumber: result.noAbsen,
      birthDate: result.tglLahir || '',
      correctCount: result.benar,
      incorrectCount: result.salah,
      totalQuestions: (result.benar || 0) + (result.benarSebagian || 0) + (result.salah || 0),
      finalScore: result.nilai,
      answers: result.detailJawaban || {},
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`GAS POST merespons HTTP ${response.status}`);
        return {
          success: true,
          savedLocally: true,
          message: `Hasil tes tersimpan di perangkat ini. (Cloud respons HTTP ${response.status})`,
        };
      }

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: true };
      }

      return {
        success: true,
        savedLocally: true,
        message: data.message || 'Jawaban dan hasil tes berhasil disimpan ke Google Spreadsheet.',
      };
    } catch (err: any) {
      console.warn('Gagal sinkronisasi langsung ke Google Apps Script (tersimpan lokal):', err);
      return {
        success: true,
        savedLocally: true,
        message: 'Hasil tes tersimpan di perangkat ini. (Sinkronisasi cloud tertunda)',
      };
    }
  },

  /**
   * Mengambil rekap hasil ujian dari Google Apps Script Web App dan/atau Penyimpanan Lokal
   */
  async fetchExamResults(): Promise<ExamResult[]> {
    const localResults = this.getLocalExamResults();
    const url = this.getGasUrl();

    if (!url || !url.startsWith('http')) {
      return localResults;
    }

    try {
      const readUrl = `${url}${url.includes('?') ? '&' : '?'}action=read&t=${Date.now()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(readUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Google Apps Script merespons HTTP ${response.status}, menggunakan data lokal.`);
        return localResults;
      }

      const raw = await response.json();
      let list: any[] = [];

      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && Array.isArray(raw.data)) {
        list = raw.data;
      } else if (raw && raw.status === 'success' && Array.isArray(raw.rows)) {
        list = raw.rows;
      }

      const remoteResults: ExamResult[] = list
        .filter((item: any) => {
          const name = item.Nama || item.nama || item.studentName || item['Nama Siswa'];
          const mapel = item['Mata Pelajaran'] || item.mataPelajaran || '';
          const validName = name && String(name).trim().length > 0;
          // Filter out unrelated subjects if sheet shared, or allow empty mapel
          if (mapel && !String(mapel).toLowerCase().includes('matematika')) {
            return false;
          }
          return validName;
        })
        .map((item: any, idx: number) => {
          const timestamp =
            item.Timestamp || item.timestamp || item.waktu || new Date().toLocaleString('id-ID');
          const nama =
            item.studentName || item.Nama || item.nama || item['Nama Siswa'] || 'Siswa';
          const kelas = String(item.className || item.Kelas || item.kelas || CONFIG.KELAS);
          const noAbsen = String(
            item.absenNumber || item['Nomor Absen'] || item.noAbsen || item.NoAbsen || '-'
          );
          const benar = Number(item.correctCount ?? item.Benar ?? item.benar ?? 0);
          const benarSebagian = Number(item.benarSebagian ?? item['Benar Sebagian'] ?? 0);
          const salah = Number(item.incorrectCount ?? item.Salah ?? item.salah ?? 0);
          const nilai = Number(item.finalScore ?? item.Nilai ?? item.nilai ?? 0);
          const status = nilai >= CONFIG.KKTP ? 'Lulus' : 'Belum Lulus';
          const tglLahir = item.birthDate || item['Tanggal Lahir'] || item.tglLahir || '';
          const durasi = item.Durasi || item.durasi || undefined;
          const totalSkor =
            item.totalSkor !== undefined ? Number(item.totalSkor) : item['Total Skor'] !== undefined ? Number(item['Total Skor']) : undefined;

          let detailJawaban = item.answers || item.detailJawaban || undefined;
          const rawDetailStr = item['Detail Jawaban'] || item.detailJawabanJson;
          if (!detailJawaban && typeof rawDetailStr === 'string' && rawDetailStr.trim().startsWith('{')) {
            try {
              detailJawaban = JSON.parse(rawDetailStr);
            } catch {
              // ignore
            }
          }

          // Enrich from localStorage if remote doesn't have detailJawaban or durasi
          const localMatch = localResults.find(
            (loc) =>
              loc.nama.trim().toLowerCase() === nama.trim().toLowerCase() &&
              loc.noAbsen === noAbsen
          );

          return {
            id: item.id || localMatch?.id || `gas-${idx}-${timestamp}`,
            timestamp,
            nama,
            kelas,
            noAbsen,
            tglLahir: tglLahir || localMatch?.tglLahir,
            benar,
            benarSebagian: benarSebagian || localMatch?.benarSebagian,
            salah,
            totalSkor: totalSkor ?? localMatch?.totalSkor,
            maxSkor: localMatch?.maxSkor,
            nilai,
            status,
            durasi: durasi || localMatch?.durasi,
            durationSeconds: localMatch?.durationSeconds,
            detailJawaban: detailJawaban || localMatch?.detailJawaban,
          };
        });

      const combined = [...remoteResults];
      localResults.forEach((loc) => {
        const alreadyInRemote = combined.some(
          (rem) =>
            rem.nama.trim().toLowerCase() === loc.nama.trim().toLowerCase() &&
            rem.noAbsen === loc.noAbsen
        );
        if (!alreadyInRemote) {
          combined.push(loc);
        }
      });

      return combined;
    } catch (err: any) {
      console.warn('Error saat fetch dari Google Apps Script, menampilkan data lokal:', err);
      return localResults;
    }
  },

  /**
   * Menghapus data dari Google Spreadsheet via GAS dan Penyimpanan Lokal
   */
  async deleteExamResult(timestamp: string, nama: string): Promise<boolean> {
    this.deleteLocalExamResult(timestamp, nama);

    const url = this.getGasUrl();
    if (!url || !url.startsWith('http')) return true;

    const payload = {
      action: 'delete',
      timestamp,
      nama,
      studentName: nama,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (err: any) {
      console.warn('Gagal menghapus di remote GAS (namun sudah terhapus di lokal):', err);
      return true;
    }
  },

  /**
   * Sinkronisasi seluruh data lokal yang belum masuk ke Google Apps Script
   */
  async syncAllLocalToCloud(): Promise<{ total: number; success: number }> {
    const local = this.getLocalExamResults();
    if (local.length === 0) return { total: 0, success: 0 };

    let successCount = 0;
    for (const item of local) {
      try {
        const res = await this.submitExamResult(item);
        if (res.success) successCount++;
      } catch {
        // ignore
      }
    }
    return { total: local.length, success: successCount };
  },
};

/**
 * Template Skrip Google Apps Script untuk Google Spreadsheet
 */
export const GAS_SCRIPT_TEMPLATE = `/**
 * SKRIP GOOGLE APPS SCRIPT UNTUK REKAP TES SUMATIF
 * SD NEGERI 3 LOLOAN TIMUR - JEMBRANA - KELAS 4
 * MATA PELAJARAN: MATEMATIKA
 */

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = data[0];
    var results = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var item = {};
      for (var j = 0; j < headers.length; j++) {
        var headerKey = String(headers[j]).trim();
        item[headerKey] = row[j];
      }
      results.push(item);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: results }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "{}";
    var contents = JSON.parse(raw);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Inisialisasi Header jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Nama",
        "Kelas",
        "Nomor Absen",
        "Tanggal Lahir",
        "Benar",
        "Salah",
        "Nilai",
        "Status",
        "Mata Pelajaran",
        "Durasi",
        "Total Skor",
        "Detail Jawaban"
      ]);
    }
    
    // Fitur Delete jika diminta
    if (contents.action === "delete") {
      var data = sheet.getDataRange().getValues();
      var targetTimestamp = String(contents.timestamp || "").trim();
      var targetNama = String(contents.nama || contents.studentName || "").trim().toLowerCase();
      
      for (var i = data.length - 1; i >= 1; i--) {
        var rowTime = String(data[i][0]).trim();
        var rowName = String(data[i][1]).trim().toLowerCase();
        if ((targetTimestamp && rowTime === targetTimestamp) || (targetNama && rowName === targetNama)) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Data berhasil dihapus" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Data tidak ditemukan" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Fitur Tambah / Simpan Hasil Tes Siswa
    var timestamp = contents.timestamp || Utilities.formatDate(new Date(), "GMT+8", "dd/MM/yyyy HH:mm:ss");
    var nama = contents.studentName || contents.nama || "";
    var kelas = contents.className || contents.kelas || "4";
    var noAbsen = contents.absenNumber || contents.noAbsen || "";
    var tglLahir = contents.birthDate || contents.tglLahir || "";
    var benar = contents.correctCount !== undefined ? contents.correctCount : (contents.benar || 0);
    var salah = contents.incorrectCount !== undefined ? contents.incorrectCount : (contents.salah || 0);
    var nilai = contents.finalScore !== undefined ? contents.finalScore : (contents.nilai || 0);
    var status = contents.status || (nilai >= 60 ? "Lulus" : "Belum Lulus");
    var mataPelajaran = contents.mataPelajaran || "Matematika";
    var durasi = contents.durasi || "-";
    var totalSkor = contents.totalSkor !== undefined ? contents.totalSkor : nilai;
    var detailJson = contents.answers ? JSON.stringify(contents.answers) : "{}";
    
    sheet.appendRow([
      timestamp,
      nama,
      kelas,
      noAbsen,
      tglLahir,
      benar,
      salah,
      nilai,
      status,
      mataPelajaran,
      durasi,
      totalSkor,
      detailJson
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Hasil tes siswa berhasil disimpan ke spreadsheet"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
