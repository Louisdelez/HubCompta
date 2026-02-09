// ============================================================================
// CATEGORY SELECTOR - Finance Hub
// Uses Catppuccin colors that adapt to the current theme
// ============================================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder } from 'lucide-react';
import { api } from '@/lib/api/client';
import { clsx } from 'clsx';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string | null;
  color: string | null;
  parentId: string | null;
  children: Category[];
}

interface CategorySelectorProps {
  workspaceId: string;
  type: 'expense' | 'income';
  value?: string;
  onChange: (categoryId: string | undefined) => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CategorySelector({
  workspaceId,
  type,
  value,
  onChange,
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const { data: categories } = useQuery({
    queryKey: ['categories', workspaceId, type],
    queryFn: () =>
      api.get<Category[]>(`/workspaces/${workspaceId}/categories?type=${type}`),
  });

  const selectedCategory = findCategory(categories ?? [], value);

  function findCategory(cats: Category[], id?: string): Category | undefined {
    if (!id) return undefined;
    for (const cat of cats) {
      if (cat.id === id) return cat;
      const found = findCategory(cat.children, id);
      if (found) return found;
    }
    return undefined;
  }

  const toggleParent = (id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (category: Category) => {
    onChange(category.id);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setIsOpen(false);
  };

  return (
    <div>
      <label className="label">Catégorie</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="input w-full text-left flex items-center gap-2"
        >
          {selectedCategory ? (
            <>
              <span className="text-lg">{selectedCategory.icon ? <span>{selectedCategory.icon}</span> : <Folder className="w-5 h-5 text-ctp-subtext0" />}</span>
              <span className="text-ctp-text">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-ctp-overlay1">Sélectionner une catégorie</span>
          )}
          <svg
            className={clsx(
              'w-4 h-4 ml-auto transition-transform',
              isOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-ctp-mantle rounded-lg shadow-lg border border-ctp-surface1 max-h-64 overflow-auto">
              {/* Clear option */}
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-3 py-2 text-left text-ctp-subtext0 hover:bg-ctp-surface0"
              >
                Aucune categorie
              </button>

              {/* Categories */}
              {(categories ?? []).map((category) => (
                <div key={category.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (category.children.length > 0) {
                        toggleParent(category.id);
                      } else {
                        handleSelect(category);
                      }
                    }}
                    className={clsx(
                      'w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-ctp-surface0',
                      value === category.id && 'bg-ctp-surface1 text-ctp-text'
                    )}
                  >
                    <span className="text-lg">{category.icon ? <span>{category.icon}</span> : <Folder className="w-5 h-5 text-ctp-subtext0" />}</span>
                    <span className="flex-1 text-ctp-text">{category.name}</span>
                    {category.children.length > 0 && (
                      <svg
                        className={clsx(
                          'w-4 h-4 transition-transform',
                          expandedParents.has(category.id) && 'rotate-180'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Children */}
                  {expandedParents.has(category.id) && (
                    <div className="pl-6 bg-ctp-base/50">
                      {category.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleSelect(child)}
                          className={clsx(
                            'w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-ctp-surface0',
                            value === child.id && 'bg-ctp-surface1 text-ctp-text'
                          )}
                        >
                          <span className="text-lg">{child.icon ? <span>{child.icon}</span> : <Folder className="w-5 h-5 text-ctp-subtext0" />}</span>
                          <span className="text-ctp-text">{child.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CategorySelector;
