/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from './SearchBar';
import { useI18n } from '../contexts/I18nContext';

// Mock I18nContext
vi.mock('../contexts/I18nContext', () => ({
    useI18n: vi.fn(),
}));

// Mock weatherApi
vi.mock('../services/weatherApi', () => ({
    searchCities: vi.fn(),
}));

describe('SearchBar', () => {
    it('shows clear button with correct attributes when text is entered', async () => {
        // Mock translation
        (useI18n as any).mockReturnValue({
            t: { search: { placeholder: 'Search city...' } },
            currentLanguage: 'en'
        });

        render(<SearchBar onSearch={vi.fn()} onLocationRequest={vi.fn()} />);

        const input = screen.getByPlaceholderText('Search city...') as HTMLInputElement;

        // Type into input
        fireEvent.change(input, { target: { value: 'New York' } });

        // Wait for button to appear (it renders conditionally)
        // findByLabelText is async and waits
        const clearButton = await screen.findByLabelText('Clear search');

        expect(clearButton).toBeTruthy();

        // This assertion is expected to fail initially as title is not yet implemented
        expect(clearButton.getAttribute('title')).toBe('Clear search');

        // Click to clear
        fireEvent.click(clearButton);

        expect(input.value).toBe('');

        // Verify button is gone
        const clearButtonAfter = screen.queryByLabelText('Clear search');
        expect(clearButtonAfter).toBeNull();
    });
});
