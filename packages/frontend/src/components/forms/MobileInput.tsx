// ============================================================================
// MOBILE INPUT COMPONENTS - HubCompta
// Mobile-optimized form inputs with proper keyboard handling
// ============================================================================

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

interface BaseInputProps {
  /** Label for the input */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Additional container className */
  containerClassName?: string;
}

// ----------------------------------------------------------------------------
// Mobile Text Input
// ----------------------------------------------------------------------------

export interface MobileTextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    BaseInputProps {
  /** Input mode for mobile keyboard */
  inputMode?: InputMode;
  /** Input size */
  inputSize?: 'sm' | 'md' | 'lg';
}

export const MobileTextInput = forwardRef<HTMLInputElement, MobileTextInputProps>(
  function MobileTextInput(
    {
      label,
      error,
      helperText,
      required,
      containerClassName,
      className,
      inputMode = 'text',
      inputSize = 'md',
      id,
      ...props
    },
    ref
  ) {
    const inputId = id ?? `input-${Math.random().toString(36).substring(2, 9)}`;

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm min-h-[40px]',
      md: 'px-4 py-3 text-base min-h-[48px]',
      lg: 'px-4 py-4 text-lg min-h-[56px]',
    };

    return (
      <div className={clsx('space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ctp-text"
          >
            {label}
            {required && <span className="text-ctp-red ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          inputMode={inputMode}
          className={clsx(
            'w-full rounded-lg border transition-colors',
            'bg-ctp-surface0 text-ctp-text placeholder:text-ctp-subtext0',
            'focus:outline-none focus:ring-2 focus:ring-ctp-blue/50',
            'touch-target',
            sizeClasses[inputSize],
            error
              ? 'border-ctp-red focus:border-ctp-red'
              : 'border-ctp-surface1 focus:border-ctp-blue',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-ctp-red" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-ctp-subtext0">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Currency Input
// ----------------------------------------------------------------------------

export interface MobileCurrencyInputProps
  extends Omit<MobileTextInputProps, 'type' | 'inputMode'> {
  /** Currency symbol to display */
  currency?: string;
  /** Whether to show the currency on the left or right */
  currencyPosition?: 'left' | 'right';
}

export const MobileCurrencyInput = forwardRef<HTMLInputElement, MobileCurrencyInputProps>(
  function MobileCurrencyInput(
    {
      currency = 'EUR',
      currencyPosition = 'right',
      className,
      ...props
    },
    ref
  ) {
    return (
      <div className="relative">
        <MobileTextInput
          ref={ref}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          autoComplete="off"
          className={clsx(
            currencyPosition === 'left' ? 'pl-12' : 'pr-12',
            className
          )}
          {...props}
        />
        <span
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 text-ctp-subtext0 font-medium',
            'pointer-events-none',
            currencyPosition === 'left' ? 'left-4' : 'right-4'
          )}
        >
          {currency}
        </span>
      </div>
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Phone Input
// ----------------------------------------------------------------------------

export interface MobilePhoneInputProps
  extends Omit<MobileTextInputProps, 'type' | 'inputMode'> {}

export const MobilePhoneInput = forwardRef<HTMLInputElement, MobilePhoneInputProps>(
  function MobilePhoneInput(props, ref) {
    return (
      <MobileTextInput
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        {...props}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Email Input
// ----------------------------------------------------------------------------

export interface MobileEmailInputProps
  extends Omit<MobileTextInputProps, 'type' | 'inputMode'> {}

export const MobileEmailInput = forwardRef<HTMLInputElement, MobileEmailInputProps>(
  function MobileEmailInput(props, ref) {
    return (
      <MobileTextInput
        ref={ref}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="off"
        {...props}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Number Input
// ----------------------------------------------------------------------------

export interface MobileNumberInputProps
  extends Omit<MobileTextInputProps, 'type' | 'inputMode'> {
  /** Whether to allow decimal numbers */
  allowDecimal?: boolean;
  /** Whether to allow negative numbers */
  allowNegative?: boolean;
}

export const MobileNumberInput = forwardRef<HTMLInputElement, MobileNumberInputProps>(
  function MobileNumberInput(
    { allowDecimal = false, allowNegative = false, ...props },
    ref
  ) {
    const pattern = allowNegative
      ? allowDecimal
        ? '-?[0-9]*[.,]?[0-9]*'
        : '-?[0-9]*'
      : allowDecimal
      ? '[0-9]*[.,]?[0-9]*'
      : '[0-9]*';

    return (
      <MobileTextInput
        ref={ref}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        pattern={pattern}
        autoComplete="off"
        {...props}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Search Input
// ----------------------------------------------------------------------------

export interface MobileSearchInputProps
  extends Omit<MobileTextInputProps, 'type' | 'inputMode'> {
  /** Called when search is submitted */
  onSearch?: (value: string) => void;
}

export const MobileSearchInput = forwardRef<HTMLInputElement, MobileSearchInputProps>(
  function MobileSearchInput({ onSearch, onKeyDown, ...props }, ref) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch(e.currentTarget.value);
      }
      onKeyDown?.(e);
    };

    return (
      <MobileTextInput
        ref={ref}
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="off"
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Date Input
// ----------------------------------------------------------------------------

export interface MobileDateInputProps
  extends Omit<MobileTextInputProps, 'type' | 'inputMode'> {}

export const MobileDateInput = forwardRef<HTMLInputElement, MobileDateInputProps>(
  function MobileDateInput(props, ref) {
    return (
      <MobileTextInput
        ref={ref}
        type="date"
        inputMode="none" // Use native date picker
        {...props}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Textarea
// ----------------------------------------------------------------------------

export interface MobileTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseInputProps {
  /** Minimum height in rows */
  minRows?: number;
}

export const MobileTextarea = forwardRef<HTMLTextAreaElement, MobileTextareaProps>(
  function MobileTextarea(
    {
      label,
      error,
      helperText,
      required,
      containerClassName,
      className,
      minRows = 3,
      id,
      ...props
    },
    ref
  ) {
    const inputId = id ?? `textarea-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className={clsx('space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ctp-text"
          >
            {label}
            {required && <span className="text-ctp-red ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={minRows}
          className={clsx(
            'w-full px-4 py-3 rounded-lg border transition-colors resize-y',
            'bg-ctp-surface0 text-ctp-text placeholder:text-ctp-subtext0',
            'focus:outline-none focus:ring-2 focus:ring-ctp-blue/50',
            'min-h-[96px]',
            error
              ? 'border-ctp-red focus:border-ctp-red'
              : 'border-ctp-surface1 focus:border-ctp-blue',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-ctp-red" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-ctp-subtext0">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Select
// ----------------------------------------------------------------------------

export interface MobileSelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    BaseInputProps {
  /** Select size */
  selectSize?: 'sm' | 'md' | 'lg';
}

export const MobileSelect = forwardRef<HTMLSelectElement, MobileSelectProps>(
  function MobileSelect(
    {
      label,
      error,
      helperText,
      required,
      containerClassName,
      className,
      selectSize = 'md',
      id,
      children,
      ...props
    },
    ref
  ) {
    const inputId = id ?? `select-${Math.random().toString(36).substring(2, 9)}`;

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm min-h-[40px]',
      md: 'px-4 py-3 text-base min-h-[48px]',
      lg: 'px-4 py-4 text-lg min-h-[56px]',
    };

    return (
      <div className={clsx('space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ctp-text"
          >
            {label}
            {required && <span className="text-ctp-red ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full rounded-lg border transition-colors appearance-none',
            'bg-ctp-surface0 text-ctp-text',
            'focus:outline-none focus:ring-2 focus:ring-ctp-blue/50',
            'touch-target cursor-pointer',
            'bg-no-repeat bg-right',
            sizeClasses[selectSize],
            error
              ? 'border-ctp-red focus:border-ctp-red'
              : 'border-ctp-surface1 focus:border-ctp-blue',
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236c7086' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.75rem center',
            backgroundSize: '1.5em 1.5em',
            paddingRight: '2.5rem',
          }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-ctp-red" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-ctp-subtext0">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

// ----------------------------------------------------------------------------
// Mobile Checkbox
// ----------------------------------------------------------------------------

export interface MobileCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>,
    Omit<BaseInputProps, 'helperText'> {}

export const MobileCheckbox = forwardRef<HTMLInputElement, MobileCheckboxProps>(
  function MobileCheckbox(
    { label, error, required, containerClassName, className, id, ...props },
    ref
  ) {
    const inputId = id ?? `checkbox-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className={clsx('flex items-start gap-3', containerClassName)}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={clsx(
            'w-5 h-5 mt-0.5 rounded border-2 cursor-pointer',
            'bg-ctp-surface0 border-ctp-surface1',
            'checked:bg-ctp-blue checked:border-ctp-blue',
            'focus:outline-none focus:ring-2 focus:ring-ctp-blue/50 focus:ring-offset-2 focus:ring-offset-ctp-base',
            'touch-target',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm text-ctp-text cursor-pointer select-none"
          >
            {label}
            {required && <span className="text-ctp-red ml-1">*</span>}
          </label>
        )}
        {error && (
          <p className="text-sm text-ctp-red" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export {
  MobileTextInput as Input,
  MobileCurrencyInput as CurrencyInput,
  MobilePhoneInput as PhoneInput,
  MobileEmailInput as EmailInput,
  MobileNumberInput as NumberInput,
  MobileSearchInput as SearchInput,
  MobileDateInput as DateInput,
  MobileTextarea as Textarea,
  MobileSelect as Select,
  MobileCheckbox as Checkbox,
};
