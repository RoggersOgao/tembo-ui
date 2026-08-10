// types/enums.ts
export const ProductStatus = {
  DRAFT:        'DRAFT',
  ACTIVE:       'ACTIVE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  DISCONTINUED: 'DISCONTINUED',
  ARCHIVED:     'ARCHIVED',
} as const;
export type ProductStatus = typeof ProductStatus[keyof typeof ProductStatus];

export const PriceType = {
  FIXED:     'FIXED',
  PER_KG:    'PER_KG',
  PER_PIECE: 'PER_PIECE',
  NEGOTIABLE:'NEGOTIABLE',
} as const;
export type PriceType = typeof PriceType[keyof typeof PriceType];

export const WeightUnit = {
  KILOGRAMS: 'KILOGRAMS',
  GRAMS:     'GRAMS',
  POUNDS:    'POUNDS',
  OUNCES:    'OUNCES',
  PIECES:    'PIECES',
} as const;
export type WeightUnit = typeof WeightUnit[keyof typeof WeightUnit];

export const DiscountType = {
  PERCENTAGE:   'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  FREE_DELIVERY:'FREE_DELIVERY',
  BUY_X_GET_Y:  'BUY_X_GET_Y',
} as const;
export type DiscountType = typeof DiscountType[keyof typeof DiscountType];