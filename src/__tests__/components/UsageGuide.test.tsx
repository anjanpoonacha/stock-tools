import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsageGuide } from '@/components/UsageGuide';

describe('UsageGuide', () => {
    const defaultProps = {
        title: 'Test Usage Guide',
        steps: ['First step of the guide', 'Second step of the guide', 'Third step of the guide'],
        tips: ['First helpful tip', 'Second helpful tip'],
    };

    it('should render with title and collapsed by default', () => {
        render(<UsageGuide {...defaultProps} />);

        expect(screen.getByText('Test Usage Guide')).toBeInTheDocument();
        expect(screen.queryByText('How to use:')).not.toBeInTheDocument();
        expect(screen.queryByText('First step of the guide')).not.toBeInTheDocument();
    });

    it('should render expanded when defaultExpanded is true', () => {
        render(<UsageGuide {...defaultProps} defaultExpanded={true} />);

        expect(screen.getByText('Test Usage Guide')).toBeInTheDocument();
        expect(screen.getByText('How to use:')).toBeInTheDocument();
        expect(screen.getByText('First step of the guide')).toBeInTheDocument();
        expect(screen.getByText('Second step of the guide')).toBeInTheDocument();
        expect(screen.getByText('Third step of the guide')).toBeInTheDocument();
    });

    it('should toggle expand/collapse when clicked', async () => {
        const user = userEvent.setup();
        render(<UsageGuide {...defaultProps} />);

        const toggleButton = screen.getByRole('button');

        // Should start collapsed
        expect(screen.queryByText('How to use:')).not.toBeInTheDocument();

        // Click to expand
        await user.click(toggleButton);
        expect(screen.getByText('How to use:')).toBeInTheDocument();
        expect(screen.getByText('First step of the guide')).toBeInTheDocument();

        // Click to collapse
        await user.click(toggleButton);
        expect(screen.queryByText('How to use:')).not.toBeInTheDocument();
    });

    it('should render all steps when expanded', () => {
        render(<UsageGuide {...defaultProps} defaultExpanded={true} />);

        expect(screen.getByText('First step of the guide')).toBeInTheDocument();
        expect(screen.getByText('Second step of the guide')).toBeInTheDocument();
        expect(screen.getByText('Third step of the guide')).toBeInTheDocument();
    });

    it('should render tips section when tips are provided', () => {
        render(<UsageGuide {...defaultProps} defaultExpanded={true} />);

        expect(screen.getByText('Tips:')).toBeInTheDocument();
        expect(screen.getByText('First helpful tip')).toBeInTheDocument();
        expect(screen.getByText('Second helpful tip')).toBeInTheDocument();
    });

    it('should not render tips section when no tips provided', () => {
        render(<UsageGuide {...defaultProps} tips={[]} defaultExpanded={true} />);

        expect(screen.getByText('How to use:')).toBeInTheDocument();
        expect(screen.queryByText('Tips:')).not.toBeInTheDocument();
    });

    it('should not render tips section when tips prop is undefined', () => {
        const propsWithoutTips = {
            title: 'Test Usage Guide',
            steps: ['Step 1', 'Step 2'],
        };
        render(<UsageGuide {...propsWithoutTips} defaultExpanded={true} />);

        expect(screen.getByText('How to use:')).toBeInTheDocument();
        expect(screen.queryByText('Tips:')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(<UsageGuide {...defaultProps} className='custom-class' />);

        const guideElement = container.firstChild as HTMLElement;
        expect(guideElement).toHaveClass('custom-class');
    });

    it('should show correct chevron icons based on expanded state', async () => {
        const user = userEvent.setup();
        render(<UsageGuide {...defaultProps} />);

        const toggleButton = screen.getByRole('button');

        // Should show ChevronDown when collapsed
        expect(document.querySelector('.lucide-chevron-down')).toBeInTheDocument();
        expect(document.querySelector('.lucide-chevron-up')).not.toBeInTheDocument();

        // Click to expand
        await user.click(toggleButton);

        // Should show ChevronUp when expanded
        expect(document.querySelector('.lucide-chevron-up')).toBeInTheDocument();
        expect(document.querySelector('.lucide-chevron-down')).not.toBeInTheDocument();
    });

    it('should show help circle icon', () => {
        render(<UsageGuide {...defaultProps} />);

        expect(document.querySelector('.lucide-circle-help')).toBeInTheDocument();
    });

    it('should render steps as ordered list', () => {
        render(<UsageGuide {...defaultProps} defaultExpanded={true} />);

        const allLists = screen.getAllByRole('list');
        const orderedList = allLists.find((list) => list.tagName === 'OL');
        expect(orderedList).toHaveClass('list-decimal');

        const listItems = screen.getAllByRole('listitem');
        expect(listItems).toHaveLength(5); // 3 steps + 2 tips
    });

    it('should handle single step', () => {
        const singleStepProps = {
            title: 'Single Step Guide',
            steps: ['Only one step'],
        };
        render(<UsageGuide {...singleStepProps} defaultExpanded={true} />);

        expect(screen.getByText('Only one step')).toBeInTheDocument();
        expect(screen.queryByText('Tips:')).not.toBeInTheDocument();
    });

    it('should handle empty steps array', () => {
        const emptyStepsProps = {
            title: 'Empty Guide',
            steps: [],
        };
        render(<UsageGuide {...emptyStepsProps} defaultExpanded={true} />);

        expect(screen.getByText('How to use:')).toBeInTheDocument();
        const listItems = screen.queryAllByRole('listitem');
        expect(listItems).toHaveLength(0);
    });
});
