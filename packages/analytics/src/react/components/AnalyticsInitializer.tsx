import React, { useEffect, useRef } from 'react';
import { useAnalytics } from '../useAnalytics';

export function AnalyticsInitializer() {
    const { client, trackClick } = useAnalytics();
    const initializedRef = useRef(false);

    // Setup click tracking
    useEffect(() => {
        if (!client || initializedRef.current) return;
        initializedRef.current = true;

        const extractElementName = (el: HTMLElement | null): string | null => {
            if (!el) return null;

            // Priority: data attributes
            const dataName = el.getAttribute('data-analytics') || el.getAttribute('data-track');
            if (dataName?.trim()) return dataName.trim();

            // Accessibility labels
            const aria = el.getAttribute('aria-label');
            if (aria?.trim()) return aria.trim();

            // Form elements
            if (el instanceof HTMLInputElement) {
                return `${el.tagName.toLowerCase()}:${el.name || el.placeholder || el.id}`;
            }
            if (el instanceof HTMLButtonElement) {
                return `${el.tagName.toLowerCase()}:${el.name || el.id}`;
            }

            // Links
            if (el instanceof HTMLAnchorElement) {
                const href = el.getAttribute('href');
                const text = el.textContent?.trim().slice(0, 40) || '';
                if (href && href !== '#') {
                    return text ? `link:${text}` : `link:${href}`;
                }
                if (text) return `link:${text}`;
            }

            // Visible text
            const text = el.textContent?.trim();
            if (text && text.length > 2 && text.length < 100) {
                return text.replace(/\s+/g, ' ').slice(0, 60);
            }

            // ID
            if (el.id) return `#${el.id}`;

            return null;
        };

        const handleClick = (e: MouseEvent) => {
            if (!client) return;

            let el = e.target as HTMLElement | null;
            let found = false;

            for (let i = 0; i < 3 && el && !found; i++) {
                const name = extractElementName(el);
                if (name && !name.startsWith('.') && !name.startsWith('<')) {
                    trackClick(name);
                    found = true;
                    break;
                }
                el = el.parentElement;
            }
        };

        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [client, trackClick]);

    return null;
}