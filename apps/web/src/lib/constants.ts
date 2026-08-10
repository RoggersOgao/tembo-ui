import {
  Bath,
  Building,
  Bus,
  Cable,
  Car,
  Castle,
  Cigarette,
  Dumbbell,
  Hammer,
  Home,
  LucideIcon,
  Maximize,
  Mountain,
  PawPrint,
  Phone,
  Sprout,
  Thermometer,
  Trees,
  Tv,
  VolumeX,
  Warehouse,
  Waves,
  Wifi,
} from "lucide-react";

export enum AmenityEnum {
  WasherDryer = "WasherDryer",
  AirConditioning = "AirConditioning",
  Dishwasher = "Dishwasher",
  HighSpeedInternet = "HighSpeedInternet",
  HardwoodFloors = "HardwoodFloors",
  WalkInClosets = "WalkInClosets",
  Microwave = "Microwave",
  Refrigerator = "Refrigerator",
  Pool = "Pool",
  Gym = "Gym",
  Parking = "Parking",
  PetsAllowed = "PetsAllowed",
  WiFi = "WiFi",
}

export const AmenityIcons: Record<AmenityEnum, LucideIcon> = {
  WasherDryer: Waves,
  AirConditioning: Thermometer,
  Dishwasher: Waves,
  HighSpeedInternet: Wifi,
  HardwoodFloors: Home,
  WalkInClosets: Maximize,
  Microwave: Tv,
  Refrigerator: Thermometer,
  Pool: Waves,
  Gym: Dumbbell,
  Parking: Car,
  PetsAllowed: PawPrint,
  WiFi: Wifi,
};

export enum HighlightEnum {
  HighSpeedInternetAccess = "HighSpeedInternetAccess",
  WasherDryer = "WasherDryer",
  AirConditioning = "AirConditioning",
  Heating = "Heating",
  SmokeFree = "SmokeFree",
  CableReady = "CableReady",
  SatelliteTV = "SatelliteTV",
  DoubleVanities = "DoubleVanities",
  TubShower = "TubShower",
  Intercom = "Intercom",
  SprinklerSystem = "SprinklerSystem",
  RecentlyRenovated = "RecentlyRenovated",
  CloseToTransit = "CloseToTransit",
  GreatView = "GreatView",
  QuietNeighborhood = "QuietNeighborhood",
}

export const HighlightIcons: Record<HighlightEnum, LucideIcon> = {
  HighSpeedInternetAccess: Wifi,
  WasherDryer: Waves,
  AirConditioning: Thermometer,
  Heating: Thermometer,
  SmokeFree: Cigarette,
  CableReady: Cable,
  SatelliteTV: Tv,
  DoubleVanities: Maximize,
  TubShower: Bath,
  Intercom: Phone,
  SprinklerSystem: Sprout,
  RecentlyRenovated: Hammer,
  CloseToTransit: Bus,
  GreatView: Mountain,
  QuietNeighborhood: VolumeX,
};

export enum PropertyTypeEnum {
  Rooms = "Rooms",
  Tinyhouse = "Tinyhouse",
  Apartment = "Apartment",
  Villa = "Villa",
  Townhouse = "Townhouse",
  Cottage = "Cottage",
}

export const PropertyTypeIcons: Record<PropertyTypeEnum, LucideIcon> = {
  Rooms: Home,
  Tinyhouse: Warehouse,
  Apartment: Building,
  Villa: Castle,
  Townhouse: Home,
  Cottage: Trees,
};

// Add this constant at the end of the file
export const NAVBAR_HEIGHT = 52; // in pixels

// Test users for development
export const testUsers = {
  tenant: {
    username: "Carol White",
    userId: "us-east-2:76543210-90ab-cdef-1234-567890abcdef",
    signInDetails: {
      loginId: "carol.white@example.com",
      authFlowType: "USER_SRP_AUTH",
    },
  },
  tenantRole: "tenant",
  manager: {
    username: "John Smith",
    userId: "us-east-2:12345678-90ab-cdef-1234-567890abcdef",
    signInDetails: {
      loginId: "john.smith@example.com",
      authFlowType: "USER_SRP_AUTH",
    },
  },
  managerRole: "manager",
};





// lib/constants.ts
export const DEVICE = {
  TOKEN_EXPIRY_DAYS: 90,
  VERIFICATION_TIMEOUT_MINUTES: 10,
  MAX_VERIFICATION_ATTEMPTS: 3,
  CODE_LENGTH: 6,
  TOKEN_LENGTH: 32,
  DEFAULT_TRUST_SCORE: 60,
} as const;

export const MFA = {
  CODE_LENGTH: 6,
  BACKUP_CODE_LENGTH: 8,
  MAX_ATTEMPTS: 3,
  TOKEN_EXPIRY_MINUTES: 10,
} as const;

export const SECURITY = {
  MAX_FAILED_ATTEMPTS: 5,
  ACCOUNT_LOCK_MINUTES: 15,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_ATTEMPTS: 10,
  PASSWORD_EXPIRY_DAYS: 90,
} as const;

export const SESSION = {
  EXPIRY_DAYS: 30,
  REFRESH_THRESHOLD_DAYS: 7,
} as const;

export const RESPONSE = {
  ERROR_TYPES: {
    SUCCESS: 'SUCCESS',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
    EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
    PASSWORD_EXPIRED: 'PASSWORD_EXPIRED',
    MFA_REQUIRED: 'MFA_REQUIRED',
    MFA_GENERATION_FAILED: 'MFA_GENERATION_FAILED',
    INVALID_MFA_CODE: 'INVALID_MFA_CODE',
    INVALID_BACKUP_CODE: 'INVALID_BACKUP_CODE',
    DEVICE_VERIFICATION_REQUIRED: 'DEVICE_VERIFICATION_REQUIRED',
    INVALID_DEVICE_CODE: 'INVALID_DEVICE_CODE',
    DEVICE_TOKEN_INVALID: 'DEVICE_TOKEN_INVALID',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    ALREADY_VERIFIED: 'ALREADY_VERIFIED',
    TOKEN_GENERATION_FAILED: 'TOKEN_GENERATION_FAILED',
    EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  } as const,
} as const;

export const SUPPORT = {
  EMAIL: 'support@example.com',
  PHONE: '+1-555-123-4567',
} as const;