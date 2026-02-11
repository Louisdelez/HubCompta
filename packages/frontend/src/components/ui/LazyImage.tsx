// ============================================================================
// LAZY IMAGE - Finance Hub
// Lazy loading images with placeholder, error handling, srcset, and WebP support
// ============================================================================

import { useState, useRef, useEffect, memo } from 'react';
import { ImageOff } from 'lucide-react';
import { clsx } from 'clsx';

interface ImageSource {
  src: string;
  width: number;
  type?: string; // e.g., 'image/webp'
}

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  placeholderClassName?: string;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  /** Responsive image sources for srcset */
  srcSet?: ImageSource[];
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Low quality placeholder image (data URL or small image) */
  blurDataUrl?: string;
  /** Priority loading - skips lazy loading for above-the-fold images */
  priority?: boolean;
}

/**
 * Generate srcset string from ImageSource array
 */
function generateSrcSet(sources: ImageSource[]): string {
  return sources.map((s) => `${s.src} ${s.width}w`).join(', ');
}

/**
 * LazyImage component with full optimization support
 */
function LazyImageComponent({
  src,
  alt,
  width,
  height,
  className,
  placeholderClassName,
  fallback,
  onLoad,
  onError,
  srcSet,
  sizes,
  blurDataUrl,
  priority = false,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority); // Skip lazy for priority images
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading (skip for priority images)
  useEffect(() => {
    if (priority) return; // Skip for priority images

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(container);
          }
        });
      },
      {
        rootMargin: '100px', // Start loading slightly before viewport
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const defaultFallback = (
    <div
      className={clsx(
        'flex items-center justify-center bg-ctp-surface1 text-ctp-overlay1',
        placeholderClassName
      )}
      style={{ width, height }}
    >
      <ImageOff className="w-6 h-6" />
    </div>
  );

  if (hasError) {
    return <>{fallback ?? defaultFallback}</>;
  }

  // Generate srcSet if provided
  const srcSetString = srcSet ? generateSrcSet(srcSet) : undefined;

  // Check if we have WebP sources
  const webpSources = srcSet?.filter((s) => s.type === 'image/webp');
  const hasWebP = webpSources && webpSources.length > 0;

  return (
    <div
      ref={containerRef}
      className={clsx('relative overflow-hidden', className)}
      style={{ width, height }}
    >
      {/* Blur placeholder */}
      {!isLoaded && blurDataUrl && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className={clsx(
            'absolute inset-0 w-full h-full object-cover filter blur-lg scale-110',
            placeholderClassName
          )}
          style={{ width, height }}
        />
      )}

      {/* Skeleton placeholder (when no blur) */}
      {!isLoaded && !blurDataUrl && (
        <div
          className={clsx(
            'absolute inset-0 bg-ctp-surface1 animate-pulse',
            placeholderClassName
          )}
        />
      )}

      {/* Actual Image with picture element for WebP support */}
      {isInView && (
        hasWebP ? (
          <picture>
            {/* WebP source */}
            <source
              type="image/webp"
              srcSet={generateSrcSet(webpSources)}
              sizes={sizes}
            />
            {/* Fallback source */}
            {srcSet && (
              <source
                srcSet={generateSrcSet(srcSet.filter((s) => s.type !== 'image/webp'))}
                sizes={sizes}
              />
            )}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              width={width}
              height={height}
              onLoad={handleLoad}
              onError={handleError}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              className={clsx(
                'transition-opacity duration-300',
                isLoaded ? 'opacity-100' : 'opacity-0',
                className
              )}
              style={{ width, height }}
            />
          </picture>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            srcSet={srcSetString}
            sizes={sizes}
            onLoad={handleLoad}
            onError={handleError}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            className={clsx(
              'transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0',
              className
            )}
            style={{ width, height }}
          />
        )
      )}
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const LazyImage = memo(LazyImageComponent);

export default LazyImage;
