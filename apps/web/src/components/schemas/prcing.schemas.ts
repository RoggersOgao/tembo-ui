import { BILLING_PERIOD_LABELS } from "@/types/products/pricing.types";
import z from "zod"

const pricingOptionSchema = z.object({
  id: z.string().optional(),
  pricingConfigId: z.string(),
  amount: z.number(),
  currency: z.string(),
  billingPeriod: z.nativeEnum(BILLING_PERIOD_LABELS),
  minimumTerm: z.number().optional(),
  maximumTerm: z.number().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});

type PricingOption = z.infer<typeof pricingOptionSchema>;
