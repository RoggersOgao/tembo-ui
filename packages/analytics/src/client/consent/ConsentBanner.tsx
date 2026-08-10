import React, { useState, useEffect } from 'react';
import { ConsentManager, getConsentManager } from './ConsentManager';
import { ConsentPreferences } from '../../core/types';
import { ConsentBannerProps, ConsentPreferencesModalProps } from './types';
import {
    X,
    Shield,
    BarChart3,
    Megaphone,
    UserCircle,
    Cookie,
    CheckCircle,
    Info
} from 'lucide-react';
import { TemboLogo } from './logo';

// Module-level constant — stable reference across every render,
// prevents the useEffect below from re-running on every render
// when the caller doesn't pass their own requiredCategories.
//
// IMPORTANT: this must default to an EMPTY array. Categories listed
// here are locked "on" and cannot be toggled by the user. Analytics,
// marketing, and personalization are meant to be user-choosable by
// default — only "essential" is always locked, and that's enforced
// separately via `disabled: true` on the category definition below,
// not via this list. If you need to force a category on for legal/
// business reasons, pass it explicitly via the `requiredCategories`
// prop on <ConsentBanner>.
const DEFAULT_REQUIRED_CATEGORIES: ('analytics' | 'marketing' | 'personalization')[] = [];

type ConsentCategoryKey = 'essential' | 'analytics' | 'marketing' | 'personalization';

interface ConsentCategoryOption {
    key: ConsentCategoryKey;
    label: string;
    description: string;
    icon: React.ReactNode;
    disabled?: boolean;
}

export function ConsentBanner({
    onAcceptAll,
    onRejectAll,
    onCustomize,
    title = 'We value your privacy',
    description = 'We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and personalize content. Your privacy is important to us.',
    acceptText = 'Accept All',
    rejectText = 'Reject All',
    customizeText = 'Customize',
    show: showProp,
    storageKey,
    requiredCategories = DEFAULT_REQUIRED_CATEGORIES,
    defaultPreferences,
    position = 'bottom',
    theme = 'light',
    className = '',
    consentEndpoint,
    storeRemotely = false,
    sessionId
}: ConsentBannerProps) {
    const [manager, setManager] = useState<ConsentManager | null>(null);
    const [show, setShow] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [tempPreferences, setTempPreferences] = useState<ConsentPreferences | null>(null);

    useEffect(() => {
        const consentManager = getConsentManager({
            storageKey,
            requiredCategories,
            defaultPreferences,
            consentEndpoint,
            storeRemotely,
            sessionId
        });
        setManager(consentManager);

        console.log('[ConsentBanner] showProp:', showProp, 'hasStoredConsent:', consentManager.hasStoredConsent());

        // Whether the user has ever made a decision — NOT whether they
        // granted anything. hasAnyConsent() would be false after "Reject
        // All", which would wrongly re-show the banner on next mount.
        const hasChosen = consentManager.hasStoredConsent();

        if (showProp !== undefined) {
            setShow(showProp);
        } else if (!hasChosen) {
            setShow(true);
        }

        const unsubscribe = consentManager.addListener(() => {
            if (showProp === undefined && consentManager.hasStoredConsent()) {
                setShow(false);
            }
        });

        // Listen for consent changes from other tabs/windows. The
        // interaction flag lives under its own storage key
        // (`${storageKey}__interacted`), so rather than matching e.key
        // exactly, just re-check hasStoredConsent() on any storage event.
        const handleStorageChange = () => {
            if (consentManager.hasStoredConsent()) {
                setShow(false);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            unsubscribe();
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [storageKey, requiredCategories, defaultPreferences, showProp, consentEndpoint, storeRemotely, sessionId]);
    const handleAcceptAll = () => {
        if (!manager) return;
        manager.grantAll();
        setShow(false);
        onAcceptAll?.();
    };

    const handleRejectAll = () => {
        if (!manager) return;
        manager.denyAll();
        setShow(false);
        onRejectAll?.();
    };

    const handleOpenCustomize = () => {
        if (!manager) return;
        setTempPreferences(manager.getPreferences());
        setShowModal(true);
        setShow(false);
    };

    const handleSavePreferences = (preferences: ConsentPreferences) => {
        if (!manager) return;
        manager.setPreferences(preferences);
        setShowModal(false);
        onCustomize?.(preferences);
    };

    // Only bail out when there's no manager at all — the banner's own
    // visibility (`show`) is handled inside the JSX below, NOT here,
    // otherwise closing the banner (e.g. to open the modal) also
    // unmounts the modal that lives in the same returned tree.
    if (!manager) return null;

    const themeClasses = theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
    const positionClasses = position === 'top' ? 'top-0' : 'bottom-0';

    return (
        <>
            {show && (
                <div
                    className={`fixed ${positionClasses} left-0 right-0 z-50 p-4 shadow-lg border-t ${themeClasses} ${className}`}
                    role="dialog"
                    aria-label="Cookie consent banner"
                >
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1  items-start gap-3">
                            <TemboLogo className="w-30 h-10 flex-shrink-0 mt-1" aria-hidden="true" />
                            <div>
                                <h3 className="text-lg font-semibold">{title}</h3>
                                <p className="text-sm opacity-90 mt-1">{description}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleRejectAll}
                                className="px-4 py-2 text-sm font-medium rounded-full transition-colors bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                            >
                                {rejectText}
                            </button>
                            <button
                                onClick={handleOpenCustomize}
                                className="px-4 py-2 text-sm font-medium rounded-full transition-colors border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                            >
                                {customizeText}
                            </button>
                            <button
                                onClick={handleAcceptAll}
                                className="px-4 py-2 text-sm font-medium rounded-full transition-colors bg-primary text-foreground hover:bg-blue-700"
                            >
                                {acceptText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && tempPreferences && (
                <ConsentPreferencesModal
                    isOpen={showModal}
                    onClose={() => {
                        setShowModal(false);
                        // onClose fires both for Cancel/X (no decision made) and for
                        // the modal's own post-save dismissal (decision already saved).
                        // Only fall back to re-showing the banner in the former case —
                        // check hasStoredConsent() rather than assuming "closed" means
                        // "cancelled".
                        if (!manager.hasStoredConsent()) {
                            setShow(true);
                        }
                    }}
                    onSave={handleSavePreferences}
                    preferences={tempPreferences}
                    requiredCategories={requiredCategories}
                    title="Cookie Preferences"
                    description="Choose which types of cookies you'd like to allow. Essential cookies are required for the website to function properly."
                    saveText="Save Preferences"
                />
            )}
        </>
    );
}


function ConsentPreferencesModal({
    isOpen,
    onClose,
    onSave,
    preferences,
    requiredCategories = [],
    title = 'Cookie Preferences',
    description = 'Choose which types of cookies you\'d like to allow.',
    saveText = 'Save Preferences',
    logoUrl,
    companyName = 'Tembo',
}: ConsentPreferencesModalProps) {
    const [localPreferences, setLocalPreferences] = useState<ConsentPreferences>(preferences);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        setLocalPreferences(preferences);
    }, [preferences]);

    if (!isOpen) return null;

    const categories: ConsentCategoryOption[] = [
        {
            key: 'essential',
            label: 'Essential',
            description: 'Required for the website to function properly. These cannot be disabled.',
            icon: <Shield className="w-5 h-5 text-secondary" />,
            disabled: true
        },
        {
            key: 'analytics',
            label: 'Analytics',
            description: 'Help us understand how visitors interact with the website.',
            icon: <BarChart3 className="w-5 h-5 text-secondary" />
        },
        {
            key: 'marketing',
            label: 'Marketing',
            description: 'Used to deliver personalized advertisements.',
            icon: <Megaphone className="w-5 h-5 text-secondary" />
        },
        {
            key: 'personalization',
            label: 'Personalization',
            description: 'Allow the website to remember your preferences.',
            icon: <UserCircle className="w-5 h-5 text-secondary" />
        },
    ];

    const handleToggle = (key: keyof ConsentPreferences) => {
        setLocalPreferences((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Simulate async save
            await new Promise(resolve => setTimeout(resolve, 800));
            onSave?.(localPreferences);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Failed to save preferences:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const getToggleCount = () => {
        return Object.keys(localPreferences).filter(
            key => localPreferences[key as keyof ConsentPreferences]
        ).length;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
                {/* Header with Logo */}
                <div className="relative p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={companyName}
                                    className="h-10 w-10 rounded-lg object-cover"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                                    <Cookie className="w-6 h-6 text-white" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {title}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {companyName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Description with stats */}
                    <div className="mb-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {description}
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                                <Cookie className="w-4 h-4" />
                                {getToggleCount()} categories selected
                            </span>
                            <span className="flex items-center gap-1">
                                <Info className="w-4 h-4" />
                                {requiredCategories.length + 1} required
                            </span>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {categories.map(({ key, label, description, icon, disabled }) => {
                            const isRequired = requiredCategories.includes(key as any);
                            // A category is "locked" (non-interactive) if it's
                            // hardcoded disabled (essential) OR explicitly marked
                            // required via the requiredCategories prop. Both cases
                            // should render and behave identically.
                            const isLocked = disabled || isRequired;
                            const isChecked = localPreferences[key] ?? false;

                            return (
                                <div
                                    key={key}
                                    className={`
                    group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-200
                    ${isChecked ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                    ${isLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                                    onClick={() => !isLocked && handleToggle(key)}
                                >
                                    {/* Icon */}
                                    <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                    ${isChecked ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}
                  `}>
                                        {icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                                                {label}
                                            </h3>
                                            {isLocked && (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Required
                                                </span>
                                            )}
                                            {isChecked && !isLocked && (
                                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-red-700 dark:text-green-300 rounded-full">
                                                    Enabled
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                            {description}
                                        </p>
                                    </div>

                                    {/* Toggle Switch */}
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggle(key)}
                                            disabled={isLocked}
                                            className="sr-only peer"
                                        />
                                        <div className={`
                      w-11 h-6 rounded-full transition-all duration-200
                      ${isChecked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}
                      ${isLocked ? 'opacity-50 cursor-not-allowed' : 'peer-hover:ring-2 peer-hover:ring-blue-300/50'}
                      peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                      after:bg-white after:border after:border-gray-300 after:rounded-full 
                      after:h-5 after:w-5 after:transition-all after:duration-200
                      ${isChecked ? 'after:translate-x-full after:border-white' : 'after:translate-x-0'}
                    `}></div>
                                    </label>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`
                  flex-1 px-4 py-2.5 text-sm font-medium rounded-full text-foreground transition-all duration-200
                  ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-primary hover:bg-primary/80 hover:shadow-lg'}
                  flex items-center justify-center gap-2
                `}
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : showSuccess ? (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        Saved!
                                    </>
                                ) : (
                                    saveText
                                )}
                            </button>
                        </div>

                        {/* Additional Info */}
                        <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
                            You can change your preferences at any time from our privacy policy page.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}