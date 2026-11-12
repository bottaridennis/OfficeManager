import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Device, SystemLog, DeviceHistoryEntry } from '../types';

/**
 * Format timestamp or Date object into human-readable Italian date string
 */
export function formatDate(timestamp: any): string {
  if (!timestamp) return '-';
  try {
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString('it-IT');
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString('it-IT');
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('it-IT');
      }
    }
  } catch (e) {
    // fallback
  }
  return String(timestamp);
}

/**
 * Trigger browser file download for text/csv data
 */
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =========================================================================
// INVENTORY EXPORTS (CSV & PDF)
// =========================================================================

export function exportDevicesToCsv(devices: Device[], customFilename?: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `inventario_dispositivi_${dateStr}.csv`;

  const rows = devices.map(d => {
    const specsStr = Object.entries(d.dynamicFields || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');

    let statusStr = 'Disponibile (Magazzino)';
    if (d.isUnderMaintenance) statusStr = 'In Manutenzione';
    else if (d.assignedToUserId) statusStr = `Assegnato a ${d.assignedToUserEmail || 'Utente'}`;

    return {
      'ID Dispositivo': d.id,
      'Categoria / Modello': d.category,
      'Numero Seriale': d.serialNumber,
      'Stato': statusStr,
      'Assegnato A (Email)': d.assignedToUserEmail || '',
      'In Manutenzione': d.isUnderMaintenance ? 'Sì' : 'No',
      'Specifiche Tecniche': specsStr,
      'Numero Interventi Storico': d.history?.length || 0,
      'Data Registrazione': formatDate(d.createdAt),
      'Ultimo Aggiornamento': formatDate(d.updatedAt),
    };
  });

  const csv = Papa.unparse(rows, { delimiter: ';' });
  // Add UTF-8 BOM so Excel opens Italian characters properly
  downloadFile('\uFEFF' + csv, filename, 'text/csv;charset=utf-8;');
}

export function exportDevicesToPdf(devices: Device[], title = 'Inventario Dispositivi IT') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleString('it-IT');
  const filename = `inventario_dispositivi_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Summary counts
  const total = devices.length;
  const inMaintenance = devices.filter(d => d.isUnderMaintenance).length;
  const assigned = devices.filter(d => !!d.assignedToUserId && !d.isUnderMaintenance).length;
  const available = total - inMaintenance - assigned;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICE MANAGER - ' + title.toUpperCase(), 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generato il: ${dateStr} | Audit & Controllo Magazzino`, 297 - 14, 15, { align: 'right' });

  // KPI Sub-header Bar
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 28, 269, 14, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 28, 269, 14, 'S');

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Totale Asset: ${total}`, 20, 37);
  doc.setTextColor(22, 101, 52); // green
  doc.text(`Disponibili: ${available}`, 80, 37);
  doc.setTextColor(30, 64, 175); // blue
  doc.text(`In Uso: ${assigned}`, 145, 37);
  doc.setTextColor(180, 83, 9); // amber
  doc.text(`In Manutenzione: ${inMaintenance}`, 210, 37);

  // Table rows
  const tableRows = devices.map(d => {
    let statusLabel = 'Disponibile';
    if (d.isUnderMaintenance) statusLabel = 'In Manutenzione';
    else if (d.assignedToUserId) statusLabel = 'In Uso';

    const specsPreview = Object.entries(d.dynamicFields || {})
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return [
      d.category,
      d.serialNumber,
      statusLabel,
      d.assignedToUserEmail ? d.assignedToUserEmail.split('@')[0] : 'In Magazzino',
      specsPreview || '-',
      formatDate(d.updatedAt || d.createdAt)
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [['Categoria / Modello', 'Numero Seriale', 'Stato', 'Assegnazione', 'Specifiche', 'Aggiornamento']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Pagina ${data.pageNumber} di ${pageCount} - Documento confidenziale ad uso interno / auditing`,
        14,
        205
      );
    }
  });

  doc.save(filename);
}

// =========================================================================
// MAINTENANCE LOGS EXPORTS (CSV & PDF)
// =========================================================================

export interface MaintenanceExportItem {
  id?: string;
  date: any;
  category: string;
  serialNumber: string;
  action: string;
  operator: string;
  notes: string;
  deviceId?: string;
}

export function exportMaintenanceLogsToCsv(items: MaintenanceExportItem[], customFilename?: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `registro_manutenzioni_${dateStr}.csv`;

  const rows = items.map(item => ({
    'Data e Ora': formatDate(item.date),
    'Dispositivo': item.category,
    'Numero Seriale': item.serialNumber,
    'Tipo Intervento': item.action,
    'Tecnico / Operatore': item.operator,
    'Note & Descrizione': item.notes,
    'ID Dispositivo': item.deviceId || '',
  }));

  const csv = Papa.unparse(rows, { delimiter: ';' });
  downloadFile('\uFEFF' + csv, filename, 'text/csv;charset=utf-8;');
}

export function exportMaintenanceLogsToPdf(
  items: MaintenanceExportItem[], 
  reportTitle = 'Registro Interventi di Manutenzione'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleString('it-IT');
  const filename = `registro_manutenzioni_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICE MANAGER - ' + reportTitle.toUpperCase(), 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Generato il: ${dateStr} | Registro Ufficiale Interventi`, 297 - 14, 15, { align: 'right' });

  // KPI Sub-header Bar
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 28, 269, 14, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 28, 269, 14, 'S');

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Totale Registrazioni: ${items.length}`, 20, 37);

  const startCount = items.filter(i => i.action.toLowerCase().includes('inizi') || i.action.toLowerCase().includes('start')).length;
  const endCount = items.filter(i => i.action.toLowerCase().includes('termin') || i.action.toLowerCase().includes('end')).length;

  doc.setTextColor(180, 83, 9); // amber
  doc.text(`Avvii Manutenzione: ${startCount}`, 110, 37);
  doc.setTextColor(22, 101, 52); // green
  doc.text(`Chiusure / Risoluzioni: ${endCount}`, 200, 37);

  // Table rows
  const tableRows = items.map(i => [
    formatDate(i.date),
    `${i.category} (${i.serialNumber})`,
    i.action,
    i.operator,
    i.notes || '-'
  ]);

  autoTable(doc, {
    startY: 46,
    head: [['Data / Ora', 'Dispositivo & Seriale', 'Azione / Stato', 'Tecnico Responsabile', 'Note & Risoluzione']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [217, 119, 6], // amber-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 55 },
      2: { cellWidth: 42 },
      3: { cellWidth: 50 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Pagina ${data.pageNumber} di ${pageCount} - Registro Storico Manutenzioni IT`,
        14,
        205
      );
    }
  });

  doc.save(filename);
}

// =========================================================================
// AUDIT SYSTEM LOGS EXPORTS (CSV & PDF)
// =========================================================================

export function exportSystemLogsToCsv(logs: SystemLog[], customFilename?: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `audit_logs_${dateStr}.csv`;

  const rows = logs.map(l => ({
    'Data e Ora': formatDate(l.createdAt),
    'Azione': l.action,
    'Collezione': l.collection,
    'Utente Operatore': l.userEmail,
    'Descrizione': l.description,
    'ID Record / Target': l.targetId || '',
    'ID Log': l.id
  }));

  const csv = Papa.unparse(rows, { delimiter: ';' });
  downloadFile('\uFEFF' + csv, filename, 'text/csv;charset=utf-8;');
}

export function exportSystemLogsToPdf(logs: SystemLog[], reportTitle = 'Log di Sistema & Audit Trail') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleString('it-IT');
  const filename = `audit_logs_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICE MANAGER - ' + reportTitle.toUpperCase(), 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Generato il: ${dateStr} | Compliance & Security Audit`, 297 - 14, 15, { align: 'right' });

  // Table rows
  const tableRows = logs.map(l => [
    formatDate(l.createdAt),
    l.action.toUpperCase(),
    l.collection,
    l.userEmail,
    l.description || '-'
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Data / Ora', 'Azione', 'Modulo', 'Utente', 'Descrizione Evento']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [71, 85, 105], // slate-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 50 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Pagina ${data.pageNumber} di ${pageCount} - Log di Sicurezza & Audit Trail`,
        14,
        205
      );
    }
  });

  doc.save(filename);
}

// =========================================================================
// QA TESTING REPORT EXPORTS (PDF & CSV)
// =========================================================================

export interface QATestExportItem {
  id: string;
  category: string;
  title: string;
  precondition: string;
  procedure: string;
  expectedResult: string;
  status: 'passed' | 'failed' | 'pending' | 'in_progress';
  notes: string;
  testedBy?: string;
  testedAt?: string;
}

export function exportQATestReportToCsv(items: QATestExportItem[], customFilename?: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `report_collaudo_qa_${dateStr}.csv`;

  const rows = items.map(item => ({
    'ID Test': item.id,
    'Ambito / Modulo': item.category,
    'Scenario di Test': item.title,
    'Stato Esito': item.status === 'passed' ? 'SUPERATO (PASS)' :
                   item.status === 'failed' ? 'NON SUPERATO (FAIL)' :
                   item.status === 'in_progress' ? 'IN CORSO' : 'DA TESTARE',
    'Precondizioni': item.precondition,
    'Procedura Operativa': item.procedure,
    'Risultato Atteso': item.expectedResult,
    'Note / Evidenze Operatore': item.notes || '',
    'Data Verifica': item.testedAt || '',
    'Operatore QA': item.testedBy || ''
  }));

  const csv = Papa.unparse(rows, { delimiter: ';' });
  downloadFile('\uFEFF' + csv, filename, 'text/csv;charset=utf-8;');
}

export function exportQATestReportToPdf(
  items: QATestExportItem[], 
  stats: { total: number; passed: number; failed: number; pending: number },
  testerInfo?: { name: string; email: string; role: string }
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleString('it-IT');
  const filename = `verbale_collaudo_qa_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICE MANAGER - VERBALE DI COLLAUDO & QA TESTING', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Data Generazione: ${dateStr}`, 220, 15);

  // Subtitle & Statistics Bar
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, 28, 269, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
  
  doc.text(
    `Totale Scenari: ${stats.total}  |  Superati (PASS): ${stats.passed}  |  Non Superati (FAIL): ${stats.failed}  |  Da Eseguire: ${stats.pending}  |  Esito: ${passRate}% Conforme`,
    20,
    37
  );

  if (testerInfo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Ispettore / Collaudatore: ${testerInfo.name || testerInfo.email} (${testerInfo.role})`, 20, 48);
  }

  const tableRows = items.map(item => [
    item.id,
    item.category,
    item.title,
    item.status === 'passed' ? 'PASS' :
    item.status === 'failed' ? 'FAIL' :
    item.status === 'in_progress' ? 'IN CORSO' : 'DA FARE',
    item.expectedResult,
    item.notes || '-'
  ]);

  autoTable(doc, {
    startY: testerInfo ? 52 : 46,
    head: [['Codice', 'Modulo', 'Scenario di Test', 'Esito', 'Risultato Atteso', 'Note / Esito Operatore']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 65 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 65 },
      5: { cellWidth: 'auto' },
    },
    didParseCell: function(data) {
      if (data.column.index === 3 && data.section === 'body') {
        if (data.cell.raw === 'PASS') {
          data.cell.styles.textColor = [22, 101, 52]; // emerald-800
          data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'FAIL') {
          data.cell.styles.textColor = [153, 27, 27]; // rose-800
          data.cell.styles.fillColor = [254, 226, 226]; // rose-100
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Pagina ${data.pageNumber} di ${pageCount} - Verbale Ufficiale di Collaudo Operativo`,
        14,
        205
      );
    }
  });

  doc.save(filename);
}
