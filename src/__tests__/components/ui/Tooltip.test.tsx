import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Mock Radix UI Tooltip
vi.mock('@radix-ui/react-tooltip', () => ({
    Provider: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid='tooltip-provider' {...props}>
            {children}
        </div>
    ),
    Root: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid='tooltip-root' {...props}>
            {children}
        </div>
    ),
    Trigger: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <button data-testid='tooltip-trigger' {...props}>
            {children}
        </button>
    ),
    Content: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid='tooltip-content' {...props}>
            {children}
        </div>
    ),
    Portal: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid='tooltip-portal' {...props}>
            {children}
        </div>
    ),
    Arrow: ({ ...props }: { [key: string]: unknown }) => <div data-testid='tooltip-arrow' {...props} />,
}));

// Mock the utils function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

describe('Tooltip Components', () => {
    describe('TooltipProvider', () => {
        it('should render provider with children', () => {
            render(
                <TooltipProvider>
                    <div>Child content</div>
                </TooltipProvider>
            );

            expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
            expect(screen.getByText('Child content')).toBeInTheDocument();
        });

        it('should pass through props to provider', () => {
            render(
                <TooltipProvider delayDuration={500}>
                    <div>Content</div>
                </TooltipProvider>
            );

            const provider = screen.getByTestId('tooltip-provider');
            expect(provider).toHaveAttribute('delayDuration', '500');
        });
    });

    describe('Tooltip', () => {
        it('should render tooltip root with children', () => {
            render(
                <Tooltip>
                    <div>Tooltip children</div>
                </Tooltip>
            );

            expect(screen.getByTestId('tooltip-root')).toBeInTheDocument();
            expect(screen.getByText('Tooltip children')).toBeInTheDocument();
        });

        it('should pass through props to root', () => {
            render(
                <Tooltip open={true}>
                    <div>Content</div>
                </Tooltip>
            );

            const root = screen.getByTestId('tooltip-root');
            expect(root).toHaveAttribute('open');
        });
    });

    describe('TooltipTrigger', () => {
        it('should render trigger as button', () => {
            render(<TooltipTrigger>Hover me</TooltipTrigger>);

            const trigger = screen.getByTestId('tooltip-trigger');
            expect(trigger).toBeInTheDocument();
            expect(trigger.tagName).toBe('BUTTON');
            expect(trigger).toHaveTextContent('Hover me');
        });

        it('should handle click events', async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();
            render(<TooltipTrigger onClick={onClick}>Click me</TooltipTrigger>);

            const trigger = screen.getByTestId('tooltip-trigger');
            await user.click(trigger);

            expect(onClick).toHaveBeenCalled();
        });
    });

    describe('TooltipContent', () => {
        it('should render content with default props', () => {
            render(<TooltipContent>Tooltip text</TooltipContent>);

            const content = screen.getByTestId('tooltip-content');
            expect(content).toBeInTheDocument();
            expect(content).toHaveTextContent('Tooltip text');
        });

        it('should apply custom className', () => {
            render(<TooltipContent className='custom-tooltip'>Custom content</TooltipContent>);

            const content = screen.getByTestId('tooltip-content');
            expect(content).toHaveClass('custom-tooltip');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<TooltipContent ref={ref}>Content with ref</TooltipContent>);

            expect(ref).toHaveBeenCalled();
        });

        it('should pass through additional props', () => {
            render(
                <TooltipContent side='top' align='center'>
                    Positioned content
                </TooltipContent>
            );

            const content = screen.getByTestId('tooltip-content');
            expect(content).toHaveAttribute('side', 'top');
            expect(content).toHaveAttribute('align', 'center');
        });
    });

    describe('Complete Tooltip Structure', () => {
        it('should render complete tooltip with all components', () => {
            render(
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>Hover for info</TooltipTrigger>
                        <TooltipContent>
                            <p>This is helpful information</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );

            expect(screen.getAllByTestId('tooltip-provider')).toHaveLength(2); // Provider wraps content
            expect(screen.getByTestId('tooltip-root')).toBeInTheDocument();
            expect(screen.getByTestId('tooltip-trigger')).toHaveTextContent('Hover for info');
            expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
            expect(screen.getByText('This is helpful information')).toBeInTheDocument();
        });

        it('should handle multiple tooltips in provider', () => {
            render(
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>First trigger</TooltipTrigger>
                        <TooltipContent>First tooltip</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>Second trigger</TooltipTrigger>
                        <TooltipContent>Second tooltip</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );

            expect(screen.getByText('First trigger')).toBeInTheDocument();
            expect(screen.getByText('Second trigger')).toBeInTheDocument();
            expect(screen.getByText('First tooltip')).toBeInTheDocument();
            expect(screen.getByText('Second tooltip')).toBeInTheDocument();
        });
    });
});
