import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../components/ThemeProvider';

// Mock next-themes
interface MockThemeProviderProps {
  children: React.ReactNode;
  enableSystem?: boolean;
  [key: string]: unknown;
}

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, enableSystem, ...props }: MockThemeProviderProps) => (
    <div 
      data-testid="theme-provider" 
      {...props}
      {...(enableSystem && { 'data-enable-system': 'true' })}
    >
      {children}
    </div>
  ),
}));

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children with theme provider wrapper', () => {
    render(
      <ThemeProvider>
        <div data-testid="child-content">Test Content</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should pass correct props to NextThemesProvider', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toHaveAttribute('attribute', 'class');
    expect(themeProvider).toHaveAttribute('defaultTheme', 'system');
    // enableSystem is handled as a data attribute in our mock
    expect(themeProvider).toHaveAttribute('data-enable-system', 'true');
  });

  it('should render multiple children correctly', () => {
    render(
      <ThemeProvider>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });
});
