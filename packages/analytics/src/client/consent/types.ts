import { ConsentConfig, ConsentPreferences } from '../../core/types';

export interface ConsentBannerProps
    extends Pick<ConsentConfig, 'storageKey' | 'consentEndpoint' | 'storeRemotely'> {
    onAcceptAll?: () => void;
    onRejectAll?: () => void;
    onCustomize?: (preferences: ConsentPreferences) => void;
    title?: string;
    description?: string;
    acceptText?: string;
    rejectText?: string;
    customizeText?: string;
    show?: boolean;
    requiredCategories?: ('analytics' | 'marketing' | 'personalization')[];
    defaultPreferences?: Partial<ConsentPreferences>;
    position?: 'bottom' | 'top';
    theme?: 'light' | 'dark';
    className?: string;
    sessionId?: string;
}
export interface ConsentPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (preferences: ConsentPreferences) => void;
  preferences: ConsentPreferences;
  requiredCategories?: Array<keyof ConsentPreferences>;
  title?: string;
  description?: string;
  saveText?: string;
  logoUrl?: string;
  companyName?: string;
}