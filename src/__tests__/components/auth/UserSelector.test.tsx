import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserSelector } from '@/components/auth/UserSelector';

describe('UserSelector', () => {
    const mockUsers = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
    const mockOnUserSelect = vi.fn();

    beforeEach(() => {
        mockOnUserSelect.mockClear();
    });

    it('should render nothing when no users are available', () => {
        const { container } = render(<UserSelector availableUsers={[]} onUserSelect={mockOnUserSelect} />);

        expect(container.firstChild).toBeNull();
    });

    it('should render all available users as buttons', () => {
        render(<UserSelector availableUsers={mockUsers} onUserSelect={mockOnUserSelect} />);

        // Check if label is rendered
        expect(screen.getByText('Available Users')).toBeInTheDocument();

        // Check if all user buttons are rendered
        mockUsers.forEach((user) => {
            expect(screen.getByRole('button', { name: user })).toBeInTheDocument();
        });
    });

    it('should call onUserSelect when a user button is clicked', () => {
        render(<UserSelector availableUsers={mockUsers} onUserSelect={mockOnUserSelect} />);

        const firstUserButton = screen.getByRole('button', { name: mockUsers[0] });
        fireEvent.click(firstUserButton);

        expect(mockOnUserSelect).toHaveBeenCalledWith(mockUsers[0]);
        expect(mockOnUserSelect).toHaveBeenCalledTimes(1);
    });

    it('should disable all buttons when disabled prop is true', () => {
        render(<UserSelector availableUsers={mockUsers} onUserSelect={mockOnUserSelect} disabled={true} />);

        mockUsers.forEach((user) => {
            const button = screen.getByRole('button', { name: user });
            expect(button).toBeDisabled();
        });
    });

    it('should enable all buttons when disabled prop is false', () => {
        render(<UserSelector availableUsers={mockUsers} onUserSelect={mockOnUserSelect} disabled={false} />);

        mockUsers.forEach((user) => {
            const button = screen.getByRole('button', { name: user });
            expect(button).not.toBeDisabled();
        });
    });
});
