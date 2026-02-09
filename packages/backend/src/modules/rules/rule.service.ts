// ============================================================================
// RULE SERVICE - Finance Hub
// ============================================================================

import { prisma } from '@/core/database/client.js';
import { NotFoundError, ConflictError } from '@/core/middleware/errorHandler.js';
import type { Rule, Prisma } from '@prisma/client';

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
};

export default ruleService;
