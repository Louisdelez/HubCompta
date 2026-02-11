// ============================================================================
// ML CATEGORIZATION SERVICE - Finance Hub
// Intelligent transaction categorization using pattern matching and learning
// ============================================================================

import { prisma } from '@/core/database/client.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CategoryPredictionResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  features: PredictionFeatures;
}

export interface PredictionFeatures {
  merchant: string | null;
  amount: number;
  dayOfWeek: number;
  dayOfMonth: number;
  isWeekend: boolean;
  amountRange: string;
  descriptionTokens: string[];
}

interface PatternMatch {
  pattern: string;
  categoryId: string;
  confidence: number;
  matchCount: number;
}

interface CategoryFrequency {
  categoryId: string;
  count: number;
  totalAmount: number;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Extract tokens from transaction description
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/**
 * Normalize merchant name from description
 */
function extractMerchant(description: string): string | null {
  const cleaned = description.trim().toLowerCase();

  // Common patterns for merchant extraction
  const patterns = [
    /^(?:paiement|payment|vir|virement|prlv|prelevement)\s+(.+)$/i,
    /^cb\s+(.+?)(?:\s+\d|$)/i,
    /^carte\s+(.+?)(?:\s+\d|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      return match[1].trim().slice(0, 50);
    }
  }

  // Return first significant part of description
  const firstPart = cleaned.split(/\s+/).slice(0, 3).join(' ');
  return firstPart.length > 3 ? firstPart : null;
}

/**
 * Get amount range bucket
 */
function getAmountRange(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount < 10) return '0-10';
  if (absAmount < 50) return '10-50';
  if (absAmount < 100) return '50-100';
  if (absAmount < 500) return '100-500';
  if (absAmount < 1000) return '500-1000';
  return '1000+';
}

/**
 * Calculate confidence score based on match quality
 */
function calculateConfidence(
  patternMatches: PatternMatch[],
  frequencyMatch: CategoryFrequency | null,
  hasExactMatch: boolean
): number {
  let confidence = 0;

  // Exact pattern match gives high confidence
  if (hasExactMatch) {
    confidence = Math.min(0.95, 0.7 + patternMatches[0]!.matchCount * 0.05);
  } else if (patternMatches.length > 0) {
    // Partial pattern match
    confidence = Math.min(0.8, patternMatches[0]!.confidence * 0.8);
  }

  // Frequency bonus
  if (frequencyMatch && frequencyMatch.count > 5) {
    confidence = Math.min(0.95, confidence + 0.1);
  }

  return Math.round(confidence * 100) / 100;
}

// ----------------------------------------------------------------------------
// ML Categorization Service
// ----------------------------------------------------------------------------

export const mlCategorizationService = {
  /**
   * Predict category for a transaction
   */
  async predict(
    workspaceId: string,
    description: string,
    amount: number,
    date: Date
  ): Promise<CategoryPredictionResult | null> {
    const tokens = tokenize(description);
    const merchant = extractMerchant(description);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const amountRange = getAmountRange(amount);
    const isExpense = amount < 0;

    // Build features
    const features: PredictionFeatures = {
      merchant,
      amount: Math.abs(amount),
      dayOfWeek,
      dayOfMonth,
      isWeekend,
      amountRange,
      descriptionTokens: tokens,
    };

    // 1. Check for exact pattern matches
    const patternMatches = await this.findPatternMatches(workspaceId, description, tokens);

    // 2. Check historical frequency for similar transactions
    const frequencyMatch = merchant
      ? await this.findFrequencyMatch(workspaceId, merchant, isExpense)
      : null;

    // 3. Determine best category
    let bestCategoryId: string | null = null;
    let confidence = 0;

    if (patternMatches.length > 0) {
      bestCategoryId = patternMatches[0]!.categoryId;
      confidence = calculateConfidence(patternMatches, frequencyMatch, true);
    } else if (frequencyMatch) {
      bestCategoryId = frequencyMatch.categoryId;
      confidence = Math.min(0.7, frequencyMatch.count / 20);
    }

    if (!bestCategoryId || confidence < 0.3) {
      return null;
    }

    // Get category details
    const category = await prisma.category.findFirst({
      where: { id: bestCategoryId, workspaceId },
    });

    if (!category) {
      return null;
    }

    return {
      categoryId: bestCategoryId,
      categoryName: category.name,
      confidence,
      features,
    };
  },

  /**
   * Find matching patterns in database
   */
  async findPatternMatches(
    workspaceId: string,
    description: string,
    _tokens: string[]
  ): Promise<PatternMatch[]> {
    const patterns = await prisma.categoryPattern.findMany({
      where: { workspaceId },
      orderBy: { matchCount: 'desc' },
    });

    const matches: PatternMatch[] = [];
    const descLower = description.toLowerCase();

    for (const pattern of patterns) {
      // Check if pattern matches description
      if (descLower.includes(pattern.pattern.toLowerCase())) {
        matches.push({
          pattern: pattern.pattern,
          categoryId: pattern.categoryId,
          confidence: pattern.confidence.toNumber(),
          matchCount: pattern.matchCount,
        });
      }
    }

    // Sort by match count and confidence
    return matches.sort((a, b) => {
      const scoreA = a.matchCount * a.confidence;
      const scoreB = b.matchCount * b.confidence;
      return scoreB - scoreA;
    });
  },

  /**
   * Find most frequent category for merchant
   */
  async findFrequencyMatch(
    workspaceId: string,
    merchant: string,
    isExpense: boolean
  ): Promise<CategoryFrequency | null> {
    const result = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        workspaceId,
        deletedAt: null,
        categoryId: { not: null },
        description: { contains: merchant, mode: 'insensitive' },
        amount: isExpense ? { lt: 0 } : { gt: 0 },
      },
      _count: { categoryId: true },
      _sum: { amount: true },
      orderBy: { _count: { categoryId: 'desc' } },
      take: 1,
    });

    if (result.length === 0 || !result[0]!.categoryId) {
      return null;
    }

    return {
      categoryId: result[0]!.categoryId,
      count: result[0]!._count.categoryId,
      totalAmount: Math.abs(result[0]!._sum.amount?.toNumber() ?? 0),
    };
  },

  /**
   * Record prediction for a transaction
   */
  async recordPrediction(
    workspaceId: string,
    transactionId: string,
    prediction: CategoryPredictionResult
  ): Promise<void> {
    await prisma.categoryPrediction.upsert({
      where: { transactionId },
      create: {
        workspaceId,
        transactionId,
        suggestedCategoryId: prediction.categoryId,
        confidence: prediction.confidence,
        features: prediction.features as object,
      },
      update: {
        suggestedCategoryId: prediction.categoryId,
        confidence: prediction.confidence,
        features: prediction.features as object,
      },
    });
  },

  /**
   * Process feedback on prediction (accept/reject)
   */
  async processFeedback(
    workspaceId: string,
    transactionId: string,
    accepted: boolean,
    actualCategoryId?: string
  ): Promise<void> {
    const prediction = await prisma.categoryPrediction.findFirst({
      where: { transactionId, workspaceId },
      include: { transaction: true },
    });

    if (!prediction) return;

    // Update prediction status
    await prisma.categoryPrediction.update({
      where: { id: prediction.id },
      data: { accepted },
    });

    // If accepted, strengthen the pattern
    if (accepted) {
      await this.strengthenPattern(
        workspaceId,
        prediction.transaction.description,
        prediction.suggestedCategoryId
      );
    } else if (actualCategoryId) {
      // If rejected with correction, learn new pattern
      await this.strengthenPattern(
        workspaceId,
        prediction.transaction.description,
        actualCategoryId
      );
    }
  },

  /**
   * Strengthen or create pattern for category
   */
  async strengthenPattern(
    workspaceId: string,
    description: string,
    categoryId: string
  ): Promise<void> {
    const merchant = extractMerchant(description);
    if (!merchant || merchant.length < 3) return;

    // Upsert pattern
    await prisma.categoryPattern.upsert({
      where: {
        workspaceId_pattern: {
          workspaceId,
          pattern: merchant,
        },
      },
      create: {
        workspaceId,
        pattern: merchant,
        categoryId,
        confidence: 0.6,
        matchCount: 1,
      },
      update: {
        matchCount: { increment: 1 },
        confidence: { increment: 0.02 },
        categoryId,
      },
    });
  },

  /**
   * Train model on existing transactions
   */
  async train(workspaceId: string): Promise<{ patternsCreated: number; transactionsProcessed: number }> {
    // Get categorized transactions from last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        categoryId: { not: null },
        deletedAt: null,
        date: { gte: sixMonthsAgo },
      },
      select: {
        description: true,
        categoryId: true,
      },
    });

    // Count merchant -> category occurrences
    const merchantCategories = new Map<string, Map<string, number>>();

    for (const tx of transactions) {
      const merchant = extractMerchant(tx.description);
      if (!merchant || !tx.categoryId) continue;

      if (!merchantCategories.has(merchant)) {
        merchantCategories.set(merchant, new Map());
      }
      const categoryMap = merchantCategories.get(merchant)!;
      categoryMap.set(tx.categoryId, (categoryMap.get(tx.categoryId) ?? 0) + 1);
    }

    // Create patterns for merchants with consistent categories
    let patternsCreated = 0;

    for (const [merchant, categories] of merchantCategories) {
      const entries = Array.from(categories.entries());
      const total = entries.reduce((sum, [, count]) => sum + count, 0);

      if (total < 3) continue; // Need at least 3 occurrences

      // Find dominant category
      entries.sort((a, b) => b[1] - a[1]);
      const [topCategory, topCount] = entries[0]!;
      const confidence = topCount / total;

      if (confidence >= 0.7) {
        await prisma.categoryPattern.upsert({
          where: {
            workspaceId_pattern: { workspaceId, pattern: merchant },
          },
          create: {
            workspaceId,
            pattern: merchant,
            categoryId: topCategory,
            confidence,
            matchCount: topCount,
          },
          update: {
            categoryId: topCategory,
            confidence,
            matchCount: topCount,
          },
        });
        patternsCreated++;
      }
    }

    return { patternsCreated, transactionsProcessed: transactions.length };
  },

  /**
   * Auto-categorize uncategorized transactions
   */
  async autoCategorize(
    workspaceId: string,
    minConfidence: number = 0.8
  ): Promise<{ categorized: number; skipped: number }> {
    const uncategorized = await prisma.transaction.findMany({
      where: {
        workspaceId,
        categoryId: null,
        deletedAt: null,
      },
      take: 100,
      orderBy: { date: 'desc' },
    });

    let categorized = 0;
    let skipped = 0;

    for (const tx of uncategorized) {
      const prediction = await this.predict(
        workspaceId,
        tx.description,
        tx.amount.toNumber(),
        tx.date
      );

      if (prediction && prediction.confidence >= minConfidence) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId: prediction.categoryId },
        });
        await this.recordPrediction(workspaceId, tx.id, prediction);
        categorized++;
      } else {
        skipped++;
      }
    }

    return { categorized, skipped };
  },

  /**
   * Get pending predictions for review
   */
  async getPendingPredictions(
    workspaceId: string,
    minConfidence: number = 0.5,
    maxConfidence: number = 0.8
  ): Promise<Array<{
    transactionId: string;
    description: string;
    amount: number;
    date: Date;
    suggestedCategory: { id: string; name: string };
    confidence: number;
  }>> {
    const predictions = await prisma.categoryPrediction.findMany({
      where: {
        workspaceId,
        accepted: null,
        confidence: { gte: minConfidence, lt: maxConfidence },
      },
      include: {
        transaction: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return predictions.map((p) => ({
      transactionId: p.transactionId,
      description: p.transaction.description,
      amount: p.transaction.amount.toNumber(),
      date: p.transaction.date,
      suggestedCategory: p.category,
      confidence: p.confidence.toNumber(),
    }));
  },

  /**
   * Get categorization stats
   */
  async getStats(workspaceId: string): Promise<{
    totalPatterns: number;
    totalPredictions: number;
    acceptedPredictions: number;
    rejectedPredictions: number;
    accuracy: number;
  }> {
    const [patterns, predictions] = await Promise.all([
      prisma.categoryPattern.count({ where: { workspaceId } }),
      prisma.categoryPrediction.groupBy({
        by: ['accepted'],
        where: { workspaceId },
        _count: true,
      }),
    ]);

    let accepted = 0;
    let rejected = 0;
    let pending = 0;

    for (const p of predictions) {
      if (p.accepted === true) accepted = p._count;
      else if (p.accepted === false) rejected = p._count;
      else pending = p._count;
    }

    const total = accepted + rejected + pending;
    const accuracy = accepted + rejected > 0
      ? Math.round((accepted / (accepted + rejected)) * 100)
      : 0;

    return {
      totalPatterns: patterns,
      totalPredictions: total,
      acceptedPredictions: accepted,
      rejectedPredictions: rejected,
      accuracy,
    };
  },
};

export default mlCategorizationService;
