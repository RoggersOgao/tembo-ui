// components/otp-form.tsx
import { cn } from "@/lib/utils"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import React, { useState, useEffect } from "react"

interface OTPFormProps extends React.ComponentProps<"div"> {
  codeValue: string
  backupCodeValue: string
  onCodeChange: (value: string) => void
  onBackupCodeChange: (value: string) => void
  email?: string
  onBack?: () => void
  onResend?: () => void
  disabled?: boolean
  autoSubmit?: boolean
  onComplete?: (code: string, backupCode: string) => void
  allowBackupCode?: boolean
  backupCodeLength?: number
  backupCodeType?: 'numeric' | 'alphanumeric'
}

export function OTPForm({
  className,
  codeValue,
  backupCodeValue,
  onCodeChange,
  onBackupCodeChange,
  email,
  onBack,
  onResend,
  disabled = false,
  autoSubmit = false,
  onComplete,
  allowBackupCode = false,
  backupCodeLength = 6,
  backupCodeType = 'alphanumeric',
  ...props
}: OTPFormProps) {
  const [useBackupCode, setUseBackupCode] = useState(false)
  
  // Reset to verification code when backup code is disabled
  useEffect(() => {
    if (!allowBackupCode && useBackupCode) {
      setUseBackupCode(false)
    }
  }, [allowBackupCode, useBackupCode])

  // Get pattern string based on backupCodeType
  const getBackupCodePattern = () => {
    if (backupCodeType === 'numeric') {
      return '^[0-9]*$'
    }
    return '^[A-Za-z0-9]*$' // Alphanumeric pattern
  }

  const handleCodeChange = (newValue: string) => {
    onCodeChange(newValue)
    
    // Check if OTP is complete (6 digits)
    if (newValue.length === 6 && onComplete) {
      onComplete(newValue, backupCodeValue)
    }
  }

  const handleBackupCodeChange = (newValue: string) => {
    onBackupCodeChange(newValue)
    
    // If backup code is entered and has minimum length, trigger onComplete
    if (newValue.length === backupCodeLength && onComplete) {
      onComplete(codeValue, newValue)
    }
  }

  const handleSwitchToBackup = () => {
    setUseBackupCode(true)
    // Clear backup code when switching to it
    onBackupCodeChange("")
  }

  const handleSwitchToCode = () => {
    setUseBackupCode(false)
    // Clear verification code when switching back
    onCodeChange("")
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {useBackupCode ? "Use Backup Code" : "Two-Factor Authentication"}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {useBackupCode 
              ? `Enter your ${backupCodeLength}-character backup code`
              : "Enter the 6-digit verification code from your authenticator app"
            }
          </p>
        </div>

        {/* Verification Code Input */}
        {!useBackupCode ? (
          <Field>
            <FieldLabel htmlFor="code" className="sr-only">
              Verification code
            </FieldLabel>
            <InputOTP
              maxLength={6}
              value={codeValue}
              onChange={handleCodeChange}
              id="code"
              required
              disabled={disabled}
              autoFocus
              pattern="^[0-9]*$" // Only digits for verification code
            >
              <InputOTPGroup className="gap-2 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-lg">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="gap-2 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-lg">
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="gap-2 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-lg">
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            
            <FieldDescription className="text-center">
              Enter the 6-digit code from your authenticator app
            </FieldDescription>
            
            {/* Switch to backup code link */}
            {allowBackupCode && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={handleSwitchToBackup}
                  disabled={disabled}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  Use backup code instead
                </button>
              </div>
            )}
          </Field>
        ) : (
          /* Backup Code Input (also OTP) */
          <Field>
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <FieldLabel htmlFor="backupCode" className="sr-only">
                  Backup code
                </FieldLabel>
                <InputOTP
                  maxLength={backupCodeLength}
                  value={backupCodeValue}
                  onChange={handleBackupCodeChange}
                  id="backupCode"
                  required
                  disabled={disabled}
                  autoFocus
                  pattern={getBackupCodePattern()}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup className="gap-1.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-lg">
                    {Array.from({ length: backupCodeLength }).map((_, index) => (
                      <InputOTPSlot 
                        key={index} 
                        index={index}
                        className="uppercase"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              
              <FieldDescription className="text-center">
                {backupCodeType === 'numeric' 
                  ? `Enter your ${backupCodeLength}-digit backup code`
                  : `Enter your ${backupCodeLength}-character backup code (letters and numbers)`}
              </FieldDescription>
              
              {/* Switch back to verification code */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSwitchToCode}
                  disabled={disabled}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  ← Use verification code instead
                </button>
              </div>
            </div>
          </Field>
        )}
        
        <div className="flex justify-between items-center pt-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={disabled}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              ← Back to login
            </button>
          )}
          
          {/* Resend code (only show when using verification code) */}
          {!useBackupCode && onResend && (
            <button
              type="button"
              onClick={onResend}
              disabled={disabled}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          )}
        </div>
      </FieldGroup>
    </div>
  )
}