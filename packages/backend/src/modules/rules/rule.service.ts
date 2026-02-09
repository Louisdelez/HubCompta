// ============================================================================
// RULE SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Rule, Prisma, CategoryPattern, Category } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface RuleCondition {
  field: 'description' | 'amount' | 'date';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than';
  value: string;
  caseSensitive?: boolean;
}

export interface RuleAction {
  type: 'set_category' | 'add_tag' | 'set_notes';
  value: string;
}

export interface RuleCreateInput {
  name: string;
  priority?: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isEnabled?: boolean;
}

export interface RuleUpdateInput {
  name?: string;
  priority?: number;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  isEnabled?: boolean;
}

export interface RuleWithStats extends Rule {
  matchCount: number;
  lastMatchedAt?: Date;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  confidence: number;
  pattern: string;
  source: 'pattern' | 'rule' | 'similar';
}

export interface PatternWithCategory extends CategoryPattern {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'type'>;
}

export interface RuleSuggestion {
  pattern: string;
  categoryId: string;
  categoryName: string;
  matchCount: number;
  exampleTransactions: string[];
}

// ----------------------------------------------------------------------------
// Rule Service
// ----------------------------------------------------------------------------

export const ruleService = {
  /**
   * Create a new rule
   */
  async create(workspaceId: string, input: RuleCreateInput): Promise<Rule> {
    // Validate conditions
    for (const condition of input.conditions) {
      if (!this.validateCondition(condition)) {
        throw new ConflictError('rule', 'condition', 'Invalid condition');
      }
    }

    // Validate actions
    for (const action of input.actions) {
      await this.validateAction(workspaceId, action);
    }

    return prisma.rule.create({
      data: {
        workspaceId,
        name: input.name,
        priority: input.priority ?? 0,
        conditions: input.conditions as unknown as Prisma.JsonArray,
        actions: input.actions as unknown as Prisma.JsonArray,
        isEnabled: input.isEnabled ?? true,
      },
    });
  },

  /**
   * Get rule by ID
   */
  getById(workspaceId: string, ruleId: string): Promise<Rule | null> {
    return prisma.rule.findFirst({
      where: { id: ruleId, workspaceId },
    });
  },

  /**
   * List all rules for workspace
   */
  async list(workspaceId: string): Promise<RuleWithStats[]> {
    const rules = await prisma.rule.findMany({
      where: { workspaceId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    // Get match stats from transactions
    const ruleStats = await prisma.transaction.groupBy({
      by: ['appliedRuleId'],
      where: {
        workspaceId,
        appliedRuleId: { not: null },
        deletedAt: null,
      },
      _count: true,
      _max: { createdAt: true },
    });

    const statsMap = new Map(
      ruleStats.map((s) => [
        s.appliedRuleId,
        { count: s._count, lastMatchedAt: s._max.createdAt },
      ])
    );

    return rules.map((rule) => {
      const stats = statsMap.get(rule.id);
      return {
        ...rule,
        matchCount: stats?.count ?? 0,
        lastMatchedAt: stats?.lastMatchedAt ?? undefined,
      };
    });
  },

  /**
   * Update rule
   */
  async update(
    workspaceId: string,
    ruleId: string,
    input: RuleUpdateInput
  ): Promise<Rule> {
    const rule = await prisma.rule.findFirst({
      where: { id: ruleId, workspaceId },
    });

    if (!rule) {
      throw new NotFoundError('Rule', ruleId);
    }

    // Validate conditions if provided
    if (input.conditions) {
      for (const condition of input.conditions) {
        if (!this.validateCondition(condition)) {
          throw new ConflictError('rule', 'condition', 'Invalid condition');
        }
      }
    }

    // Validate actions if provided
    if (input.actions) {
      for (const action of input.actions) {
        await this.validateAction(workspaceId, action);
      }
    }

    return prisma.rule.update({
      where: { id: ruleId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.conditions && { conditions: input.conditions as unknown as Prisma.JsonArray }),
        ...(input.actions && { actions: input.actions as unknown as Prisma.JsonArray }),
        ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
      },
    });
  },

  /**
   * Delete rule
   */
  async delete(workspaceId: string, ruleId: string): Promise<void> {
    const rule = await prisma.rule.findFirst({
      where: { id: ruleId, workspaceId },
    });

    if (!rule) {
      throw new NotFoundError('Rule', ruleId);
    }

    await prisma.rule.delete({
      where: { id: ruleId },
    });
  },

  /**
   * Toggle rule enabled state
   */
  async toggle(workspaceId: string, ruleId: string): Promise<Rule> {
    const rule = await prisma.rule.findFirst({
      where: { id: ruleId, workspaceId },
    });

    if (!rule) {
      throw new NotFoundError('Rule', ruleId);
    }

    return prisma.rule.update({
      where: { id: ruleId },
      data: { isEnabled: !rule.isEnabled },
    });
  },

  /**
   * Reorder rules (update priorities)
   */
  async reorder(workspaceId: string, ruleIds: string[]): Promise<void> {
    const updates = ruleIds.map((id, index) =>
      prisma.rule.update({
        where: { id },
        data: { priority: ruleIds.length - index },
      })
    );

    await prisma.$transaction(updates);
  },

  /**
   * Check if a transaction matches a rule
   */
  matchesRule(
    description: string,
    amount: number,
    rule: Rule
  ): boolean {
    if (!rule.isEnabled) return false;

    const conditions = rule.conditions as unknown as RuleCondition[];

    // All conditions must match (AND logic)
    return conditions.every((condition) => {
      switch (condition.field) {
        case 'description':
          return this.matchDescriptionCondition(description, condition);
        case 'amount':
          return this.matchAmountCondition(amount, condition);
        default:
          return false;
      }
    });
  },

  /**
   * Match description condition
   */
  matchDescriptionCondition(description: string, condition: RuleCondition): boolean {
    const desc = condition.caseSensitive ? description : description.toLowerCase();
    const value = condition.caseSensitive ? condition.value : condition.value.toLowerCase();

    switch (condition.operator) {
      case 'contains':
        return desc.includes(value);
      case 'equals':
        return desc === value;
      case 'starts_with':
        return desc.startsWith(value);
      case 'ends_with':
        return desc.endsWith(value);
      case 'regex':
        try {
          const regex = new RegExp(condition.value, condition.caseSensitive ? '' : 'i');
          return regex.test(description);
        } catch {
          return false;
        }
      default:
        return false;
    }
  },

  /**
   * Match amount condition
   */
  matchAmountCondition(amount: number, condition: RuleCondition): boolean {
    const value = parseFloat(condition.value);
    if (isNaN(value)) return false;

    switch (condition.operator) {
      case 'equals':
        return Math.abs(amount - value) < 0.01;
      case 'greater_than':
        return amount > value;
      case 'less_than':
        return amount < value;
      default:
        return false;
    }
  },

  /**
   * Apply matching rules to a transaction
   */
  async applyRules(
    workspaceId: string,
    transactionId: string,
    description: string,
    amount: number
  ): Promise<{ categoryId?: string; tagIds: string[]; notes?: string; appliedRuleId?: string }> {
    const rules = await this.list(workspaceId);

    for (const rule of rules) {
      if (this.matchesRule(description, amount, rule)) {
        const actions = rule.actions as unknown as RuleAction[];
        const result: { categoryId?: string; tagIds: string[]; notes?: string; appliedRuleId?: string } = {
          tagIds: [],
          appliedRuleId: rule.id,
        };

        for (const action of actions) {
          switch (action.type) {
            case 'set_category':
              result.categoryId = action.value;
              break;
            case 'add_tag':
              result.tagIds.push(action.value);
              break;
            case 'set_notes':
              result.notes = action.value;
              break;
          }
        }

        // Update transaction with applied rule
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            categoryId: result.categoryId,
            notes: result.notes,
            appliedRuleId: rule.id,
            ...(result.tagIds.length > 0 && {
              tags: {
                deleteMany: {},
                create: result.tagIds.map((tagId) => ({ tagId })),
              },
            }),
          },
        });

        return result;
      }
    }

    return { tagIds: [] };
  },

  /**
   * Test a rule against sample transactions
   */
  async testRule(
    workspaceId: string,
    conditions: RuleCondition[],
    limit = 20
  ): Promise<Array<{ id: string; description: string; amount: number; matches: boolean }>> {
    const transactions = await prisma.transaction.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { date: 'desc' },
      take: 100,
      select: { id: true, description: true, amount: true },
    });

    const results = transactions.map((txn) => {
      const matches = conditions.every((condition) => {
        if (condition.field === 'description') {
          return this.matchDescriptionCondition(txn.description, condition);
        }
        if (condition.field === 'amount') {
          return this.matchAmountCondition(txn.amount.toNumber(), condition);
        }
        return false;
      });

      return {
        id: txn.id,
        description: txn.description,
        amount: txn.amount.toNumber(),
        matches,
      };
    });

    return results.slice(0, limit);
  },

  /**
   * Validate condition
   */
  validateCondition(condition: RuleCondition): boolean {
    const validFields = ['description', 'amount', 'date'];
    const validOperators = ['contains', 'equals', 'starts_with', 'ends_with', 'regex', 'greater_than', 'less_than'];

    if (!validFields.includes(condition.field)) return false;
    if (!validOperators.includes(condition.operator)) return false;
    if (!condition.value) return false;

    return true;
  },

  /**
   * Validate action (check if category/tag exists)
   */
  async validateAction(workspaceId: string, action: RuleAction): Promise<void> {
    if (action.type === 'set_category') {
      const category = await prisma.category.findFirst({
        where: { id: action.value, workspaceId },
      });
      if (!category) {
        throw new NotFoundError('Category', action.value);
      }
    }

    if (action.type === 'add_tag') {
      const tag = await prisma.tag.findFirst({
        where: { id: action.value, workspaceId },
      });
      if (!tag) {
        throw new NotFoundError('Tag', action.value);
      }
    }
  },

  // ==========================================================================
  // ML-BASED AUTO-CATEGORIZATION
  // ==========================================================================

  /**
   * Extract a normalized pattern from a transaction description
   * Removes numbers, normalizes whitespace, and extracts merchant-like tokens
   */
  extractPattern(description: string): string {
    // Normalize: lowercase, remove extra whitespace
    let pattern = description.toLowerCase().trim();

    // Remove common transaction prefixes
    pattern = pattern.replace(/^(carte|cb|virement|prlv|prelevement|cheque|chq)\s+/i, '');

    // Remove dates (various formats)
    pattern = pattern.replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]?\d{0,4}/g, '');

    // Remove times
    pattern = pattern.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');

    // Remove pure numbers and amounts
    pattern = pattern.replace(/\b\d+([.,]\d+)?\s*€?\b/g, '');

    // Remove reference codes (like transaction IDs)
    pattern = pattern.replace(/[A-Z0-9]{8,}/gi, '');

    // Normalize whitespace
    pattern = pattern.replace(/\s+/g, ' ').trim();

    // Extract first meaningful words (usually merchant name)
    const words = pattern.split(' ').filter(w => w.length > 2);
    pattern = words.slice(0, 4).join(' ');

    return pattern;
  },

  /**
   * Calculate similarity score between two patterns (0-1)
   */
  calculateSimilarity(pattern1: string, pattern2: string): number {
    const words1 = pattern1.toLowerCase().split(' ');
    const words2 = pattern2.toLowerCase().split(' ');

    if (words1.length === 0 || words2.length === 0) return 0;

    // Jaccard similarity
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  },

  /**
   * Suggest category for a transaction based on learned patterns
   */
  async suggestCategory(
    workspaceId: string,
    description: string,
    _amount?: number
  ): Promise<CategorySuggestion[]> {
    const suggestions: CategorySuggestion[] = [];
    const pattern = this.extractPattern(description);

    if (!pattern || pattern.length < 3) {
      return suggestions;
    }

    // 1. Check for exact or similar pattern matches
    const patterns = await prisma.categoryPattern.findMany({
      where: { workspaceId },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true, type: true },
        },
      },
      orderBy: { matchCount: 'desc' },
    });

    for (const p of patterns) {
      const similarity = this.calculateSimilarity(pattern, p.pattern);

      if (similarity >= 0.5) {
        const confidence = p.confidence.toNumber() * similarity;
        suggestions.push({
          categoryId: p.categoryId,
          categoryName: p.category.name,
          categoryIcon: p.category.icon,
          categoryColor: p.category.color,
          confidence: Math.min(confidence, 0.99),
          pattern: p.pattern,
          source: 'pattern',
        });
      }
    }

    // 2. Check existing rules
    const rules = await this.list(workspaceId);
    for (const rule of rules) {
      if (this.matchesRule(description, _amount ?? 0, rule)) {
        const actions = rule.actions as unknown as RuleAction[];
        const categoryAction = actions.find(a => a.type === 'set_category');

        if (categoryAction) {
          const category = await prisma.category.findUnique({
            where: { id: categoryAction.value },
            select: { id: true, name: true, icon: true, color: true },
          });

          if (category) {
            suggestions.push({
              categoryId: category.id,
              categoryName: category.name,
              categoryIcon: category.icon,
              categoryColor: category.color,
              confidence: 0.95, // Rules have high confidence
              pattern: rule.name,
              source: 'rule',
            });
          }
        }
      }
    }

    // 3. Look for similar transactions with categories
    const similarTransactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        categoryId: { not: null },
        deletedAt: null,
      },
      select: {
        description: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
      take: 200,
      orderBy: { date: 'desc' },
    });

    // Group by category and find matches
    const categoryMatches = new Map<string, { count: number; category: NonNullable<typeof similarTransactions[0]['category']> }>();

    for (const txn of similarTransactions) {
      if (!txn.category) continue;

      const txnPattern = this.extractPattern(txn.description);
      const similarity = this.calculateSimilarity(pattern, txnPattern);

      if (similarity >= 0.6) {
        const existing = categoryMatches.get(txn.categoryId!);
        if (existing) {
          existing.count++;
        } else {
          categoryMatches.set(txn.categoryId!, { count: 1, category: txn.category });
        }
      }
    }

    for (const [categoryId, match] of categoryMatches) {
      const confidence = Math.min(0.3 + (match.count * 0.1), 0.8);

      // Avoid duplicates
      if (!suggestions.some(s => s.categoryId === categoryId)) {
        suggestions.push({
          categoryId,
          categoryName: match.category.name,
          categoryIcon: match.category.icon,
          categoryColor: match.category.color,
          confidence,
          pattern: `${match.count} similar transactions`,
          source: 'similar',
        });
      }
    }

    // Sort by confidence and deduplicate
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Keep only top suggestions, one per category
    const uniqueSuggestions: CategorySuggestion[] = [];
    const seenCategories = new Set<string>();

    for (const suggestion of suggestions) {
      if (!seenCategories.has(suggestion.categoryId)) {
        seenCategories.add(suggestion.categoryId);
        uniqueSuggestions.push(suggestion);
        if (uniqueSuggestions.length >= 3) break;
      }
    }

    return uniqueSuggestions;
  },

  /**
   * Learn from user categorization - create or update a pattern
   */
  async learnFromTransaction(
    workspaceId: string,
    transactionId: string,
    categoryId: string
  ): Promise<PatternWithCategory> {
    // Get the transaction
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, workspaceId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    // Verify category exists
    const category = await prisma.category.findFirst({
      where: { id: categoryId, workspaceId },
    });

    if (!category) {
      throw new NotFoundError('Category', categoryId);
    }

    // Extract pattern
    const pattern = this.extractPattern(transaction.description);

    if (!pattern || pattern.length < 3) {
      throw new ConflictError('pattern', 'extraction', 'Could not extract a meaningful pattern');
    }

    // Check if pattern exists
    const existingPattern = await prisma.categoryPattern.findUnique({
      where: {
        workspaceId_pattern: { workspaceId, pattern },
      },
    });

    let categoryPattern: CategoryPattern;

    if (existingPattern) {
      // Update existing pattern
      if (existingPattern.categoryId === categoryId) {
        // Same category - increase confidence and match count
        const newConfidence = Math.min(existingPattern.confidence.toNumber() + 0.05, 0.99);
        categoryPattern = await prisma.categoryPattern.update({
          where: { id: existingPattern.id },
          data: {
            confidence: new Decimal(newConfidence),
            matchCount: { increment: 1 },
          },
        });
      } else {
        // Different category - this is a conflict, reduce confidence or switch
        if (existingPattern.matchCount <= 2) {
          // Few matches - switch to new category
          categoryPattern = await prisma.categoryPattern.update({
            where: { id: existingPattern.id },
            data: {
              categoryId,
              confidence: new Decimal(0.6),
              matchCount: 1,
            },
          });
        } else {
          // Many matches - reduce confidence
          const newConfidence = Math.max(existingPattern.confidence.toNumber() - 0.1, 0.3);
          categoryPattern = await prisma.categoryPattern.update({
            where: { id: existingPattern.id },
            data: {
              confidence: new Decimal(newConfidence),
            },
          });
        }
      }
    } else {
      // Create new pattern
      categoryPattern = await prisma.categoryPattern.create({
        data: {
          workspaceId,
          pattern,
          categoryId,
          confidence: new Decimal(0.7),
          matchCount: 1,
        },
      });
    }

    // Update the transaction with the category
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
    });

    // Return pattern with category
    return {
      ...categoryPattern,
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
      },
    };
  },

  /**
   * Get all learned patterns for a workspace
   */
  async getPatterns(workspaceId: string): Promise<PatternWithCategory[]> {
    const patterns = await prisma.categoryPattern.findMany({
      where: { workspaceId },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true, type: true },
        },
      },
      orderBy: [{ matchCount: 'desc' }, { confidence: 'desc' }],
    });

    return patterns;
  },

  /**
   * Delete a learned pattern
   */
  async deletePattern(workspaceId: string, patternId: string): Promise<void> {
    const pattern = await prisma.categoryPattern.findFirst({
      where: { id: patternId, workspaceId },
    });

    if (!pattern) {
      throw new NotFoundError('CategoryPattern', patternId);
    }

    await prisma.categoryPattern.delete({
      where: { id: patternId },
    });
  },

  /**
   * Suggest new rules based on transaction patterns
   * Analyzes uncategorized transactions to find patterns
   */
  async getRuleSuggestions(workspaceId: string): Promise<RuleSuggestion[]> {
    // Get uncategorized transactions
    const uncategorizedTxns = await prisma.transaction.findMany({
      where: {
        workspaceId,
        categoryId: null,
        deletedAt: null,
      },
      select: { id: true, description: true, amount: true },
      orderBy: { date: 'desc' },
      take: 500,
    });

    // Extract patterns and group
    const patternGroups = new Map<string, { descriptions: string[]; count: number }>();

    for (const txn of uncategorizedTxns) {
      const pattern = this.extractPattern(txn.description);
      if (!pattern || pattern.length < 3) continue;

      const existing = patternGroups.get(pattern);
      if (existing) {
        existing.count++;
        if (existing.descriptions.length < 5) {
          existing.descriptions.push(txn.description);
        }
      } else {
        patternGroups.set(pattern, { descriptions: [txn.description], count: 1 });
      }
    }

    // Get categorized transactions with similar patterns
    const categorizedTxns = await prisma.transaction.findMany({
      where: {
        workspaceId,
        categoryId: { not: null },
        deletedAt: null,
      },
      select: {
        description: true,
        categoryId: true,
        category: {
          select: { id: true, name: true },
        },
      },
      take: 500,
    });

    // Find patterns that appear multiple times but aren't categorized
    const suggestions: RuleSuggestion[] = [];

    for (const [pattern, group] of patternGroups) {
      if (group.count < 3) continue; // Need at least 3 matches

      // Find most likely category from similar categorized transactions
      const categoryVotes = new Map<string, { name: string; votes: number }>();

      for (const txn of categorizedTxns) {
        if (!txn.category) continue;

        const txnPattern = this.extractPattern(txn.description);
        const similarity = this.calculateSimilarity(pattern, txnPattern);

        if (similarity >= 0.7) {
          const existing = categoryVotes.get(txn.categoryId!);
          if (existing) {
            existing.votes++;
          } else {
            categoryVotes.set(txn.categoryId!, { name: txn.category.name, votes: 1 });
          }
        }
      }

      // Get top voted category
      let topCategory: { id: string; name: string; votes: number } | null = null;
      for (const [categoryId, data] of categoryVotes) {
        if (!topCategory || data.votes > topCategory.votes) {
          topCategory = { id: categoryId, name: data.name, votes: data.votes };
        }
      }

      if (topCategory && topCategory.votes >= 2) {
        suggestions.push({
          pattern,
          categoryId: topCategory.id,
          categoryName: topCategory.name,
          matchCount: group.count,
          exampleTransactions: group.descriptions,
        });
      }
    }

    // Sort by match count
    suggestions.sort((a, b) => b.matchCount - a.matchCount);

    return suggestions.slice(0, 10);
  },

  /**
   * Get category suggestions for all uncategorized transactions
   */
  async getSuggestionsForUncategorized(
    workspaceId: string,
    limit = 50
  ): Promise<Array<{
    transactionId: string;
    description: string;
    amount: number;
    date: Date;
    suggestions: CategorySuggestion[];
  }>> {
    // Get uncategorized transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        categoryId: null,
        deletedAt: null,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    const results = await Promise.all(
      transactions.map(async (txn) => {
        const suggestions = await this.suggestCategory(
          workspaceId,
          txn.description,
          txn.amount.toNumber()
        );

        return {
          transactionId: txn.id,
          description: txn.description,
          amount: txn.amount.toNumber(),
          date: txn.date,
          suggestions,
        };
      })
    );

    // Filter to only return transactions with suggestions
    return results.filter(r => r.suggestions.length > 0);
  },

  /**
   * Bulk apply category suggestions
   */
  async bulkApplySuggestions(
    workspaceId: string,
    applications: Array<{ transactionId: string; categoryId: string; learn: boolean }>
  ): Promise<{ applied: number; learned: number }> {
    let applied = 0;
    let learned = 0;

    for (const app of applications) {
      // Verify transaction belongs to workspace
      const transaction = await prisma.transaction.findFirst({
        where: { id: app.transactionId, workspaceId },
      });

      if (!transaction) continue;

      // Apply category
      await prisma.transaction.update({
        where: { id: app.transactionId },
        data: { categoryId: app.categoryId },
      });
      applied++;

      // Learn if requested
      if (app.learn) {
        try {
          await this.learnFromTransaction(workspaceId, app.transactionId, app.categoryId);
          learned++;
        } catch {
          // Pattern extraction might fail, ignore
        }
      }
    }

    return { applied, learned };
  },
};

export default ruleService;
