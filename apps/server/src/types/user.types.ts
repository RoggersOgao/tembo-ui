import { 
  UserRole, 
  TwoFactorMethod, 
  MFADeviceType, 
  VerificationLevel, 
  SignupSource,
  Gender,
  VerificationStatus,
  VerificationMethod,
  IDDocumentType,
  ProfileVisibility,
  BadgeCategory,
  ProductStatus,
  WeightUnit,
  PriceType,
  OrderStatus,
  OrderType,
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
  MpesaTransactionType,
  MpesaTransactionStatus,
  RefundStatus,
  RefundMethod,
  DeliveryStatus,
  DeliveryTimeSlot,
  InventoryTransactionType,
  RestockStatus,
  SupplierStatus,
  PurchaseOrderStatus,
  DiscountType,
  PromotionStatus,
  CouponStatus,
  ReviewStatus,
  CommentStatus,
  CommentEntityType,
  VoteType,
  ReportEntityType,
  ReportReason,
  ReportStatus,
  NotificationType,
  NotificationChannel,
  AnalyticMetric
} from "@repo/database";

// ============== USER WITH RELATIONS ==============

export interface UserWithRelations {
  id: string;
  uuid: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  image: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  isSuspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  isTwoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod | null;
  twoFactorConfirmedAt: Date | null;
  language: string;
  timezone: string | null;
  currency: string | null;
  trustScore: number;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  loginCount: number;
  currentLoginIp: string | null;
  isVerified: boolean;
  verificationLevel: VerificationLevel;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  privacyAcceptedAt: Date | null;
  privacyVersion: string | null;
  marketingOptIn: boolean;
  dataProcessingConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  signupSource: SignupSource | null;
  referrerId: string | null;
  
  // Sensitive fields (optional)
  password?: string;
  passwordHashAlgorithm?: string;
  passwordLastChanged?: Date | null;
  passwordExpiresAt?: Date | null;
  twoFactorSecret?: string | null;
  backupCodes?: string[];
  failedLoginAttempts?: number;
  lastFailedLoginAt?: Date | null;
  lockedAt?: Date | null;
  lockReason?: string | null;
  unlockedAt?: Date | null;
  createdByIp?: string | null;
  trustedIps?: string[];
  deviceId?: string | null;
  riskLevel?: string | null;
  isSuspiciousRegistration?: boolean;
  requiresVerification?: boolean;
  
  // Relations
  profile: ProfileData | null;
  supplier: SupplierData | null;
  permissions: PermissionData[];
  accounts: AccountData[];
  mfaDevices: MFADeviceData[];
  trustedDevices: TrustedDeviceData[];
  securityQuestions: SecurityQuestionData[];
  badges: BadgeData[];
  
  // Business relations
  orders: OrderData[];
  cart: CartData | null;
  drafts: DraftData[];
  favourites: FavouriteData[];
  reviews: ReviewData[];
  comments: CommentData[];
  deliveryRatings: DeliveryRatingData[];
  notifications: NotificationData[];
  searchHistory: SearchHistoryData[];
  
  _count: {
    orders: number;
    favourites: number;
    reviews: number;
    comments: number;
    notifications: number;
    verificationTokens: number;
    passwordResetTokens: number;
    twoFactorTokens: number;
    emailChangeTokens: number;
    phoneChangeTokens: number;
    accounts: number;
    sessions: number;
    trustedDevices: number;
    securityQuestions: number;
    mfaDevices: number;
    badges: number;
  };
}

// ============== PROFILE DATA ==============

export interface ProfileData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  displayName: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  
  // Contact Information
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  
  // Address (primary delivery address)
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;
  
  // Identity Verification
  idVerificationStatus: VerificationStatus;
  idVerifiedAt: Date | null;
  idVerificationMethod: VerificationMethod | null;
  idDocumentType: IDDocumentType | null;
  idDocumentNumber: string | null;
  idDocumentExpiry: Date | null;
  
  // Social
  bio: string | null;
  profileVisibility: ProfileVisibility;
  
  // Stats
  totalOrders: number;
  totalSpent: number;
  
  // Professional Information
  occupation: string | null;
  company: string | null;
  jobTitle: string | null;
  yearsOfExperience: number | null;
  
  // Preferences
  notificationPreferences: any;
  marketingPreferences: any;
  communicationLanguage: string | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  
  // Delivery addresses
  deliveryAddresses: DeliveryAddressData[];
}

// ============== DELIVERY ADDRESS DATA ==============

export interface DeliveryAddressData {
  id: string;
  label: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  county: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============== SUPPLIER DATA ==============

export interface SupplierData {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  country: string;
  taxPin: string | null;
  status: SupplierStatus;
  isVerified: boolean;
  verifiedAt: Date | null;
  rating: number;
  leadTimeDays: number;
  paymentTerms: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  
  products: SupplierProductData[];
  purchaseOrders: PurchaseOrderData[];
}

export interface SupplierProductData {
  id: string;
  supplierSku: string | null;
  unitCost: number;
  minOrderQty: number;
  isPreferred: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

// ============== PERMISSION DATA ==============

export interface PermissionData {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============== ACCOUNT DATA ==============

export interface AccountData {
  id: string;
  provider: string;
  providerAccountId: string;
  type: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
}

// ============== MFA DEVICE DATA ==============

export interface MFADeviceData {
  id: string;
  name: string;
  type: MFADeviceType;
  secret: string | null;
  publicKey: string | null;
  credentialId: string | null;
  lastUsedAt: Date | null;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: Date;
}

// ============== TRUSTED DEVICE DATA ==============

export interface TrustedDeviceData {
  id: string;
  deviceId: string;
  deviceName: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  browserVersion: string | null;
  osVersion: string | null;
  location: string | null;
  ipAddress: string | null;
  trustScore: number;
  verified: boolean;
  firstSeen: Date;
  lastSeen: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============== SECURITY QUESTION DATA ==============

export interface SecurityQuestionData {
  id: string;
  question: string;
  order: number;
  createdAt: Date;
}

// ============== BADGE DATA ==============

export interface BadgeData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: BadgeCategory;
  requirement: any;
  createdAt: Date;
}

// ============== ORDER DATA ==============

export interface OrderData {
  id: string;
  number: string;
  orderType: OrderType;
  deliveryTimeSlot: DeliveryTimeSlot | null;
  requestedDeliveryAt: Date | null;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  couponCode: string | null;
  status: OrderStatus;
  notes: string | null;
  staffNotes: string | null;
  cuttingInstructions: string | null;
  confirmedAt: Date | null;
  processedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  items: OrderItemData[];
  payment: PaymentData | null;
  delivery: DeliveryData | null;
  refunds: RefundData[];
  
  deliveryAddress: DeliveryAddressData | null;
}

export interface OrderItemData {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  weightUnit: WeightUnit;
  status: OrderItemStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  product: {
    id: string;
    name: string;
    sku: string;
  };
  variant: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

// ============== CART DATA ==============

export interface CartData {
  id: string;
  notes: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  items: CartItemData[];
  coupon: CouponData | null;
}

export interface CartItemData {
  id: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  product: {
    id: string;
    name: string;
    featuredImage: string | null;
    basePrice: number;
  };
  variant: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

// ============== DRAFT DATA ==============

export interface DraftData {
  id: string;
  title: string | null;
  notes: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  items: DraftItemData[];
}

export interface DraftItemData {
  id: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  createdAt: Date;
  
  product: {
    id: string;
    name: string;
  };
  variant: {
    id: string;
    name: string;
  } | null;
}

// ============== FAVOURITE DATA ==============

export interface FavouriteData {
  id: string;
  createdAt: Date;
  
  product: {
    id: string;
    name: string;
    featuredImage: string | null;
    basePrice: number;
    averageRating: number;
  };
}

// ============== PAYMENT DATA ==============

export interface PaymentData {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  reference: string | null;
  gatewayReference: string | null;
  gatewayResponse: any;
  paidAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  mpesaTransaction: MpesaTransactionData | null;
}

export interface MpesaTransactionData {
  id: string;
  type: MpesaTransactionType;
  status: MpesaTransactionStatus;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  mpesaReceiptNumber: string | null;
  transactionDate: Date | null;
  phoneNumber: string | null;
  amount: number;
  resultCode: number | null;
  resultDesc: string | null;
  stkPushPayload: any;
  callbackPayload: any;
  initiatedAt: Date;
  completedAt: Date | null;
  timedOutAt: Date | null;
  reversedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundData {
  id: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: RefundStatus;
  method: RefundMethod;
  mpesaReceiptNumber: string | null;
  phoneNumber: string | null;
  requestedBy: string;
  approvedBy: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============== WALLET DATA ==============

export interface WalletData {
  id: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  
  transactions: WalletTransactionData[];
}

export interface WalletTransactionData {
  id: string;
  type: string;
  amount: number;
  balance: number;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}

// ============== DELIVERY DATA ==============

export interface DeliveryData {
  id: string;
  trackingCode: string | null;
  status: DeliveryStatus;
  estimatedDistance: number | null;
  estimatedDuration: number | null;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  proofImageUrl: string | null;
  recipientName: string | null;
  deliveryNotes: string | null;
  customerRating: number | null;
  customerFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  driver: {
    id: string;
    name: string | null;
    phone: string | null;
  } | null;
  branch: {
    id: string;
    name: string;
  };
  rating: DeliveryRatingData | null;
}

export interface DeliveryRatingData {
  id: string;
  overallRating: number;
  speedRating: number | null;
  conditionRating: number | null;
  courtesyRating: number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============== PRODUCT DATA ==============

export interface ProductData {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: number;
  priceType: PriceType;
  weightUnit: WeightUnit;
  minOrderQty: number;
  maxOrderQty: number | null;
  averageWeight: number | null;
  packSize: number | null;
  isHalal: boolean;
  isOrganic: boolean;
  isFreeRange: boolean;
  featuredImage: string | null;
  images: string[];
  videoUrl: string | null;
  nutritionInfo: any;
  storageInstructions: string | null;
  cookingInstructions: string | null;
  shelfLife: number | null;
  status: ProductStatus;
  isActive: boolean;
  isFeatured: boolean;
  publishedAt: Date | null;
  averageRating: number;
  reviewCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  
  category: {
    id: string;
    name: string;
    slug: string;
  };
  tags: {
    id: string;
    name: string;
  }[];
  variants: ProductVariantData[];
}

export interface ProductVariantData {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  reservedQuantity?: number;
  priceAdjustment: number;
  weight: number | null;
  weightUnit: WeightUnit;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============== REVIEW DATA ==============

export interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  status: ReviewStatus;
  isVerified: boolean;
  isFeatured: boolean;
  helpfulCount: number;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  product: {
    id: string;
    name: string;
    featuredImage: string | null;
  };
  votes: ReviewVoteData[];
}

export interface ReviewVoteData {
  id: string;
  helpful: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
  };
}

// ============== COMMENT DATA ==============

export interface CommentData {
  id: string;
  entityType: CommentEntityType;
  body: string;
  status: CommentStatus;
  isEdited: boolean;
  lastEditedAt: Date | null;
  upvoteCount: number;
  downvoteCount: number;
  replyCount: number;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  product: {
    id: string;
    name: string;
  } | null;
  review: {
    id: string;
    title: string | null;
  } | null;
  parent: {
    id: string;
    body: string;
    user: {
      id: string;
      name: string | null;
    };
  } | null;
  replies: CommentData[];
}

// ============== PROMOTION & COUPON DATA ==============

export interface PromotionData {
  id: string;
  name: string;
  description: string | null;
  status: PromotionStatus;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  appliesToAll: boolean;
  productIds: string[];
  categoryIds: string[];
  startsAt: Date;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  coupons: CouponData[];
}

export interface CouponData {
  id: string;
  code: string;
  status: CouponStatus;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponUsageData {
  id: string;
  discountApplied: number;
  usedAt: Date;
  userId: string;
  orderId: string;
}

// ============== NOTIFICATION DATA ==============

export interface NotificationData {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: any;
  imageUrl: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  createdAt: Date;
}

// ============== SEARCH HISTORY DATA ==============

export interface SearchHistoryData {
  id: string;
  query: string;
  filters: any;
  resultsCount: number;
  createdAt: Date;
}

// ============== REPORT DATA ==============

export interface ReportData {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  reporter: {
    id: string;
    name: string | null;
  };
  review: {
    id: string;
    title: string | null;
  } | null;
}

// ============== BRANCH DATA ==============

export interface BranchData {
  id: string;
  name: string;
  address: string;
  city: string;
  county: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============== INVENTORY DATA ==============

export interface InventoryItemData {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockedAt: Date | null;
  batchNumber: string | null;
  expiryDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  product: {
    id: string;
    name: string;
    sku: string;
  };
  variant: {
    id: string;
    name: string;
  } | null;
  branch: BranchData;
}

export interface InventoryTransactionData {
  id: string;
  type: InventoryTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number | null;
  reference: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: Date;
}

// ============== PURCHASE ORDER DATA ==============

export interface PurchaseOrderData {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  currency: string;
  expectedAt: Date | null;
  receivedAt: Date | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  supplier: SupplierData;
  branch: BranchData;
  items: PurchaseOrderItemData[];
}

export interface PurchaseOrderItemData {
  id: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
  expiryDate: Date | null;
  
  product: {
    id: string;
    name: string;
    sku: string;
  };
  variant: {
    id: string;
    name: string;
  } | null;
}

// ============== ANALYTICS DATA ==============

export interface ProductAnalyticEventData {
  id: string;
  metric: AnalyticMetric;
  value: number;
  metadata: any;
  createdAt: Date;
  
  product: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string | null;
  } | null;
}

export interface SalesSummaryData {
  id: string;
  date: Date;
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  totalDiscount: number;
  totalDeliveries: number;
  avgOrderValue: number;
  createdAt: Date;
  updatedAt: Date;
  
  branch: BranchData | null;
}

// ============== SESSION DATA ==============

export interface SessionData {
  id: string;
  sessionToken: string;
  expires: Date;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: any;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
}

// ============== TOKEN DATA ==============

export interface VerificationTokenData {
  id: string;
  email: string;
  token: string;
  expires: Date;
}

export interface PasswordResetTokenData {
  id: string;
  email: string;
  token: string;
  expires: Date;
  createdAt: Date;
}

export interface TwoFactorTokenData {
  id: string;
  email: string;
  token: string;
  expires: Date;
}

export interface EmailChangeTokenData {
  id: string;
  token: string;
  newEmail: string;
  oldEmail: string | null;
  expiresAt: Date;
  isUsed: boolean;
  usedAt: Date | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface PhoneChangeTokenData {
  id: string;
  token: string;
  newPhone: string;
  oldPhone: string | null;
  expiresAt: Date;
  isUsed: boolean;
  usedAt: Date | null;
  ipAddress: string | null;
  method: any;
  createdAt: Date;
}

// ============== AUDIT LOG DATA ==============

export interface AuditLogData {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: Date;
}

// ============== EXPORT DATA ==============

export interface ExportUserData {
  exportDate: string;
  user: Partial<UserWithRelations>;
  activity: {
    auditLogs: AuditLogData[];
    searchHistory: SearchHistoryData[];
    orders: OrderData[];
    reviews: ReviewData[];
    comments: CommentData[];
  };
  security: {
    verificationTokens: Partial<VerificationTokenData>[];
    passwordResetTokens: Partial<PasswordResetTokenData>[];
    twoFactorTokens: Partial<TwoFactorTokenData>[];
    emailChangeTokens: Partial<EmailChangeTokenData>[];
    phoneChangeTokens: Partial<PhoneChangeTokenData>[];
  };
}

// ============== USER ACTIVITY TYPES ==============

export type ActivityType = 
  | 'LOGIN'
  | 'ORDER'
  | 'FAVOURITE'
  | 'REVIEW'
  | 'COMMENT'
  | 'PRODUCT_VIEW'
  | 'CART_ADD'
  | 'CHECKOUT';

export interface UserActivity {
  type: ActivityType;
  date: Date;
  data: any;
}


// ============== EXPORT-SPECIFIC SIMPLIFIED TYPES ==============

export interface ExportProfileData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  addressLine1: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
  idVerificationStatus: VerificationStatus;
  idDocumentType: IDDocumentType | null;
  totalOrders: number;
  totalSpent: number;
}

export interface ExportAccountData {
  id: string;
  provider: string;
  providerAccountId: string;
  type: string;
  refresh_token?: string | null;
  access_token?: string | null;
  id_token?: string | null;
}

// ============== EXPORT-SPECIFIC SIMPLIFIED TYPES ==============

// This is for the USER data within the export
export interface ExportUserDataw {
  id: string;
  uuid: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  image: string | null;
  role: UserRole;
  isActive: boolean;
  isSuspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  isTwoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod | null;
  language: string;
  timezone: string | null;
  currency: string | null;
  trustScore: number;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  loginCount: number;
  isVerified: boolean;
  verificationLevel: VerificationLevel;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  privacyAcceptedAt: Date | null;
  privacyVersion: string | null;
  marketingOptIn: boolean;
  dataProcessingConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
  signupSource: SignupSource | null;
  referrerId: string | null;
  profile: ExportProfileData | null;
  accounts: ExportAccountData[];
}


export interface ExportOrderItemData {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ExportOrderData {
  id: string;
  number: string;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes: string | null;
  createdAt: Date;
  items: ExportOrderItemData[];
}

export interface ExportReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  status: ReviewStatus;
  helpfulCount: number;
  createdAt: Date;
  product: {
    id: string;
  };
}

export interface ExportCommentData {
  id: string;
  entityType: CommentEntityType;
  body: string;
  status: CommentStatus;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: Date;
}

export interface ExportAuditLogData {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: Date;
}

export interface ExportSearchHistoryData {
  id: string;
  query: string;
  filters: any;
  resultsCount: number;
  createdAt: Date;
}

export interface ExportVerificationTokenData {
  id: string;
  email: string;
  token: string;
  expires: Date;
}

export interface ExportPasswordResetTokenData {
  id: string;
  email: string;
  token: string;
  expires: Date;
  createdAt: Date;
}

export interface ExportTwoFactorTokenData {
  id: string;
  email: string;
  token: string;
  expires: Date;
}

export interface ExportEmailChangeTokenData {
  id: string;
  token: string;
  newEmail: string;
  oldEmail: string | null;
  expiresAt: Date;
  isUsed: boolean;
  usedAt: Date | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface ExportPhoneChangeTokenData {
  id: string;
  token: string;
  newPhone: string;
  oldPhone: string | null;
  expiresAt: Date;
  isUsed: boolean;
  usedAt: Date | null;
  ipAddress: string | null;
  method: any;
  createdAt: Date;
}

export interface GDPRExportData {
  exportDate: string;
  user: ExportUserDataw;
  activity: {
    auditLogs: ExportAuditLogData[];
    searchHistory: ExportSearchHistoryData[];
    orders: ExportOrderData[];
    reviews: ExportReviewData[];
    comments: ExportCommentData[];
  };
  security: {
    verificationTokens: ExportVerificationTokenData[];
    passwordResetTokens: ExportPasswordResetTokenData[];
    twoFactorTokens: ExportTwoFactorTokenData[];
    emailChangeTokens: ExportEmailChangeTokenData[];
    phoneChangeTokens: ExportPhoneChangeTokenData[];
  };
}