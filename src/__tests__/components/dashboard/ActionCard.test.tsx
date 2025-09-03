import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCard, Tool } from '@/components/dashboard/ActionCard';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

describe('ActionCard', () => {
    const mockTool: Tool = {
        id: 'test-tool',
        title: 'Test Tool',
        description: 'This is a test tool for testing purposes',
        href: '/test-tool',
        icon: 'ArrowLeftRight',
        category: 'Test Category',
        featured: false,
        keywords: ['test', 'tool'],
    };

    beforeEach(() => {
        mockPush.mockClear();
    });

    it('should render default ActionCard correctly', () => {
        render(<ActionCard tool={mockTool} />);

        // Check if title is rendered
        expect(screen.getByText('Test Tool')).toBeInTheDocument();

        // Check if description is rendered
        expect(screen.getByText('This is a test tool for testing purposes')).toBeInTheDocument();

        // Check if category badge is rendered
        expect(screen.getByText('Test Category')).toBeInTheDocument();

        // Check if "Open Tool" button is rendered
        expect(screen.getByText('Open Tool')).toBeInTheDocument();
    });

    it('should render featured ActionCard correctly', () => {
        render(<ActionCard tool={mockTool} featured={true} />);

        // Check if all elements are still rendered
        expect(screen.getByText('Test Tool')).toBeInTheDocument();
        expect(screen.getByText('This is a test tool for testing purposes')).toBeInTheDocument();
        expect(screen.getByText('Test Category')).toBeInTheDocument();
        expect(screen.getByText('Open Tool')).toBeInTheDocument();
    });

    it('should render compact ActionCard correctly', () => {
        render(<ActionCard tool={mockTool} compact={true} />);

        // Check if title and description are rendered
        expect(screen.getByText('Test Tool')).toBeInTheDocument();
        expect(screen.getByText('This is a test tool for testing purposes')).toBeInTheDocument();

        // Compact version should not have "Open Tool" button
        expect(screen.queryByText('Open Tool')).not.toBeInTheDocument();
    });

    it('should navigate when card is clicked', () => {
        render(<ActionCard tool={mockTool} />);

        const card = screen.getByText('Test Tool').closest('[role="button"], div');
        fireEvent.click(card!);

        expect(mockPush).toHaveBeenCalledWith('/test-tool');
    });

    it('should navigate when "Open Tool" button is clicked', () => {
        render(<ActionCard tool={mockTool} />);

        const button = screen.getByText('Open Tool');
        fireEvent.click(button);

        expect(mockPush).toHaveBeenCalledWith('/test-tool');
    });
});
