// ============================================================================
// BUTTON COMPONENT TESTS - Finance Hub
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { Button, type ButtonVariant, type ButtonSize } from './Button';

describe('Button', () => {
  // --------------------------------------------------------------------------
  // Basic Rendering
  // --------------------------------------------------------------------------

  describe('rendering', () => {
    it('should render children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should render as a button element', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with an icon', () => {
      const icon = <span data-testid="icon">+</span>;
      render(<Button icon={icon}>Add</Button>);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('should render icon-only button', () => {
      const icon = <span data-testid="icon">X</span>;
      render(<Button icon={icon} aria-label="Close" />);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Variants
  // --------------------------------------------------------------------------

  describe('variants', () => {
    const variants: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];

    it.each(variants)('should render %s variant', (variant) => {
      render(<Button variant={variant}>Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply primary styles by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-ctp-blue');
    });

    it('should apply secondary styles when variant is secondary', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-ctp-surface0');
    });

    it('should apply danger styles when variant is danger', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-ctp-red');
    });

    it('should apply ghost styles when variant is ghost', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:bg-ctp-surface0');
    });
  });

  // --------------------------------------------------------------------------
  // Sizes
  // --------------------------------------------------------------------------

  describe('sizes', () => {
    const sizes: ButtonSize[] = ['sm', 'md', 'lg'];

    it.each(sizes)('should render %s size', (size) => {
      render(<Button size={size}>Button</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should apply medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('py-2');
    });

    it('should apply small size styles', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-3');
      expect(button.className).toContain('py-1.5');
    });

    it('should apply large size styles', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-6');
      expect(button.className).toContain('py-3');
    });
  });

  // --------------------------------------------------------------------------
  // Click Handling
  // --------------------------------------------------------------------------

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Click</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} loading>Click</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should pass event to onClick handler', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  // --------------------------------------------------------------------------
  // Disabled State
  // --------------------------------------------------------------------------

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not be disabled by default', () => {
      render(<Button>Enabled</Button>);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('should apply disabled styles', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('disabled:opacity-50');
      expect(button.className).toContain('disabled:cursor-not-allowed');
    });

    it('should be disabled when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Loading State
  // --------------------------------------------------------------------------

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('should still show children text when loading', () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should hide icon when loading', () => {
      const icon = <span data-testid="icon">+</span>;
      render(<Button loading icon={icon}>Add</Button>);
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('should apply animation class to spinner', () => {
      render(<Button loading>Submit</Button>);
      const spinner = screen.getByLabelText('Loading');
      expect(spinner.className).toContain('animate-spin');
    });
  });

  // --------------------------------------------------------------------------
  // Custom Styling
  // --------------------------------------------------------------------------

  describe('custom styling', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('should merge custom className with default classes', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
      expect(button.className).toContain('inline-flex');
    });
  });

  // --------------------------------------------------------------------------
  // HTML Attributes
  // --------------------------------------------------------------------------

  describe('HTML attributes', () => {
    it('should pass through HTML button attributes', () => {
      render(
        <Button type="submit" name="submit-btn" data-testid="custom-btn">
          Submit
        </Button>
      );
      const button = screen.getByTestId('custom-btn');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('name', 'submit-btn');
    });

    it('should support aria attributes', () => {
      render(
        <Button aria-label="Close dialog" aria-describedby="description">
          X
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Close dialog');
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });

    it('should forward ref to button element', () => {
      const ref = { current: null };
      render(<Button ref={ref}>Ref Button</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
