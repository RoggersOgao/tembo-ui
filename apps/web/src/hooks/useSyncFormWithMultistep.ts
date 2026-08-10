// hooks/useSyncFormWithMultiStep.ts
"use client";

import { useEffect, useMemo } from "react";
import {
  UseFormReturn,
  FieldValues,
  FieldPath,
  FieldErrors,
} from "react-hook-form";

type StepData<T extends FieldValues> = Partial<Pick<T, FieldPath<T>>>;

interface UseSyncFormWithMultiStepReturn<T extends FieldValues> {
  hasErrors: boolean;
  errorMessages: {
    field: FieldPath<T>;
    message: string;
  }[];
}

export function useSyncFormWithMultiStep<T extends FieldValues>(
  form: UseFormReturn<T>,
  stepFields: FieldPath<T>[],
  updateFormData?: (data: StepData<T>) => void
): UseSyncFormWithMultiStepReturn<T> {
  const { formState, getValues, watch } = form;

  /**
   * Extract only fields for current step
   */
  const extractStepData = (values: T): StepData<T> => {
    return stepFields.reduce((acc, field) => {
      acc[field] = values[field];
      return acc;
    }, {} as StepData<T>);
  };

  /**
   * Sync initial values
   */
  useEffect(() => {
    if (!updateFormData) return;

    const values = getValues();
    updateFormData(extractStepData(values));
  }, [getValues, updateFormData, stepFields]);

  /**
   * Watch for changes
   */
  useEffect(() => {
    if (!updateFormData) return;

    const subscription = watch((values) => {
      updateFormData(extractStepData(values as T));
    });

    return () => subscription.unsubscribe();
  }, [watch, updateFormData, stepFields]);

  /**
   * Compute validation state for current step
   */
  const { hasErrors, errorMessages } = useMemo(() => {
    const errors = formState.errors as FieldErrors<T>;

    const stepErrors = stepFields
      .map((field) => {
        const error = errors[field];
        if (!error) return null;

        return {
          field,
          message: String((error as any)?.message ?? ""),
        };
      })
      .filter(Boolean) as {
      field: FieldPath<T>;
      message: string;
    }[];

    return {
      hasErrors: stepErrors.length > 0,
      errorMessages: stepErrors,
    };
  }, [formState.errors, stepFields]);

  return { hasErrors, errorMessages };
}