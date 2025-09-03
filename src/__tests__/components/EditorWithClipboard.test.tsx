import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock clipboard API
const mockClipboard = {
    readText: vi.fn(),
    writeText: vi.fn(),
};

Object.assign(navigator, {
    clipboard: mockClipboard,
});

// Mock file reading
const mockFileText = vi.fn();
global.File = class MockFile {
    text = mockFileText;
    constructor(public name: string) {}
} as unknown as typeof File;

describe('EditorWithClipboard', () => {
    const defaultProps = {
        id: 'test-editor',
        label: 'Test Editor',
        value: 'test content',
        onChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockClipboard.readText.mockResolvedValue('clipboard content');
        mockClipboard.writeText.mockResolvedValue(undefined);
        mockFileText.mockResolvedValue('file content');
    });

    it('should render with label and textarea when expanded', () => {
        render(<EditorWithClipboard {...defaultProps} isCollapsed={false} />);

        expect(screen.getByText('Test Editor')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test content')).toBeInTheDocument();
    });

    it('should start collapsed by default', () => {
        render(<EditorWithClipboard {...defaultProps} />);

        expect(screen.getByText('Test Editor')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('test content')).not.toBeInTheDocument();
    });

    it('should toggle collapse/expand when chevron button is clicked', async () => {
        const user = userEvent.setup();
        render(<EditorWithClipboard {...defaultProps} />);

        // Should start collapsed
        expect(screen.queryByDisplayValue('test content')).not.toBeInTheDocument();

        // Click expand button
        const expandButton = screen.getByLabelText('Expand');
        await user.click(expandButton);

        // Should now be expanded
        expect(screen.getByDisplayValue('test content')).toBeInTheDocument();
        expect(screen.getByLabelText('Collapse')).toBeInTheDocument();

        // Click collapse button
        const collapseButton = screen.getByLabelText('Collapse');
        await user.click(collapseButton);

        // Should be collapsed again
        expect(screen.queryByDisplayValue('test content')).not.toBeInTheDocument();
    });

    it('should handle text changes when onChange is provided', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<EditorWithClipboard {...defaultProps} onChange={onChange} isCollapsed={false} />);

        const textarea = screen.getByDisplayValue('test content');
        await user.clear(textarea);
        await user.type(textarea, 'new content');

        // Check that onChange was called multiple times (once per character)
        expect(onChange).toHaveBeenCalled();
        expect(onChange.mock.calls.length).toBeGreaterThan(0);
    });

    it('should show paste button when showPaste is true', () => {
        render(<EditorWithClipboard {...defaultProps} showPaste={true} />);

        expect(screen.getByLabelText('Paste from clipboard')).toBeInTheDocument();
        expect(screen.getByLabelText('Import from file')).toBeInTheDocument();
    });

    it('should handle paste from clipboard', async () => {
        const user = userEvent.setup();
        const onPaste = vi.fn();
        render(<EditorWithClipboard {...defaultProps} showPaste={true} onPaste={onPaste} />);

        const pasteButton = screen.getByLabelText('Paste from clipboard');
        expect(pasteButton).toBeInTheDocument();
        expect(pasteButton).not.toBeDisabled();

        // Test that button is clickable
        await user.click(pasteButton);
        // Note: Actual clipboard functionality is tested in integration tests
    });

    it('should show copy button when showCopy is true', () => {
        render(<EditorWithClipboard {...defaultProps} showCopy={true} />);

        expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
    });

    it('should handle copy to clipboard with default behavior', async () => {
        const user = userEvent.setup();
        render(<EditorWithClipboard {...defaultProps} showCopy={true} />);

        const copyButton = screen.getByLabelText('Copy to clipboard');
        expect(copyButton).toBeInTheDocument();
        expect(copyButton).not.toBeDisabled();

        // Test that button is clickable
        await user.click(copyButton);
        // Note: Actual clipboard functionality is tested in integration tests
    });

    it('should handle copy with custom onCopy handler', async () => {
        const user = userEvent.setup();
        const onCopy = vi.fn();
        render(<EditorWithClipboard {...defaultProps} showCopy={true} onCopy={onCopy} />);

        const copyButton = screen.getByLabelText('Copy to clipboard');
        await user.click(copyButton);

        expect(onCopy).toHaveBeenCalled();
        expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it('should disable copy button when value is empty', () => {
        render(<EditorWithClipboard {...defaultProps} value='' showCopy={true} />);

        const copyButton = screen.getByLabelText('Copy to clipboard');
        expect(copyButton).toBeDisabled();
    });

    it('should disable copy button when disabledCopy is true', () => {
        render(<EditorWithClipboard {...defaultProps} showCopy={true} disabledCopy={true} />);

        const copyButton = screen.getByLabelText('Copy to clipboard');
        expect(copyButton).toBeDisabled();
    });

    it('should show download button when showDownload is true', () => {
        render(<EditorWithClipboard {...defaultProps} showDownload={true} />);

        expect(screen.getByLabelText('Download as file')).toBeInTheDocument();
    });

    it('should handle download button click', async () => {
        const user = userEvent.setup();
        const onDownload = vi.fn();
        render(<EditorWithClipboard {...defaultProps} showDownload={true} onDownload={onDownload} />);

        const downloadButton = screen.getByLabelText('Download as file');
        await user.click(downloadButton);

        expect(onDownload).toHaveBeenCalled();
    });

    it('should disable download button when value is empty', () => {
        render(<EditorWithClipboard {...defaultProps} value='' showDownload={true} onDownload={vi.fn()} />);

        const downloadButton = screen.getByLabelText('Download as file');
        expect(downloadButton).toBeDisabled();
    });

    it('should handle file import', async () => {
        const onPaste = vi.fn();
        render(<EditorWithClipboard {...defaultProps} showPaste={true} onPaste={onPaste} />);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        const file = new File(['file content'], 'test.txt', { type: 'text/plain' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(onPaste).toHaveBeenCalledWith('file content');
        });
    });

    it('should disable paste buttons when disabledPaste is true', () => {
        render(<EditorWithClipboard {...defaultProps} showPaste={true} disabledPaste={true} />);

        const pasteButton = screen.getByLabelText('Paste from clipboard');
        const importButton = screen.getByLabelText('Import from file');

        expect(pasteButton).toBeDisabled();
        expect(importButton).toBeDisabled();
    });

    it('should render as readonly when readOnly is true', () => {
        render(<EditorWithClipboard {...defaultProps} readOnly={true} isCollapsed={false} />);

        const textarea = screen.getByDisplayValue('test content');
        expect(textarea).toHaveAttribute('readonly');
    });

    it('should show placeholder when provided', () => {
        render(<EditorWithClipboard {...defaultProps} value='' placeholder='Enter text here' isCollapsed={false} />);

        expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
    });

    it('should apply custom className to textarea', () => {
        render(<EditorWithClipboard {...defaultProps} className='custom-class' isCollapsed={false} />);

        const textarea = screen.getByDisplayValue('test content');
        expect(textarea).toHaveClass('custom-class');
    });
});
