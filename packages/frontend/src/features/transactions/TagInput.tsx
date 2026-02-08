// ============================================================================
// TAG INPUT - Finance Hub
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Tag {
  id: string;
  name: string;
  color: string | null;
  usageCount?: number;
}

interface TagInputProps {
  workspaceId: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TagInput({ workspaceId, value, onChange }: TagInputProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all tags
  const { data: allTags } = useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: () => api.get<Tag[]>(`/workspaces/${workspaceId}/tags`),
  });

  // Fetch popular tags
  const { data: popularTags } = useQuery({
    queryKey: ['tags-popular', workspaceId],
    queryFn: () => api.get<Tag[]>(`/workspaces/${workspaceId}/tags/popular?limit=5`),
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<Tag>(`/workspaces/${workspaceId}/tags`, { name }),
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] });
      onChange([...value, newTag.id]);
      setSearchQuery('');
    },
  });

  const selectedTags = (allTags ?? []).filter((t) => value.includes(t.id));
  const filteredTags = (allTags ?? []).filter(
    (t) =>
      !value.includes(t.id) &&
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTag = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const handleCreateTag = () => {
    if (searchQuery.trim()) {
      createTagMutation.mutate(searchQuery.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstTag = filteredTags[0];
      if (firstTag) {
        toggleTag(firstTag.id);
        setSearchQuery('');
      } else if (searchQuery.trim()) {
        handleCreateTag();
      }
    }
  };

  return (
    <div>
      <label className="label">Tags</label>
      <div className="relative">
        {/* Selected Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: tag.color ? tag.color + '20' : '#E5E7EB',
                color: tag.color ?? '#374151',
              }}
            >
              {tag.name}
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          ))}
        </div>

        {/* Input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Ajouter un tag..."
          className="input"
        />

        {/* Dropdown */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-auto">
              {/* Popular tags */}
              {!searchQuery && (popularTags?.length ?? 0) > 0 && (
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Populaires</p>
                  <div className="flex flex-wrap gap-1">
                    {popularTags
                      ?.filter((t) => !value.includes(t.id))
                      .slice(0, 5)
                      .map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            toggleTag(tag.id);
                          }}
                          className="px-2 py-0.5 rounded-full text-xs hover:opacity-80"
                          style={{
                            backgroundColor: tag.color ? tag.color + '20' : '#E5E7EB',
                            color: tag.color ?? '#374151',
                          }}
                        >
                          {tag.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Filtered tags */}
              {filteredTags.slice(0, 10).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    toggleTag(tag.id);
                    setSearchQuery('');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color ?? '#9CA3AF' }}
                  />
                  <span>{tag.name}</span>
                </button>
              ))}

              {/* Create new tag */}
              {searchQuery && !filteredTags.some(
                (t) => t.name.toLowerCase() === searchQuery.toLowerCase()
              ) && (
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={createTagMutation.isPending}
                  className="w-full px-3 py-2 text-left text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {createTagMutation.isPending ? (
                    'Création...'
                  ) : (
                    <>Créer "{searchQuery}"</>
                  )}
                </button>
              )}

              {/* Empty state */}
              {!searchQuery && filteredTags.length === 0 && (popularTags?.length ?? 0) === 0 && (
                <p className="px-3 py-2 text-gray-400 text-sm">
                  Tapez pour créer un nouveau tag
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TagInput;
