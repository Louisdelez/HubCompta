// ============================================================================
// TEST UTILITIES - Finance Hub
// ============================================================================

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface WrapperProps {
  children: ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

// ----------------------------------------------------------------------------
// Default Query Client
// ----------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ----------------------------------------------------------------------------
// Providers Wrapper
// ----------------------------------------------------------------------------

function createWrapper(options: CustomRenderOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const Router = options.initialEntries ? MemoryRouter : BrowserRouter;
  const routerProps = options.initialEntries
    ? { initialEntries: options.initialEntries }
    : {};

  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router {...routerProps}>{children}</Router>
      </QueryClientProvider>
    );
  };
}

// ----------------------------------------------------------------------------
// Custom Render
// ----------------------------------------------------------------------------

function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { initialEntries, queryClient, ...renderOptions } = options;

  const wrapperOptions: { initialEntries?: string[]; queryClient?: QueryClient } = {};
  if (initialEntries !== undefined) {
    wrapperOptions.initialEntries = initialEntries;
  }
  if (queryClient !== undefined) {
    wrapperOptions.queryClient = queryClient;
  }

  return render(ui, {
    wrapper: createWrapper(wrapperOptions),
    ...renderOptions,
  });
}

// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

export * from '@testing-library/react';
export { customRender as render, createTestQueryClient };
