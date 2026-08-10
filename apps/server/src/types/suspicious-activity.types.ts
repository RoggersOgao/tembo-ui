// types/suspicious-activity.ts
export interface CheckSuspiciousActivityInput {
  userId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  deviceId?: string;
  loginTime?: Date;
  action?: string;
  metadata?: Record<string, any>;
}


export interface RecordLoginActivityInput {
  userId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  city?: string;
  country?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  success?: boolean;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface SuspiciousActivityResult {
  isSuspicious: boolean;
  reason?: string;
  confidence: number;
  recommendations: string[];
  score: number
}



export interface RecordLoginActivityResult {
  recorded: boolean;
  activityId: string;
}


export interface FlagSuspiciousLoginInput {
  userId: string;
  ipAddress: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata?: {
    userAgent?: string;
    location?: string;
    deviceId?: string;
    attemptedAction?: string;
    [key: string]: any;
  };
}

export interface FlagSuspiciousLoginResult {
  flagged: boolean;
  alertId: string;
  timestamp: Date;
  severity: string;
}

export interface CheckSuspiciousActivityResult {
  isSuspicious: boolean;
  reason?: string;
  confidence: number;
  recommendations: string[];
}