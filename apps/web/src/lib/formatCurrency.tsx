export const formatCurrency = (
    amount: number,
    options?: {
        useSuffix?: boolean;           // Enable K/M/B suffixes
        suffixThreshold?: number;      // Minimum amount to start using suffixes (default: 500000)
        decimalPlaces?: number;        // Number of decimal places for suffix formatting
        minimumFractionDigits?: number; // Min fraction digits for normal formatting
        maximumFractionDigits?: number; // Max fraction digits for normal formatting
        locale?: string;               // Locale override
    }
) => {
    const {
        useSuffix = true,
        suffixThreshold = 500000,
        decimalPlaces = 1,
        minimumFractionDigits = 0,
        maximumFractionDigits = 0,
        locale = "en-KE"
    } = options || {};

    // Handle invalid input
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
        return 'N/A';
    }

    // Determine if we should use suffix formatting
    const shouldUseSuffix = useSuffix && Math.abs(amount) >= suffixThreshold;

    if (shouldUseSuffix) {
        // Define thresholds and suffixes
        const thresholds = [
            { threshold: 1e9, suffix: 'B' },  // Billion
            { threshold: 1e6, suffix: 'M' },  // Million
            { threshold: 1e3, suffix: 'K' },  // Thousand
        ];

        // Find appropriate threshold
        const { threshold, suffix } = thresholds.find(t => Math.abs(amount) >= t.threshold) || 
                                      { threshold: 1, suffix: '' };

        // Calculate the scaled amount
        const scaledAmount = amount / threshold;
        
        // Format with specified decimal places
        let formattedAmount: string;
        
        if (Math.abs(scaledAmount) < 10 && decimalPlaces > 0) {
            // For numbers < 10, show decimal places (e.g., 1.2M)
            formattedAmount = scaledAmount.toFixed(decimalPlaces);
        } else {
            // For numbers >= 10, round to whole number (e.g., 12M, 100M)
            formattedAmount = Math.round(scaledAmount).toString();
        }

        // Clean up trailing zeros
        if (formattedAmount.includes('.')) {
            formattedAmount = formattedAmount.replace(/\.?0+$/, '');
        }

        // Return with currency symbol and suffix
        const formatter = new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
        
        // Extract just the currency symbol
        const currencySymbol = formatter.format(0).replace('0', '').trim();
        
        return `${currencySymbol}${formattedAmount}${suffix}`;
    }

    // Normal formatting for amounts less than suffixThreshold
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: maximumFractionDigits,
    }).format(amount);
};

// Alternative version with more sophisticated suffix handling
export const formatCurrencyAdvanced = (
    amount: number,
    options?: {
        useSuffix?: boolean;
        suffixThreshold?: number;      // Minimum amount to start using suffixes (default: 500000)
        decimalPlaces?: number;
        suffixLowercase?: boolean;     // Use 'k', 'm', 'b' instead of 'K', 'M', 'B'
        compact?: boolean;             // Use Intl.NumberFormat compact notation if available
        showFullCurrency?: boolean;    // Show 'KES' after the amount
        locale?: string;               // Locale override
    }
) => {
    const {
        useSuffix = true,
        suffixThreshold = 500000,
        decimalPlaces = 1,
        suffixLowercase = false,
        compact = false,
        showFullCurrency = false,
        locale = "en-KE"
    } = options || {};

    // Handle invalid input
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
        return 'N/A';
    }

    // Check if browser supports compact notation
    if (compact && typeof Intl !== 'undefined') {
        try {
            return new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "KES",
                notation: "compact",
                compactDisplay: "short",
                minimumFractionDigits: 0,
                maximumFractionDigits: decimalPlaces,
            } as any).format(amount);
        } catch {
            // Fall back to manual formatting
        }
    }

    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";

    // Define formatting rules
    const formatRules = [
        { threshold: 1e9, suffix: 'B', divisor: 1e9 },
        { threshold: 1e6, suffix: 'M', divisor: 1e6 },
        { threshold: 1e3, suffix: 'K', divisor: 1e3 },
    ];

    if (useSuffix && absAmount >= suffixThreshold) {
        const rule = formatRules.find(r => absAmount >= r.threshold);
        
        if (rule) {
            const { divisor, suffix } = rule;
            const scaled = absAmount / divisor;
            
            // Format based on the scaled value
            let formatted: string;
            if (scaled >= 100) {
                // No decimals for large numbers (e.g., 150M)
                formatted = Math.round(scaled).toString();
            } else if (scaled >= 10) {
                // Optionally show decimals for medium numbers (e.g., 15.5M or 15M)
                formatted = decimalPlaces > 0 ? scaled.toFixed(decimalPlaces) : Math.round(scaled).toString();
            } else {
                // Show decimals for small numbers (e.g., 1.5M)
                formatted = scaled.toFixed(decimalPlaces);
            }
            
            // Clean up decimal trailing zeros
            formatted = formatted.replace(/\.?0+$/, '');
            
            // Get currency symbol
            const formatter = new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            });
            const currencySymbol = formatter.format(0).replace('0', '').trim();
            
            // Apply suffix case
            const finalSuffix = suffixLowercase ? suffix.toLowerCase() : suffix;
            
            // Add currency code if requested
            const currencyCode = showFullCurrency ? ' KES' : '';
            
            return `${sign}${currencySymbol}${formatted}${finalSuffix}${currencyCode}`;
        }
    }

    // Fallback to standard formatting
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 0,
        maximumFractionDigits: Math.abs(amount) < 1 ? 2 : 0,
    }).format(amount);
};

// Helper function to get the appropriate suffix
export const getSuffix = (
    amount: number, 
    options?: {
        lowercase?: boolean;
        suffixThreshold?: number;
    }
): { divisor: number; suffix: string } => {
    const { lowercase = false, suffixThreshold = 500000 } = options || {};
    const absAmount = Math.abs(amount);
    
    // Don't use suffix if below threshold
    if (absAmount < suffixThreshold) {
        return { divisor: 1, suffix: '' };
    }
    
    if (absAmount >= 1e9) {
        return { divisor: 1e9, suffix: lowercase ? 'b' : 'B' };
    }
    if (absAmount >= 1e6) {
        return { divisor: 1e6, suffix: lowercase ? 'm' : 'M' };
    }
    if (absAmount >= 1e3) {
        return { divisor: 1e3, suffix: lowercase ? 'k' : 'K' };
    }
    
    return { divisor: 1, suffix: '' };
};