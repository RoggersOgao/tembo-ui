// hooks/use-pricing.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    pricingApiClient,
    CreatePricingConfigInput,
    UpdatePricingConfigInput,
    CreatePricingOptionInput,
    UpdatePricingOptionInput,
    CalculatePriceInput,
    PricingOptionsQuery,
} from '@/lib/products/pricing/pricing.api';
import { usePricingStore } from '@/hooks/zustand/stores/products/pricingStore/pricing.store';
import { toast } from 'sonner';




// ========================
// Query Keys
// ========================

export const pricingKeys = {
    all: ['pricing'] as const,
    configs: () => [...pricingKeys.all, 'configs'] as const,
    config: (propertyId: string) => [...pricingKeys.configs(), propertyId] as const,
    options: (configId: string) => [...pricingKeys.all, 'options', configId] as const,
    calculation: (configId: string, params: CalculatePriceInput) =>
        [...pricingKeys.all, 'calculation', configId, params] as const,
};

// ========================
// Pricing Configuration Hooks
// ========================

/**
 * Hook to fetch pricing configuration for a property
 */
export function usePricingConfig(propertyId: string, includeInactive = false) {
    const setCurrentConfig = usePricingStore((state) => state.setCurrentConfig);
    const setLoadingConfig = usePricingStore((state) => state.setLoadingConfig);
    const setConfigError = usePricingStore((state) => state.setConfigError);

    return useQuery({
        queryKey: pricingKeys.config(propertyId),
        queryFn: async () => {
            setLoadingConfig(true);
            setConfigError(null);
            try {
                const response = await pricingApiClient.getPricingByProperty(
                    propertyId,
                    includeInactive
                );
                if (response.success && response.data) {
                    setCurrentConfig(response.data);
                    return response.data;
                }
                throw new Error(response.message || 'Failed to fetch pricing config');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                setConfigError(errorMessage);
                throw error;
            } finally {
                setLoadingConfig(false);
            }
        },
        enabled: !!propertyId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to create pricing configuration
 */
export function useCreatePricingConfig() {
    const queryClient = useQueryClient();
    const setCurrentConfig = usePricingStore((state) => state.setCurrentConfig);

    return useMutation({
        mutationFn: async ({
            propertyId,
            data,
        }: {
            propertyId: string;
            data: CreatePricingConfigInput;
        }) => {
            const response = await pricingApiClient.createPricingConfig(propertyId, data);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to create pricing config');
            }
            return response.data;
        },
        onSuccess: (data, variables) => {
            setCurrentConfig(data);
            queryClient.invalidateQueries({ queryKey: pricingKeys.config(variables.propertyId) });
            toast.success("success", {
                description: 'Pricing configuration created successfully',
            });
        },
        onError: (error: Error) => {
            toast('Error', {
                description: error.message,
            });
        },
    });
}

/**
 * Hook to update pricing configuration
 */
export function useUpdatePricingConfig() {
    const queryClient = useQueryClient();
    const setCurrentConfig = usePricingStore((state) => state.setCurrentConfig);

    return useMutation({
        mutationFn: async ({
            id,
            data,
        }: {
            id: string;
            data: UpdatePricingConfigInput;
        }) => {
            const response = await pricingApiClient.updatePricingConfig(id, data);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to update pricing config');
            }
            return response.data;
        },
        onSuccess: (data) => {
            setCurrentConfig(data);
            queryClient.invalidateQueries({ queryKey: pricingKeys.configs() });
            toast.success("Success", {
                description: 'Pricing configuration updated successfully',
            });
        },
        onError: (error: Error) => {
            toast('Error', {
                description: error.message,
            });
        },
    });
}

/**
 * Hook to delete pricing configuration
 */
export function useDeletePricingConfig() {
    const queryClient = useQueryClient();
    const clearPricingState = usePricingStore((state) => state.clearPricingState);

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await pricingApiClient.deletePricingConfig(id);
            if (!response.success) {
                throw new Error(response.message || 'Failed to delete pricing config');
            }
            return response;
        },
        onSuccess: () => {
            clearPricingState();
            queryClient.invalidateQueries({ queryKey: pricingKeys.configs() });
            toast('Success', {

                description: 'Pricing configuration deleted successfully',
            });
        },
        onError: (error: Error) => {
            toast('Error', {
                description: error.message
            });
        },
    });
}

// ========================
// Pricing Options Hooks
// ========================

/**
 * Hook to fetch pricing options
 */
export function usePricingOptions(
    pricingConfigId: string,
    query?: PricingOptionsQuery
) {
    const setPricingOptions = usePricingStore((state) => state.setPricingOptions);
    const setLoadingOptions = usePricingStore((state) => state.setLoadingOptions);
    const setOptionsError = usePricingStore((state) => state.setOptionsError);

    return useQuery({
        queryKey: pricingKeys.options(pricingConfigId),
        queryFn: async () => {
            setLoadingOptions(true);
            setOptionsError(null);
            try {
                const response = await pricingApiClient.getPricingOptions(
                    pricingConfigId,
                    query
                );
                if (response.success && response.data) {
                    setPricingOptions(response.data);
                    return response.data;
                }
                throw new Error(response.message || 'Failed to fetch pricing options');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                setOptionsError(errorMessage);
                throw error;
            } finally {
                setLoadingOptions(false);
            }
        },
        enabled: !!pricingConfigId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to add pricing option
 */
export function useAddPricingOption() {
    const queryClient = useQueryClient();
    const addOption = usePricingStore((state) => state.addOption);

    return useMutation({
        mutationFn: async ({
            pricingConfigId,
            data,
        }: {
            pricingConfigId: string;
            data: CreatePricingOptionInput;
        }) => {
            const response = await pricingApiClient.addPricingOption(pricingConfigId, data);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to add pricing option');
            }
            return response.data;
        },
        onSuccess: (data, variables) => {
            addOption(data);
            queryClient.invalidateQueries({ queryKey: pricingKeys.options(variables.pricingConfigId) });
            toast("success", {

                description: 'Pricing option added successfully',
            });
        },
        onError: (error: Error) => {
            toast("Error", {
                description: error.message
            });
        },
    });
}

/**
 * Hook to update pricing option
 */
export function useUpdatePricingOption() {
    const queryClient = useQueryClient();
    const updateOption = usePricingStore((state) => state.updateOption);

    return useMutation({
        mutationFn: async ({
            optionId,
            data,
        }: {
            optionId: string;
            data: UpdatePricingOptionInput;
        }) => {
            const response = await pricingApiClient.updatePricingOption(optionId, data);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to update pricing option');
            }
            return response.data;
        },
        onSuccess: (data) => {
            updateOption(data.id, data);
            queryClient.invalidateQueries({ queryKey: pricingKeys.all });
            toast('Success', {

                description: 'Pricing option updated successfully',
            });
        },
        onError: (error: Error) => {
            toast('Error', {
                description: error.message
            });
        },
    });
}

/**
 * Hook to delete pricing option
 */
export function useDeletePricingOption() {
    const queryClient = useQueryClient();
    const removeOption = usePricingStore((state) => state.removeOption);

    return useMutation({
        mutationFn: async (optionId: string) => {
            const response = await pricingApiClient.deletePricingOption(optionId);
            if (!response.success) {
                throw new Error(response.message || 'Failed to delete pricing option');
            }
            return optionId;
        },
        onSuccess: (optionId) => {
            removeOption(optionId);
            queryClient.invalidateQueries({ queryKey: pricingKeys.all });
            toast.success('Success', {
                description: 'Pricing option deleted successfully',
            });
        },
        onError: (error: Error) => {
            toast('Error', {
                description: error.message
            });
        },
    });
}

/**
 * Hook to set default pricing option
 */
export function useSetDefaultPricingOption() {
    const queryClient = useQueryClient();
    const updateOption = usePricingStore((state) => state.updateOption);

    return useMutation({
        mutationFn: async (optionId: string) => {
            const response = await pricingApiClient.setDefaultPricingOption(optionId);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to set default option');
            }
            return response.data;
        },
        onSuccess: (data) => {
            // Update all options to reflect new default
            updateOption(data.id, { isDefault: true });
            queryClient.invalidateQueries({ queryKey: pricingKeys.all });
            toast.success('Success', {

                description: 'Default pricing option updated',
            });
        },
        onError: (error: Error) => {
            toast('Error', {
                description: error.message
            });
        },
    });
}

// ========================
// Price Calculation Hooks
// ========================

/**
 * Hook to calculate price
 */
export function useCalculatePrice(pricingConfigId: string) {
    const setCalculation = usePricingStore((state) => state.setCalculation);
    const setCalculating = usePricingStore((state) => state.setCalculating);
    const setCalculationError = usePricingStore((state) => state.setCalculationError);
    return useMutation({
        mutationFn: async (data: CalculatePriceInput) => {
            setCalculating(true);
            setCalculationError(null);
            try {
                const response = await pricingApiClient.calculatePrice(pricingConfigId, data);
                if (!response.success || !response.data) {
                    throw new Error(response.message || 'Failed to calculate price');
                }
                return response.data;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                setCalculationError(errorMessage);
                throw error;
            } finally {
                setCalculating(false);
            }
        },
        onSuccess: (data) => {
            setCalculation(data);
        },
        onError: (error: Error) => {
            toast.error('Calculation Error', {

                description: error.message,
            });
        },
    });
}