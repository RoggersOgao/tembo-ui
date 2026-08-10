// utils/clean-params.ts
export function cleanParams(params: Record<string, any>) {
    const cleaned: Record<string, any> = {};

    Object.keys(params).forEach((key) => {
        const value = params[key];
        // Only keep values that are strictly not undefined, null, or empty strings
        if (value !== undefined && value !== null && value !== '') {
            cleaned[key] = value;
        }
    });

    return cleaned;
}