// ============================================================================
// OCR SERVICE - Finance Hub
// Uses Tesseract.js for receipt scanning and data extraction
// ============================================================================

import Tesseract from 'tesseract.js';
import sharp from 'sharp';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ReceiptData {
  merchant?: string;
  amount?: number;
  date?: Date;
  items?: ReceiptItem[];
  confidence: number;
  rawText: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

// Common French supermarket/merchant patterns
const KNOWN_MERCHANTS: Record<string, string[]> = {
  'Carrefour': ['carrefour', 'carref'],
  'Leclerc': ['leclerc', 'e.leclerc', 'e leclerc'],
  'Auchan': ['auchan'],
  'Lidl': ['lidl'],
  'Intermarche': ['intermarche', 'intermarché', 'les mousquetaires'],
  'Super U': ['super u', 'systeme u', 'système u', 'hyper u', 'u express'],
  'Monoprix': ['monoprix', 'monop'],
  'Franprix': ['franprix'],
  'Casino': ['casino', 'géant casino', 'geant casino'],
  'Picard': ['picard'],
  'Boulanger': ['boulanger'],
  'Darty': ['darty'],
  'Fnac': ['fnac'],
  'Decathlon': ['decathlon'],
  'Amazon': ['amazon', 'amzn'],
  'SNCF': ['sncf', 'oui.sncf'],
  'Total': ['total', 'totalenergies'],
  'Shell': ['shell'],
  'BP': ['bp ', 'bp.'],
  'McDonald': ['mcdonald', 'mcdo', 'mc donald'],
  'Starbucks': ['starbucks'],
  'Paul': ['paul ', 'paul.'],
  'Pharmacie': ['pharmacie', 'pharma'],
};

// French date patterns (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
const _DATE_PATTERNS = [
  /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/g, // DD/MM/YYYY or DD/MM/YY
  /(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{2,4})/gi,
];

// French/European amount patterns
const _AMOUNT_PATTERNS = [
  /(?:total|ttc|a\s*payer|net|montant|somme)[\s:]*(\d+[.,]\d{2})\s*(?:€|eur|euros?)?/gi,
  /(\d+[.,]\d{2})\s*(?:€|eur|euros?)\s*(?:total|ttc)?/gi,
  /(?:€|eur)\s*(\d+[.,]\d{2})/gi,
  /(\d{1,4}[.,]\d{2})\s*$/gm, // Amount at end of line
];

// ----------------------------------------------------------------------------
// Image Preprocessing
// ----------------------------------------------------------------------------

async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();

  let pipeline = sharp(imageBuffer);

  // Resize if too large (max 4000px on longest side for performance)
  const maxDimension = 4000;
  if (metadata.width && metadata.height) {
    const longestSide = Math.max(metadata.width, metadata.height);
    if (longestSide > maxDimension) {
      const scale = maxDimension / longestSide;
      pipeline = pipeline.resize(
        Math.round(metadata.width * scale),
        Math.round(metadata.height * scale)
      );
    }
  }

  // Convert to grayscale for better OCR
  pipeline = pipeline.grayscale();

  // Increase contrast slightly
  pipeline = pipeline.normalize();

  // Convert to PNG (lossless) for OCR
  return pipeline.png().toBuffer();
}

// ----------------------------------------------------------------------------
// OCR Service
// ----------------------------------------------------------------------------

export const ocrService = {
  /**
   * Process an image with Tesseract OCR
   */
  async processImage(imageBuffer: Buffer): Promise<OCRResult> {
    // Preprocess image for better OCR results
    const processedImage = await preprocessImage(imageBuffer);

    // Run Tesseract with French language
    const result = await Tesseract.recognize(processedImage, 'fra', {
      logger: () => {}, // Disable logging
    });

    // Extract words from all blocks/paragraphs/lines
    const words: OCRResult['words'] = [];
    if (result.data.blocks) {
      for (const block of result.data.blocks) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              words.push({
                text: word.text,
                confidence: word.confidence,
                bbox: word.bbox,
              });
            }
          }
        }
      }
    }

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words,
    };
  },

  /**
   * Extract receipt data from OCR text
   */
  async extractReceiptData(text: string): Promise<ReceiptData> {
    const normalizedText = text.toLowerCase();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Extract merchant
    const merchant = this.parseMerchant(normalizedText);

    // Extract date
    const date = this.parseDate(text);

    // Extract amount
    const amount = this.parseAmount(text);

    // Extract line items
    const items = this.parseItems(lines);

    // Calculate confidence based on what we found
    let confidence = 0;
    if (merchant) confidence += 0.25;
    if (date) confidence += 0.25;
    if (amount) confidence += 0.35;
    if (items && items.length > 0) confidence += 0.15;

    return {
      merchant: merchant ?? undefined,
      amount: amount ?? undefined,
      date: date ?? undefined,
      items: items.length > 0 ? items : undefined,
      confidence,
      rawText: text,
    };
  },

  /**
   * Parse merchant name from text
   */
  parseMerchant(text: string): string | null {
    const normalizedText = text.toLowerCase();

    // Check against known merchants
    for (const [merchantName, patterns] of Object.entries(KNOWN_MERCHANTS)) {
      for (const pattern of patterns) {
        if (normalizedText.includes(pattern)) {
          return merchantName;
        }
      }
    }

    // Try to extract from first few lines (usually contains store name)
    const lines = text.split('\n').slice(0, 5);
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that might be store names (mostly uppercase, not too long)
      if (trimmed.length > 3 && trimmed.length < 40 && /^[A-Z\s\-']+$/.test(trimmed)) {
        return trimmed.charAt(0) + trimmed.slice(1).toLowerCase();
      }
    }

    return null;
  },

  /**
   * Parse date from text
   */
  parseDate(text: string): Date | null {
    // Try numeric date patterns
    const numericMatch = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (numericMatch) {
      const day = parseInt(numericMatch[1] as string, 10);
      const month = parseInt(numericMatch[2] as string, 10);
      let year = parseInt(numericMatch[3] as string, 10);

      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      // Validate date
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try French month names
    const monthNames: Record<string, number> = {
      'janvier': 0, 'janv': 0, 'jan': 0,
      'fevrier': 1, 'février': 1, 'fev': 1, 'fév': 1,
      'mars': 2, 'mar': 2,
      'avril': 3, 'avr': 3,
      'mai': 4,
      'juin': 5, 'jun': 5,
      'juillet': 6, 'juil': 6, 'jul': 6,
      'aout': 7, 'août': 7, 'aou': 7,
      'septembre': 8, 'sept': 8, 'sep': 8,
      'octobre': 9, 'oct': 9,
      'novembre': 10, 'nov': 10,
      'decembre': 11, 'décembre': 11, 'dec': 11, 'déc': 11,
    };

    const frenchDateMatch = text.match(/(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|janv?|fev|fév|mar|avr|mai|jun|juil?|aou|sept?|oct|nov|dec|déc)\.?\s+(\d{2,4})/i);
    if (frenchDateMatch) {
      const day = parseInt(frenchDateMatch[1] as string, 10);
      const monthStr = (frenchDateMatch[2] as string).toLowerCase();
      let year = parseInt(frenchDateMatch[3] as string, 10);

      const month = monthNames[monthStr];
      if (month !== undefined) {
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  },

  /**
   * Parse total amount from text
   */
  parseAmount(text: string): number | null {
    const normalizedText = text.toLowerCase();

    // Priority 1: Look for explicit "total" or "a payer" amounts
    const totalPatterns = [
      /(?:total|ttc|a\s*payer|net\s*a\s*payer|montant\s*total|somme\s*due)[\s:]*(\d+[.,]\d{2})/gi,
      /(\d+[.,]\d{2})\s*(?:€|eur)?\s*(?:total|ttc)/gi,
    ];

    for (const pattern of totalPatterns) {
      const matches = [...normalizedText.matchAll(pattern)];
      if (matches.length > 0) {
        // Get the last match (usually the final total)
        const lastMatch = matches[matches.length - 1];
        if (lastMatch && lastMatch[1]) {
          const amount = parseFloat(lastMatch[1].replace(',', '.'));
          if (!isNaN(amount) && amount > 0) {
            return amount;
          }
        }
      }
    }

    // Priority 2: Look for amounts with euro symbol
    const euroPattern = /(\d+[.,]\d{2})\s*€/g;
    const euroMatches = [...text.matchAll(euroPattern)];
    if (euroMatches.length > 0) {
      // Find the largest amount (likely the total)
      const amounts = euroMatches
        .map((m) => parseFloat((m[1] as string).replace(',', '.')))
        .filter((a) => !isNaN(a) && a > 0);

      if (amounts.length > 0) {
        return Math.max(...amounts);
      }
    }

    // Priority 3: Look for the largest decimal number (likely the total)
    const decimalPattern = /(\d{1,5}[.,]\d{2})/g;
    const decimalMatches = [...text.matchAll(decimalPattern)];
    const amounts = decimalMatches
      .map((m) => parseFloat((m[1] as string).replace(',', '.')))
      .filter((a) => !isNaN(a) && a > 0 && a < 10000); // Reasonable receipt amount

    if (amounts.length > 0) {
      return Math.max(...amounts);
    }

    return null;
  },

  /**
   * Parse line items from text
   */
  parseItems(lines: string[]): ReceiptItem[] {
    const items: ReceiptItem[] = [];

    // Pattern: item name followed by price
    const itemPattern = /^(.+?)\s+(\d+[.,]\d{2})\s*(?:€|eur)?$/i;

    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match && match[1] && match[2]) {
        const name = match[1].trim();
        const price = parseFloat(match[2].replace(',', '.'));

        // Filter out total/subtotal lines and validate
        const lowerName = name.toLowerCase();
        if (
          name.length > 2 &&
          name.length < 50 &&
          !isNaN(price) &&
          price > 0 &&
          price < 1000 &&
          !lowerName.includes('total') &&
          !lowerName.includes('sous-total') &&
          !lowerName.includes('tva') &&
          !lowerName.includes('espece') &&
          !lowerName.includes('carte') &&
          !lowerName.includes('rendu')
        ) {
          items.push({ name, price });
        }
      }
    }

    return items;
  },

  /**
   * Get supported MIME types for image uploads
   */
  getSupportedMimeTypes(): string[] {
    return [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
  },

  /**
   * Validate image file
   */
  validateImage(mimeType: string, size: number): { valid: boolean; error?: string } {
    const maxSize = 15 * 1024 * 1024; // 15MB

    if (!this.getSupportedMimeTypes().includes(mimeType)) {
      return {
        valid: false,
        error: `Type de fichier non supporte. Types acceptes: JPEG, PNG, WebP, HEIC`,
      };
    }

    if (size > maxSize) {
      return {
        valid: false,
        error: `Fichier trop volumineux (max 15MB)`,
      };
    }

    return { valid: true };
  },
};

export default ocrService;
