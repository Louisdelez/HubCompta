// ============================================================================
// CSV PARSER - Finance Hub
// ============================================================================

import { parse } from 'csv-parse/sync';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ParsedRow {
  [key: string]: string;
}

export interface CSVParseResult {
  headers: string[];
  rows: ParsedRow[];
  detectedFormat: DetectedFormat | null;
  totalRows: number;
  sampleRows: ParsedRow[];
}

export interface DetectedFormat {
  bank: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  dateFormat: string;
  amountFormat: 'standard' | 'french' | 'split';
  creditColumn?: string;
  debitColumn?: string;
}

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  credit?: string;
  debit?: string;
  category?: string;
  notes?: string;
}

// ----------------------------------------------------------------------------
// Bank Format Patterns
// ----------------------------------------------------------------------------

const BANK_PATTERNS: { bank: string; patterns: RegExp[]; format: Partial<DetectedFormat> }[] = [
  {
    bank: 'Boursorama',
    patterns: [/dateOp/i, /dateVal/i, /libelle/i],
    format: {
      dateColumn: 'dateOp',
      amountColumn: 'montant',
      descriptionColumn: 'libelle',
      dateFormat: 'DD/MM/YYYY',
      amountFormat: 'french',
    },
  },
  {
    bank: 'Crédit Agricole',
    patterns: [/Date opération/i, /Libellé/i, /Débit/i, /Crédit/i],
    format: {
      dateColumn: 'Date opération',
      descriptionColumn: 'Libellé',
      dateFormat: 'DD/MM/YYYY',
      amountFormat: 'split',
      debitColumn: 'Débit',
      creditColumn: 'Crédit',
    },
  },
  {
    bank: 'BNP Paribas',
    patterns: [/Date/i, /Libelle/i, /Valeur/i],
    format: {
      dateColumn: 'Date',
      amountColumn: 'Montant',
      descriptionColumn: 'Libelle',
      dateFormat: 'DD/MM/YYYY',
      amountFormat: 'french',
    },
  },
  {
    bank: 'Société Générale',
    patterns: [/Date de l'opération/i, /Détail de l'opération/i],
    format: {
      dateColumn: "Date de l'opération",
      amountColumn: 'Montant',
      descriptionColumn: "Détail de l'opération",
      dateFormat: 'DD/MM/YYYY',
      amountFormat: 'french',
    },
  },
  {
    bank: 'La Banque Postale',
    patterns: [/Date comptable/i, /Libellé opération/i],
    format: {
      dateColumn: 'Date comptable',
      amountColumn: 'Montant',
      descriptionColumn: 'Libellé opération',
      dateFormat: 'DD/MM/YYYY',
      amountFormat: 'french',
    },
  },
  {
    bank: 'N26',
    patterns: [/Date/i, /Payee/i, /Amount \(EUR\)/i],
    format: {
      dateColumn: 'Date',
      amountColumn: 'Amount (EUR)',
      descriptionColumn: 'Payee',
      dateFormat: 'YYYY-MM-DD',
      amountFormat: 'standard',
    },
  },
  {
    bank: 'Revolut',
    patterns: [/Started Date/i, /Description/i, /Amount/i],
    format: {
      dateColumn: 'Started Date',
      amountColumn: 'Amount',
      descriptionColumn: 'Description',
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      amountFormat: 'standard',
    },
  },
];

// ----------------------------------------------------------------------------
// CSV Parser
// ----------------------------------------------------------------------------

export const csvParser = {
  /**
   * Parse CSV content and detect format
   */
  parse(content: string, options: { delimiter?: string; encoding?: string } = {}): CSVParseResult {
    // Detect delimiter if not provided
    const delimiter = options.delimiter ?? this.detectDelimiter(content);

    // Parse CSV
    const records: ParsedRow[] = parse(content, {
      delimiter,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (records.length === 0 || !records[0]) {
      return {
        headers: [],
        rows: [],
        detectedFormat: null,
        totalRows: 0,
        sampleRows: [],
      };
    }

    const headers = Object.keys(records[0]);
    const detectedFormat = this.detectFormat(headers, records);

    return {
      headers,
      rows: records,
      detectedFormat,
      totalRows: records.length,
      sampleRows: records.slice(0, 5),
    };
  },

  /**
   * Detect CSV delimiter
   */
  detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0] ?? '';
    const delimiters = [';', ',', '\t', '|'];
    let maxCount = 0;
    let detected = ',';

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detected = delimiter;
      }
    }

    return detected;
  },

  /**
   * Detect bank format from headers
   */
  detectFormat(headers: string[], rows: ParsedRow[]): DetectedFormat | null {
    // Try to match known bank patterns
    for (const { bank, patterns, format } of BANK_PATTERNS) {
      const matches = patterns.every((pattern) =>
        headers.some((h) => pattern.test(h))
      );

      if (matches) {
        return {
          bank,
          dateColumn: format.dateColumn!,
          amountColumn: format.amountColumn ?? '',
          descriptionColumn: format.descriptionColumn!,
          dateFormat: format.dateFormat!,
          amountFormat: format.amountFormat!,
          creditColumn: format.creditColumn,
          debitColumn: format.debitColumn,
        };
      }
    }

    // Try generic detection
    return this.detectGenericFormat(headers, rows);
  },

  /**
   * Generic format detection based on column content
   */
  detectGenericFormat(headers: string[], rows: ParsedRow[]): DetectedFormat | null {
    let dateColumn: string | null = null;
    let amountColumn: string | null = null;
    let descriptionColumn: string | null = null;

    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      const sampleValues = rows.slice(0, 5).map((r) => r[header]).filter((v): v is string => v !== undefined);

      // Detect date column
      if (!dateColumn && this.looksLikeDateColumn(lowerHeader, sampleValues)) {
        dateColumn = header;
      }

      // Detect amount column
      if (!amountColumn && this.looksLikeAmountColumn(lowerHeader, sampleValues)) {
        amountColumn = header;
      }

      // Detect description column
      if (!descriptionColumn && this.looksLikeDescriptionColumn(lowerHeader, sampleValues)) {
        descriptionColumn = header;
      }
    }

    if (!dateColumn || !amountColumn || !descriptionColumn) {
      return null;
    }

    // Detect date format
    const dateFormat = this.detectDateFormat(rows.slice(0, 5).map((r) => r[dateColumn]).filter((v): v is string => v !== undefined));

    // Detect amount format
    const amountFormat = this.detectAmountFormat(rows.slice(0, 5).map((r) => r[amountColumn]).filter((v): v is string => v !== undefined));

    return {
      bank: 'Generic',
      dateColumn,
      amountColumn,
      descriptionColumn,
      dateFormat,
      amountFormat,
    };
  },

  /**
   * Check if column looks like a date
   */
  looksLikeDateColumn(header: string, values: string[]): boolean {
    const dateKeywords = ['date', 'jour', 'day', 'when', 'quand'];
    if (dateKeywords.some((k) => header.includes(k))) return true;

    // Check if values look like dates
    const datePatterns = [
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}-\d{2}-\d{4}$/,
    ];

    return values.filter((v) => v).some((v) =>
      datePatterns.some((p) => p.test(v.trim()))
    );
  },

  /**
   * Check if column looks like an amount
   */
  looksLikeAmountColumn(header: string, values: string[]): boolean {
    const amountKeywords = ['amount', 'montant', 'somme', 'valeur', 'credit', 'debit'];
    if (amountKeywords.some((k) => header.includes(k))) return true;

    // Check if values look like numbers
    return values.filter((v) => v).some((v) => {
      const cleaned = v.replace(/[€$£\s]/g, '').replace(',', '.');
      return !isNaN(parseFloat(cleaned));
    });
  },

  /**
   * Check if column looks like a description
   */
  looksLikeDescriptionColumn(header: string, values: string[]): boolean {
    const descKeywords = ['description', 'libelle', 'label', 'payee', 'beneficiaire', 'detail'];
    if (descKeywords.some((k) => header.includes(k))) return true;

    // Check if values are text (not just numbers/dates)
    return values.filter((v) => v).some((v) => v.length > 10 && /[a-zA-Z]/.test(v));
  },

  /**
   * Detect date format from sample values
   */
  detectDateFormat(values: string[]): string {
    for (const value of values) {
      if (!value) continue;
      const v = value.trim();

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return 'DD/MM/YYYY';
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'YYYY-MM-DD';
      if (/^\d{2}-\d{2}-\d{4}$/.test(v)) return 'DD-MM-YYYY';
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) return 'DD.MM.YYYY';
    }

    return 'DD/MM/YYYY'; // Default to French format
  },

  /**
   * Detect amount format from sample values
   */
  detectAmountFormat(values: string[]): 'standard' | 'french' {
    for (const value of values) {
      if (!value) continue;

      // French format uses comma as decimal separator
      if (/\d+,\d{2}$/.test(value)) return 'french';
    }

    return 'standard';
  },

  /**
   * Parse amount based on format
   */
  parseAmount(value: string, format: 'standard' | 'french' | 'split'): number {
    if (!value || value.trim() === '') return 0;

    let cleaned = value.replace(/[€$£\s]/g, '');

    if (format === 'french') {
      // French: 1 234,56 -> 1234.56
      cleaned = cleaned.replace(/\s/g, '').replace(',', '.');
    }

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  },

  /**
   * Parse date based on format
   */
  parseDate(value: string, format: string): Date | null {
    if (!value || value.trim() === '') return null;

    const v = value.trim();
    let day: number, month: number, year: number;

    try {
      let parts: number[];
      switch (format) {
        case 'DD/MM/YYYY':
          parts = v.split('/').map(Number);
          day = parts[0] ?? 0;
          month = parts[1] ?? 0;
          year = parts[2] ?? 0;
          break;
        case 'YYYY-MM-DD':
          parts = v.split('-').map(Number);
          year = parts[0] ?? 0;
          month = parts[1] ?? 0;
          day = parts[2] ?? 0;
          break;
        case 'DD-MM-YYYY':
          parts = v.split('-').map(Number);
          day = parts[0] ?? 0;
          month = parts[1] ?? 0;
          year = parts[2] ?? 0;
          break;
        case 'DD.MM.YYYY':
          parts = v.split('.').map(Number);
          day = parts[0] ?? 0;
          month = parts[1] ?? 0;
          year = parts[2] ?? 0;
          break;
        default:
          return new Date(v);
      }

      if (!day || !month || !year) return null;

      return new Date(year, month - 1, day);
    } catch {
      return null;
    }
  },

  /**
   * Transform rows using column mapping
   */
  transformRows(
    rows: ParsedRow[],
    mapping: ColumnMapping,
    format: DetectedFormat
  ): Array<{
    date: Date | null;
    amount: number;
    description: string;
    notes?: string;
  }> {
    return rows.map((row) => {
      let amount: number;

      if (format.amountFormat === 'split' && mapping.credit && mapping.debit) {
        const credit = this.parseAmount(row[mapping.credit] ?? '', 'french');
        const debit = this.parseAmount(row[mapping.debit] ?? '', 'french');
        amount = credit > 0 ? credit : -debit;
      } else {
        amount = this.parseAmount(row[mapping.amount] ?? '', format.amountFormat);
      }

      return {
        date: this.parseDate(row[mapping.date] ?? '', format.dateFormat),
        amount,
        description: row[mapping.description]?.trim() ?? '',
        notes: mapping.notes ? row[mapping.notes]?.trim() : undefined,
      };
    });
  },
};

export default csvParser;
