// store/pricing-store.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  PricingConfig, 
  PricingOption, 
  PriceCalculation 
} from '@/lib/products/pricing/pricing.api';

// ========================
// Store State Interface
// ========================

interface PricingState {
  // Current pricing configuration
  currentConfig: PricingConfig | null;
  
  // Pricing options for current config
  pricingOptions: PricingOption[];
  
  // Selected option
  selectedOption: PricingOption | null;
  
  // Price calculation result
  calculation: PriceCalculation | null;
  
  // Loading states
  isLoadingConfig: boolean;
  isLoadingOptions: boolean;
  isCalculating: boolean;
  
  // Error states
  configError: string | null;
  optionsError: string | null;
  calculationError: string | null;
  
  // Actions
  setCurrentConfig: (config: PricingConfig | null) => void;
  setPricingOptions: (options: PricingOption[]) => void;
  setSelectedOption: (option: PricingOption | null) => void;
  setCalculation: (calculation: PriceCalculation | null) => void;
  
  // Loading actions
  setLoadingConfig: (loading: boolean) => void;
  setLoadingOptions: (loading: boolean) => void;
  setCalculating: (calculating: boolean) => void;
  
  // Error actions
  setConfigError: (error: string | null) => void;
  setOptionsError: (error: string | null) => void;
  setCalculationError: (error: string | null) => void;
  
  // Utility actions
  clearPricingState: () => void;
  clearErrors: () => void;
  
  // Option helpers
  getDefaultOption: () => PricingOption | null;
  getOptionsByBillingPeriod: (period: string) => PricingOption[];
  addOption: (option: PricingOption) => void;
  updateOption: (optionId: string, updates: Partial<PricingOption>) => void;
  removeOption: (optionId: string) => void;
}

// ========================
// Zustand Store
// ========================

export const usePricingStore = create<PricingState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentConfig: null,
      pricingOptions: [],
      selectedOption: null,
      calculation: null,
      isLoadingConfig: false,
      isLoadingOptions: false,
      isCalculating: false,
      configError: null,
      optionsError: null,
      calculationError: null,

      // State setters
      setCurrentConfig: (config) => 
        set({ currentConfig: config }, false, 'setCurrentConfig'),

      setPricingOptions: (options) => 
        set({ pricingOptions: options }, false, 'setPricingOptions'),

      setSelectedOption: (option) => 
        set({ selectedOption: option }, false, 'setSelectedOption'),

      setCalculation: (calculation) => 
        set({ calculation }, false, 'setCalculation'),

      // Loading setters
      setLoadingConfig: (loading) => 
        set({ isLoadingConfig: loading }, false, 'setLoadingConfig'),

      setLoadingOptions: (loading) => 
        set({ isLoadingOptions: loading }, false, 'setLoadingOptions'),

      setCalculating: (calculating) => 
        set({ isCalculating: calculating }, false, 'setCalculating'),

      // Error setters
      setConfigError: (error) => 
        set({ configError: error }, false, 'setConfigError'),

      setOptionsError: (error) => 
        set({ optionsError: error }, false, 'setOptionsError'),

      setCalculationError: (error) => 
        set({ calculationError: error }, false, 'setCalculationError'),

      // Utility actions
      clearPricingState: () =>
        set(
          {
            currentConfig: null,
            pricingOptions: [],
            selectedOption: null,
            calculation: null,
            isLoadingConfig: false,
            isLoadingOptions: false,
            isCalculating: false,
            configError: null,
            optionsError: null,
            calculationError: null,
          },
          false,
          'clearPricingState'
        ),

      clearErrors: () =>
        set(
          {
            configError: null,
            optionsError: null,
            calculationError: null,
          },
          false,
          'clearErrors'
        ),

      // Option helpers
      getDefaultOption: () => {
        const { pricingOptions } = get();
        return pricingOptions.find((opt) => opt.isDefault) || null;
      },

      getOptionsByBillingPeriod: (period) => {
        const { pricingOptions } = get();
        return pricingOptions.filter((opt) => opt.billingPeriod === period);
      },

      addOption: (option) =>
        set(
          (state) => ({
            pricingOptions: [...state.pricingOptions, option],
          }),
          false,
          'addOption'
        ),

      updateOption: (optionId, updates) =>
        set(
          (state) => ({
            pricingOptions: state.pricingOptions.map((opt) =>
              opt.id === optionId ? { ...opt, ...updates } : opt
            ),
            // Update selected option if it's the one being updated
            selectedOption:
              state.selectedOption?.id === optionId
                ? { ...state.selectedOption, ...updates }
                : state.selectedOption,
          }),
          false,
          'updateOption'
        ),

      removeOption: (optionId) =>
        set(
          (state) => ({
            pricingOptions: state.pricingOptions.filter((opt) => opt.id !== optionId),
            // Clear selected option if it's being removed
            selectedOption:
              state.selectedOption?.id === optionId ? null : state.selectedOption,
          }),
          false,
          'removeOption'
        ),
    }),
    { name: 'PricingStore' }
  )
);

// ========================
// Selectors (for performance)
// ========================

export const selectCurrentConfig = (state: PricingState) => state.currentConfig;
export const selectPricingOptions = (state: PricingState) => state.pricingOptions;
export const selectSelectedOption = (state: PricingState) => state.selectedOption;
export const selectCalculation = (state: PricingState) => state.calculation;
export const selectIsLoading = (state: PricingState) => 
  state.isLoadingConfig || state.isLoadingOptions || state.isCalculating;
export const selectHasErrors = (state: PricingState) => 
  !!(state.configError || state.optionsError || state.calculationError);