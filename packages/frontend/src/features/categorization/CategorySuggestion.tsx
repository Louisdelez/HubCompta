// ============================================================================
// CATEGORY SUGGESTION - Finance Hub
// AI-powered category suggestion component
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, X, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

interface CategorySuggestionProps {
  workspaceId: string;
  transactionId: string;
  description: string;
  suggestedCategory: {
    id: string;
    name: string;
  };
  confidence: number;
  onAccept?: () => void;
  onReject?: () => void;
  categories?: Array<{ id: string; name: string; icon?: string | null }>;
}

export function CategorySuggestion({
  workspaceId,
  transactionId,
  suggestedCategory,
  confidence,
  onAccept,
  onReject,
  categories = [],
}: CategorySuggestionProps) {
  const queryClient = useQueryClient();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (data: { accepted: boolean; actualCategoryId?: string }) =>
      api.post(`/workspaces/${workspaceId}/categorization/feedback`, {
        transactionId,
        ...data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
    },
  });

  const handleAccept = () => {
    feedbackMutation.mutate({ accepted: true });
    onAccept?.();
  };

  const handleReject = () => {
    if (selectedCategory) {
      feedbackMutation.mutate({ accepted: false, actualCategoryId: selectedCategory });
    } else {
      feedbackMutation.mutate({ accepted: false });
    }
    onReject?.();
    setShowAlternatives(false);
  };

  const handleSelectAlternative = (categoryId: string) => {
    setSelectedCategory(categoryId);
    feedbackMutation.mutate({ accepted: false, actualCategoryId: categoryId });
    setShowAlternatives(false);
    onReject?.();
  };

  const confidenceColor =
    confidence >= 0.8 ? 'text-ctp-green' :
    confidence >= 0.6 ? 'text-ctp-yellow' :
    'text-ctp-peach';

  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2 p-2 bg-ctp-surface0 rounded-lg border border-ctp-blue/30">
      {/* AI Icon */}
      <div className="flex-shrink-0">
        <Sparkles className="w-4 h-4 text-ctp-blue" />
      </div>

      {/* Suggestion */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ctp-text truncate">
            {suggestedCategory.name}
          </span>
          <span className={clsx('text-xs', confidenceColor)}>
            {confidencePercent}%
          </span>
        </div>
        <p className="text-xs text-ctp-subtext0">
          Suggestion IA
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Accept */}
        <button
          onClick={handleAccept}
          disabled={feedbackMutation.isPending}
          className="p-1.5 rounded-md bg-ctp-green/20 text-ctp-green hover:bg-ctp-green/30 transition-colors"
          title="Accepter"
        >
          <Check className="w-4 h-4" />
        </button>

        {/* Reject/Alternatives */}
        <div className="relative">
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            disabled={feedbackMutation.isPending}
            className="p-1.5 rounded-md bg-ctp-red/20 text-ctp-red hover:bg-ctp-red/30 transition-colors flex items-center gap-0.5"
            title="Choisir une autre categorie"
          >
            <X className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Alternatives Dropdown */}
          {showAlternatives && categories.length > 0 && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-ctp-base border border-ctp-surface1 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {categories
                .filter((c) => c.id !== suggestedCategory.id)
                .map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleSelectAlternative(category.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-ctp-surface0 flex items-center gap-2"
                  >
                    {category.icon && <span>{category.icon}</span>}
                    <span className="truncate">{category.name}</span>
                  </button>
                ))}
              <button
                onClick={handleReject}
                className="w-full px-3 py-2 text-left text-sm text-ctp-subtext0 hover:bg-ctp-surface0 border-t border-ctp-surface1"
              >
                Rejeter sans categorie
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategorySuggestion;
