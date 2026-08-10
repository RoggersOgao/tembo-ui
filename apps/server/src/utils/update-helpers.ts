// utils/update-helpers.ts

/**
 * Filters out undefined values from an object
 * Only keeps properties with defined values
 */
export function filterUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value !== undefined)
    ) as Partial<T>;
}

/**
 * Filters out null and undefined values from an object
 */
export function filterNullish<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value !== null && value !== undefined)
    ) as Partial<T>;
}

/**
 * Checks if an object has any defined properties
 */
export function hasDefinedProps(obj: Record<string, any>): boolean {
    return Object.values(obj).some(value => value !== undefined);
}

/**
 * Safely extracts only changed fields from update data
 * Compares with existing data and only returns fields that changed
 */
export function extractChangedFields<T extends Record<string, any>>(
    updateData: Partial<T>,
    existingData: T
): Partial<T> {
    const changed: Partial<T> = {};

    for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined) continue;

        // For arrays, do deep comparison
        if (Array.isArray(value) && Array.isArray(existingData[key])) {
            if (JSON.stringify(value) !== JSON.stringify(existingData[key])) {
                (changed as any)[key] = value;
            }
        }
        // For objects, do deep comparison
        else if (typeof value === 'object' && value !== null && typeof existingData[key] === 'object') {
            if (JSON.stringify(value) !== JSON.stringify(existingData[key])) {
                (changed as any)[key] = value;
            }
        }
        // For primitives, direct comparison
        else if (value !== existingData[key]) {
            (changed as any)[key] = value;
        }
    }

    return changed;
}

/**
 * Type guard to check if update object has any updates
 */
export function hasUpdates(obj: Record<string, any> | undefined): boolean {
    if (!obj) return false;
    return Object.keys(filterUndefined(obj)).length > 0;
}

/**
 * Prisma-safe update builder
 * Only includes fields that are present and defined
 */
export class UpdateBuilder<T extends Record<string, any>> {
    private updates: Partial<T> = {};

    /**
     * Add a field to the update if it's defined
     */
    set(key: keyof T, value: T[keyof T] | undefined): this {
        if (value !== undefined) {
            this.updates[key] = value;
        }
        return this;
    }

    /**
     * Add multiple fields at once
     */
    merge(data: Partial<T>): this {
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                this.updates[key as keyof T] = value as T[keyof T];
            }
        });
        return this;
    }

    /**
     * Get the built update object
     */
    build(): Partial<T> {
        return this.updates;
    }

    /**
     * Check if any updates were added
     */
    hasUpdates(): boolean {
        return Object.keys(this.updates).length > 0;
    }

    /**
     * Get the count of updates
     */
    count(): number {
        return Object.keys(this.updates).length;
    }
}

/**
 * Example usage:
 * 
 * const updates = new UpdateBuilder<Property>()
 *   .set('name', data.name)
 *   .set('description', data.description)
 *   .set('pricePerMonth', data.pricePerMonth)
 *   .build();
 * 
 * if (updates.hasUpdates()) {
 *   await db.property.update({ where: { id }, data: updates });
 * }
 */

/**
 * Validate update data structure
 */
export function validateUpdateStructure(data: any): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        errors.push('Update data must be an object');
        return { valid: false, errors };
    }

    // Check for common issues
    if (Array.isArray(data)) {
        errors.push('Update data should be an object, not an array');
    }

    // Warn about potential issues
    const reservedFields = ['id', 'createdAt', 'updatedAt'];
    reservedFields.forEach(field => {
        if (field in data) {
            errors.push(`Cannot update reserved field: ${field}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Deep merge two objects (useful for nested updates)
 */
export function deepMerge<T extends Record<string, any>>(
    target: T,
    source: Partial<T>
): T {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined) continue;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key as keyof T] = deepMerge(
                (target[key as keyof T] || {}) as any,
                value
            ) as T[keyof T];
        } else {
            result[key as keyof T] = value as T[keyof T];
        }
    }

    return result;
}

/**
 * Pick only specific fields from an object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
}

/**
 * Omit specific fields from an object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj };
    keys.forEach(key => {
        delete result[key];
    });
    return result as Omit<T, K>;
}

/**
 * Compare two objects and return differences
 */
/**
 * Compare two objects and return differences
 */
export function diffObjects<T extends Record<string, any>>(
    oldObj: T,
    newObj: Partial<T>
): {
    added: string[];
    modified: string[];
    unchanged: string[];
} {
    const added: string[] = [];
    const modified: string[] = [];
    const unchanged: string[] = [];

    for (const key of Object.keys(newObj)) {
        const newValue = newObj[key];
        const oldValue = oldObj[key];

        // Key didn't exist before → added
        if (!(key in oldObj)) {
            added.push(key);
            continue;
        }

        // Compare values (handles objects, arrays, primitives)
        const isEqual =
            (oldValue === newValue) ||
            (typeof oldValue === "object" &&
                typeof newValue === "object" &&
                oldValue !== null &&
                newValue !== null &&
                deepEqual(oldValue, newValue));

        if (isEqual) {
            unchanged.push(key);
        } else {
            modified.push(key);
        }
    }

    return { added, modified, unchanged };
}

/** Shallow-safe deep equal */
function deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}