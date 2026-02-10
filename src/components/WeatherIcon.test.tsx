/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WeatherIcon from './WeatherIcon';

describe('WeatherIcon Accessibility', () => {
    it('renders with aria-hidden="true" to be decorative', () => {
        // Test with a known condition that returns an icon
        const { container } = render(<WeatherIcon condition="Sunny" />);

        // Find the svg element
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });

    it('renders different icons for different conditions but all hidden', () => {
        const conditions = ['Rain', 'Snow', 'Mist', 'Cloudy'];

        conditions.forEach(condition => {
            const { container } = render(<WeatherIcon condition={condition} />);
            const svg = container.querySelector('svg');
            expect(svg).toBeTruthy();
            expect(svg?.getAttribute('aria-hidden')).toBe('true');
        });
    });
});
