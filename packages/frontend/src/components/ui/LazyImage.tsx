// ============================================================================
// LAZY IMAGE - Finance Hub
// Lazy loading images with placeholder and error handling
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { clsx } from 'clsx';

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
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  placeholderClassName,
  fallback,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
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
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

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

  return (
    <div
      ref={containerRef}
      className={clsx('relative overflow-hidden', className)}
      style={{ width, height }}
    >
      {/* Placeholder / Skeleton */}
      {!isLoaded && (
        <div
          className={clsx(
            'absolute inset-0 bg-ctp-surface1 animate-pulse',
            placeholderClassName
          )}
        />
      )}

      {/* Actual Image */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          className={clsx(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          style={{ width, height }}
        />
      )}
    </div>
  );
}

export default LazyImage;
