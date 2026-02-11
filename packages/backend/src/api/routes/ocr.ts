// ============================================================================
// OCR ROUTES - Finance Hub
// Receipt scanning endpoints
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ocrService } from '@/modules/ocr/ocr.service.js';
import { authGuard } from '@/core/auth/authGuard.js';
import { checkPermission } from '@/core/auth/rbac.js';
import { auditService } from '@/modules/audit/audit.service.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MultipartFile {
  file: AsyncIterableIterator<Buffer>;
  filename: string;
  mimetype: string;
  encoding: string;
  fields: Record<string, unknown>;
}

interface ScanParams {
  workspaceId: string;
}

// ----------------------------------------------------------------------------
// Route Handlers
// ----------------------------------------------------------------------------

export function ocrRoutes(app: FastifyInstance): void {
  // Apply auth guard to all routes
  app.addHook('onRequest', authGuard);

  // --------------------------------------------------------------------------
  // POST /ocr/scan - Scan receipt image
  // --------------------------------------------------------------------------
  app.post(
    '/scan',
    async (
      request: FastifyRequest<{
        Params: ScanParams;
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;

      // Check permission (using transaction create permission)
      await checkPermission(userId, workspaceId, 'transaction', 'create');

      // Handle multipart file upload
      const data = await (request as unknown as { file: () => Promise<MultipartFile | undefined> }).file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_FILE', message: 'Aucun fichier fourni' },
        });
      }

      // Validate file type
      const validation = ocrService.validateImage(data.mimetype, 0);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_FILE', message: validation.error },
        });
      }

      // Read file content
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxSize = 15 * 1024 * 1024; // 15MB

      for await (const chunk of data.file) {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          return reply.status(400).send({
            success: false,
            error: { code: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux (max 15MB)' },
          });
        }
        chunks.push(chunk);
      }

      const imageBuffer = Buffer.concat(chunks);

      // Validate size
      const sizeValidation = ocrService.validateImage(data.mimetype, imageBuffer.length);
      if (!sizeValidation.valid) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_FILE', message: sizeValidation.error },
        });
      }

      try {
        // Process image with OCR
        const ocrResult = await ocrService.processImage(imageBuffer);

        // Extract receipt data
        const receiptData = await ocrService.extractReceiptData(ocrResult.text);

        // Audit log
        await auditService.log({
          workspaceId,
          userId,
          action: 'ocr.scan',
          entityType: 'receipt',
          entityId: undefined,
          newValue: {
            filename: data.filename,
            confidence: receiptData.confidence,
            foundMerchant: !!receiptData.merchant,
            foundAmount: !!receiptData.amount,
            foundDate: !!receiptData.date,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });

        return reply.send({
          success: true,
          data: {
            merchant: receiptData.merchant,
            amount: receiptData.amount,
            date: receiptData.date?.toISOString(),
            items: receiptData.items,
            confidence: receiptData.confidence,
            ocrConfidence: ocrResult.confidence,
            rawText: receiptData.rawText,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors du traitement de l\'image';

        return reply.status(500).send({
          success: false,
          error: { code: 'OCR_ERROR', message: errorMessage },
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /ocr/extract - Extract data from provided text (manual correction)
  // --------------------------------------------------------------------------
  app.post(
    '/extract',
    async (
      request: FastifyRequest<{
        Params: ScanParams;
        Body: { text: string };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;
      const userId = request.user!.sub;
      const { text } = request.body;

      // Check permission
      await checkPermission(userId, workspaceId, 'transaction', 'create');

      if (!text || typeof text !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Texte requis' },
        });
      }

      try {
        // Extract receipt data from text
        const receiptData = await ocrService.extractReceiptData(text);

        return reply.send({
          success: true,
          data: {
            merchant: receiptData.merchant,
            amount: receiptData.amount,
            date: receiptData.date?.toISOString(),
            items: receiptData.items,
            confidence: receiptData.confidence,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'extraction';

        return reply.status(500).send({
          success: false,
          error: { code: 'EXTRACTION_ERROR', message: errorMessage },
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /ocr/supported-types - Get supported file types
  // --------------------------------------------------------------------------
  app.get(
    '/supported-types',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          mimeTypes: ocrService.getSupportedMimeTypes(),
          maxSize: 15 * 1024 * 1024,
          maxSizeMB: 15,
        },
      });
    }
  );
}

export default ocrRoutes;
