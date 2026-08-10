export function openConsentPreferences(): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('analytics:open-consent-preferences'));
}