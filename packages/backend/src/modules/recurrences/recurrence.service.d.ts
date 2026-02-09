import type { RecurrenceFreq } from '@prisma/client';
export interface TransactionTemplate {
    accountId: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    categoryId?: string;
    tags?: string[];
    notes?: string;
    toAccountId?: string;
}
export interface CreateRecurrenceInput {
    workspaceId: string;
    name: string;
    frequency: RecurrenceFreq;
    interval?: number;
    dayOfMonth?: number;
    dayOfWeek?: number;
    template: TransactionTemplate;
    startAt: Date;
    endAt?: Date;
}
export interface UpdateRecurrenceInput {
    name?: string;
    frequency?: RecurrenceFreq;
    interval?: number;
    dayOfMonth?: number;
    dayOfWeek?: number;
    template?: Partial<TransactionTemplate>;
    endAt?: Date | null;
    isActive?: boolean;
}
export interface RecurrenceWithStats {
    id: string;
    workspaceId: string;
    name: string;
    frequency: RecurrenceFreq;
    interval: number;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    template: TransactionTemplate;
    nextRunAt: Date;
    endAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        transactions: number;
    };
    lastTransaction?: {
        id: string;
        date: Date;
        amount: number;
    } | null;
}
export declare const recurrenceService: {
    /**
     * Create a new recurrence
     */
    create(input: CreateRecurrenceInput): Promise<any>;
    /**
     * Get a recurrence by ID
     */
    getById(id: string, workspaceId: string): Promise<any>;
    /**
     * List all recurrences for a workspace
     */
    list(workspaceId: string, options?: {
        isActive?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<{
        data: any;
        meta: {
            total: any;
            page: number;
            pageSize: number;
            totalPages: number;
        };
    }>;
    /**
     * Update a recurrence
     */
    update(id: string, workspaceId: string, input: UpdateRecurrenceInput): Promise<any>;
    /**
     * Delete a recurrence
     */
    delete(id: string, workspaceId: string): Promise<any>;
    /**
     * Pause a recurrence
     */
    pause(id: string, workspaceId: string): Promise<any>;
    /**
     * Resume a recurrence
     */
    resume(id: string, workspaceId: string): Promise<any>;
    /**
     * Get recurrences due for execution
     */
    getDueRecurrences(limit?: number): Promise<any>;
    /**
     * Execute a recurrence (create transaction and update next run)
     */
    execute(recurrenceId: string): Promise<any>;
    /**
     * Skip the next occurrence
     */
    skipNext(id: string, workspaceId: string): Promise<any>;
    /**
     * Calculate the next run date based on frequency
     */
    calculateNextRun(fromDate: Date, frequency: RecurrenceFreq, interval: number, dayOfMonth?: number, dayOfWeek?: number): Date;
    /**
     * Get upcoming occurrences preview
     */
    getUpcomingOccurrences(id: string, workspaceId: string, count?: number): Promise<Date[]>;
    /**
     * Get monthly forecast (sum of recurring transactions for a month)
     */
    getMonthlyForecast(workspaceId: string, month: Date): Promise<{
        totalIncome: number;
        totalExpense: number;
        netFlow: number;
        items: {
            name: string;
            type: "income" | "expense";
            amount: number;
            occurrences: number;
        }[];
    }>;
    /**
     * Count occurrences of a recurrence in a given month
     */
    countOccurrencesInMonth(recurrence: {
        frequency: RecurrenceFreq;
        interval: number;
        nextRunAt: Date;
        endAt: Date | null;
    }, month: Date): number;
};
export default recurrenceService;
//# sourceMappingURL=recurrence.service.d.ts.map