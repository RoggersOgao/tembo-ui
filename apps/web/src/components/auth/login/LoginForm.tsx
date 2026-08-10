// components/auth/login-form.tsx - Rewritten with @tanstack/react-form
"use client";

import { Input } from "@workspace/ui/components/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { LiaEyeSolid, LiaEyeSlashSolid } from "react-icons/lia";
import { MdOutlineEmail } from "react-icons/md";
import ClipLoader from "react-spinners/ClipLoader";
import { CardWrapper } from "../auth-global/CardWrapper";

import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldError,
} from "@workspace/ui/components/field"
import {
    Checkbox
} from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";

import { useModal } from "@/hooks/zustand/use-modal";
import { LoginSchema } from "@/lib/schemas";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import { loginV2 } from "@/loginActions/login-v2";
import { OTPForm } from "./otp-form";

import {
    getDeviceToken,
    storeDeviceToken,
    clearDeviceToken,
    collectDeviceMetadata,
    hasValidDeviceToken,
    getDeviceInfo,
} from "@/lib/deviceId-service";

import {
    RESPONSE,
    SUPPORT
} from "@/lib/constants";
import { getIpAndGeo } from "@/hooks/useAnalytics";
import { userClient } from "@/loginActions/user-actions";

// Login flow states
type LoginFlow = "credentials" | "twoFactor" | "deviceVerification" | "combinedVerification";

interface LoginState {
    flow: LoginFlow;
    email: string;
    password: string;
    showPassword: boolean;
    waitingForMFA: boolean;
    waitingForDevice: boolean;
    hasTrustedDevice: boolean;
    deviceChallenge?: {
        challengeId: string;
        deviceId: string;
        method: "email" | "sms";
        expiresAt: Date;
    };
}

const defaultFormValues = {
    email: "",
    password: "",
    code: "",
    deviceVerificationCode: "",
    rememberDevice: false,
    backupCode: "",
    mfaDeviceId: "",
};

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { onClose, onOpen } = useModal();
    const callbackUrl = searchParams?.get("callbackUrl");
    const [isPending, startTransition] = useTransition();

    // Add submission tracking
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submissionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSubmissionRef = useRef<number>(0);

    // OTP states
    const [codeValue, setCodeValue] = useState("");
    const [backupCodeValue, setBackupCodeValue] = useState("");
    const [deviceVerificationCode, setDeviceVerificationCode] = useState("");
    const [mfaDeviceId, setMfaDeviceId] = useState("");

    // Check for existing device token on mount and log it
    useEffect(() => {
        const hasToken = hasValidDeviceToken();
        const token = getDeviceToken();
        console.log('[-] Device token check on mount:', {
            hasToken,
            token: token ? JSON.parse(token) : null
        });
    }, []);

    // Unified state management
    const [loginState, setLoginState] = useState<LoginState>({
        flow: "credentials",
        email: "",
        password: "",
        showPassword: false,
        waitingForMFA: false,
        waitingForDevice: false,
        hasTrustedDevice: hasValidDeviceToken(),
    });

    // Handle login response
    const handleLoginResponse = useCallback((data: any) => {
        console.log('[-] Login response received:', {
            flow: loginState.flow,
            responseType: data.errorType,
            success: data.success,
            deviceVerificationRequired: data.deviceVerificationRequired,
            mfaRequired: data.mfaRequired
        });

        if (!data) {
            toast.error("No response from server");
            setIsSubmitting(false);
            return "ERROR";
        }

        // Handle errors
        if (data.error) {
            // Check if we need to show device verification
            if (data.deviceVerificationRequired ||
                data.errorType === RESPONSE.ERROR_TYPES.DEVICE_VERIFICATION_REQUIRED ||
                data.errorType === RESPONSE.ERROR_TYPES.INVALID_DEVICE_CODE) {
                console.log('[-] Device verification required');

                setLoginState(prev => ({
                    ...prev,
                    flow: data.mfaRequired ? "combinedVerification" : "deviceVerification",
                    waitingForDevice: true,
                    waitingForMFA: !!data.mfaRequired,
                    deviceChallenge: data.deviceChallenge || prev.deviceChallenge
                }));

                if (data.deviceChallenge) {
                    setMfaDeviceId(data.deviceChallenge.challengeId);
                    form.setFieldValue("mfaDeviceId", data.deviceChallenge.challengeId);
                    if (data.deviceChallenge.expiresAt) {
                        const expiryTime = new Date(data.deviceChallenge.expiresAt).toLocaleTimeString();
                        toast.info(`Device verification code sent (expires at ${expiryTime})`);
                    } else {
                        toast.info("Device verification code sent to your email");
                    }
                }

                // Clear invalid device token
                if (data.errorType === RESPONSE.ERROR_TYPES.INVALID_DEVICE_CODE ||
                    data.errorType === RESPONSE.ERROR_TYPES.DEVICE_TOKEN_INVALID) {
                    console.log('🧹 Clearing invalid device token');
                    clearDeviceToken();
                    setLoginState(prev => ({ ...prev, hasTrustedDevice: false }));
                }

                setIsSubmitting(false);
                return "WAITING_FOR_INPUT";
            }

            // MFA required
            if (data.errorType === RESPONSE.ERROR_TYPES.MFA_REQUIRED ||
                data.mfaRequired ||
                data.twoFactor) {
                console.log('📧 MFA required');
                setLoginState(prev => ({
                    ...prev,
                    flow: "twoFactor",
                    waitingForMFA: true,
                }));
                toast.info("Please enter the verification code sent to your email");
                setIsSubmitting(false);
                return "WAITING_FOR_INPUT";
            }

            // Clear invalid device token
            if (data.errorType === RESPONSE.ERROR_TYPES.INVALID_DEVICE_CODE ||
                data.errorType === RESPONSE.ERROR_TYPES.DEVICE_TOKEN_INVALID) {
                console.log('🧹 Clearing invalid device token');
                clearDeviceToken();
                setLoginState(prev => ({ ...prev, hasTrustedDevice: false }));
            }

            toast.error(data.error);
            setIsSubmitting(false);
            return "ERROR";
        }

        // Handle two-factor authentication required
        if (data.twoFactor || data.mfaRequired) {
            console.log('📧 MFA initiated');
            setLoginState(prev => ({
                ...prev,
                flow: "twoFactor",
                waitingForMFA: true,
            }));
            toast.info(data.message || "Please enter the verification code sent to your email");
            setIsSubmitting(false);
            return "WAITING_FOR_INPUT";
        }

        // Handle device verification required
        if (data.deviceVerificationRequired) {
            console.log('[-] Device verification initiated:', data.deviceChallenge);

            setLoginState(prev => ({
                ...prev,
                flow: data.mfaRequired ? "combinedVerification" : "deviceVerification",
                waitingForDevice: true,
                waitingForMFA: !!data.mfaRequired,
                deviceChallenge: data.deviceChallenge
            }));

            if (data.deviceChallenge) {
                setMfaDeviceId(data.deviceChallenge.challengeId);
                form.setFieldValue("mfaDeviceId", data.deviceChallenge.challengeId);
            }

            if (data.deviceChallenge?.expiresAt) {
                const expiryTime = new Date(data.deviceChallenge.expiresAt).toLocaleTimeString();
                toast.info(`Device verification required (expires at ${expiryTime})`);
            } else {
                toast.info(data.message || "Please enter the device verification code");
            }
            setIsSubmitting(false);
            return "WAITING_FOR_INPUT";
        }

        // Handle email verification redirect
        if (data.redirect && data.redirect.includes("verify-email")) {
            toast.info(data.success || "Please verify your email");
            setIsSubmitting(false);

            // Small delay before redirect
            setTimeout(() => {
                router.push(data.redirect);
            }, 100);
            return "SUCCESS";
        }

        // Handle password expiry redirect
        if (data.errorType === RESPONSE.ERROR_TYPES.PASSWORD_EXPIRED) {
            toast.info(data.message || "Your password has expired");
            setIsSubmitting(false);

            if (data.resetToken) {
                // Small delay before redirect
                setTimeout(() => {
                    router.push(`/auth/reset-password?token=${data.resetToken}`);
                }, 100);
            }
            return "SUCCESS";
        }

        // Handle successful login
        if (data.success || data.success === true) {
            console.log(' Login successful');

            // Store device token if provided
            if (data.device?.deviceId && data.device?.challengeId) {
                try {
                    storeDeviceToken(
                        data.device.deviceId,
                        data.device.challengeId,
                        data.device.method,
                        data.device.expiresAt
                    );
                    console.log(' Device token stored for future use:', data.device.deviceId);
                    setLoginState(prev => ({ ...prev, hasTrustedDevice: true }));
                } catch (error) {
                    console.error('[*] Failed to store device token:', error);
                }
            }

            // Clear form and reset state
            form.reset();
            setCodeValue("");
            setBackupCodeValue("");
            setDeviceVerificationCode("");
            setMfaDeviceId("");
            setLoginState({
                flow: "credentials",
                email: "",
                password: "",
                showPassword: false,
                waitingForMFA: false,
                waitingForDevice: false,
                deviceChallenge: undefined,
                hasTrustedDevice: true,
            });

            const redirectUrl = data.redirect || callbackUrl || DEFAULT_LOGIN_REDIRECT;
            console.log('🔀 Redirecting to:', redirectUrl);

            // Show success message
            toast.success(data.message || "Login successful");

            // Defer redirect to allow state updates and prevent stream interruption
            submissionTimeoutRef.current = setTimeout(() => {
                setIsSubmitting(false);
                window.location.href = redirectUrl;
            }, 150);

            return "SUCCESS";
        }

        // Fallback
        console.error('[*] Unexpected response:', data);
        form.reset();
        toast.error("Unexpected response from server");
        setIsSubmitting(false);
        return "ERROR";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, callbackUrl, loginState.flow]);

    // Form setup with @tanstack/react-form
    const form = useForm({
        defaultValues: defaultFormValues,
        validators: {
            onSubmit: LoginSchema,
        },
        onSubmit: async ({ value }) => {
            // Prevent double submission
            if (isSubmitting) {
                console.log('[!] Already submitting, ignoring duplicate request');
                return;
            }

            // Prevent rapid submissions
            const now = Date.now();
            if (now - lastSubmissionRef.current < 1000) {
                console.log('[!] Submission rate limited');
                toast.warning("Please wait before submitting again");
                return;
            }
            lastSubmissionRef.current = now;

            setIsSubmitting(true);

            startTransition(async () => {
                try {
                    // Get comprehensive metadata from backend
                    const metadataResponse = await userClient.getRequestMetadata();

                    if (!metadataResponse.success || !metadataResponse.data) {
                        throw new Error('Failed to retrieve metadata');
                    }

                    const meta = metadataResponse.data;

                    // Collect current device metadata
                    const deviceMetadata = await collectDeviceMetadata();
                    const deviceInfo = getDeviceInfo();

                    // GET DEVICE TOKEN FROM LOCALSTORAGE BEFORE LOGIN
                    const existingDeviceToken = getDeviceToken();

                    console.log('[-] Login attempt:', {
                        step: loginState.flow,
                        email: value.email,
                        hasDeviceMetadata: !!deviceMetadata,
                        hasExistingDeviceToken: !!existingDeviceToken,
                        deviceToken: existingDeviceToken ? JSON.parse(existingDeviceToken) : null,
                        mfaRequired: !!value.code || !!value.backupCode,
                        deviceVerificationRequired: !!value.deviceVerificationCode,
                    });

                    const geo = await getIpAndGeo();

                    console.log("metaData", meta);

                    // Build request metadata
                    const requestMetadata = {
                        ipAddress: meta.ipAddress || geo.ip,
                        userAgent: navigator.userAgent,
                        city: meta.city,
                        country: meta.country,
                        timezone: meta.timezone,
                        os: deviceMetadata.os,
                        deviceMetadata: deviceMetadata,
                        deviceToken: existingDeviceToken, // Include device token
                        requestFingerprint: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    };

                    // Store email and password for ALL flows (not just credentials)
                    if (value.email && value.password) {
                        setLoginState(prev => ({
                            ...prev,
                            email: value.email,
                            password: value.password
                        }));
                    }

                    // Always include stored credentials if available
                    const submitValues = {
                        ...value,
                        email: value.email || loginState.email,
                        password: value.password || loginState.password,
                    };

                    // CALL THE LOGIN FUNCTION
                    const data = await loginV2(submitValues, callbackUrl, requestMetadata);

                    // Handle the response
                    handleLoginResponse(data);

                } catch (error) {
                    console.error("Login error:", error);
                    toast.error("An unexpected error occurred. Please try again.");
                    setIsSubmitting(false);
                }
            });
        },
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (submissionTimeoutRef.current) {
                clearTimeout(submissionTimeoutRef.current);
            }
        };
    }, []);

    // Toggle password visibility
    const togglePasswordVisibility = useCallback(() => {
        setLoginState(prev => ({ ...prev, showPassword: !prev.showPassword }));
    }, []);

    // Reset to credentials flow
    const resetToCredentials = useCallback(() => {
        // Clear submission state
        setIsSubmitting(false);
        if (submissionTimeoutRef.current) {
            clearTimeout(submissionTimeoutRef.current);
        }

        setLoginState({
            flow: "credentials",
            email: loginState.email,
            password: "",
            showPassword: false,
            waitingForMFA: false,
            waitingForDevice: false,
            deviceChallenge: undefined,
            hasTrustedDevice: hasValidDeviceToken(),
        });
        setCodeValue("");
        setBackupCodeValue("");
        setDeviceVerificationCode("");
        setMfaDeviceId("");
        form.setFieldValue("code", "");
        form.setFieldValue("backupCode", "");
        form.setFieldValue("deviceVerificationCode", "");
        form.setFieldValue("mfaDeviceId", "");
    }, [form, loginState.email]);

    // Update form values when OTP values change
    useEffect(() => {
        form.setFieldValue("code", codeValue);
    }, [codeValue, form]);

    useEffect(() => {
        form.setFieldValue("deviceVerificationCode", deviceVerificationCode);
    }, [deviceVerificationCode, form]);

    useEffect(() => {
        form.setFieldValue("backupCode", backupCodeValue);
    }, [backupCodeValue, form]);

    useEffect(() => {
        form.setFieldValue("mfaDeviceId", mfaDeviceId);
    }, [mfaDeviceId, form]);

    // Handle resend code - call separate endpoint instead of full login
    const handleResendCode = useCallback(async () => {
        if (!loginState.email) return;

        const now = Date.now();
        if (now - lastSubmissionRef.current < 2000) {
            console.log('[!] Resend rate limited');
            toast.warning("Please wait before requesting another code");
            return;
        }
        lastSubmissionRef.current = now;

        startTransition(async () => {
            toast.info("Resending verification code...");
            try {
                const values = form.state.values;

                // Build request for resend, keeping full shape LoginSchema expects
                const requestData = {
                    ...values,
                    email: values.email || loginState.email,
                    password: values.password || loginState.password,
                };

                const metadataResponse = await userClient.getRequestMetadata();
                const deviceMetadata = await collectDeviceMetadata();
                const geo = await getIpAndGeo();
                const existingDeviceToken = getDeviceToken();

                const requestMetadata = {
                    ipAddress: metadataResponse.data?.ipAddress || geo.ip,
                    userAgent: navigator.userAgent,
                    city: metadataResponse.data?.city,
                    country: metadataResponse.data?.country,
                    timezone: metadataResponse.data?.timezone,
                    os: deviceMetadata.os,
                    deviceMetadata: deviceMetadata,
                    deviceToken: existingDeviceToken,
                    requestFingerprint: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };

                const data = await loginV2(requestData, callbackUrl, requestMetadata);

                if (data.twoFactor || data.mfaRequired) {
                    toast.success("Verification code resent successfully");
                } else if (data.deviceVerificationRequired) {
                    toast.success("Device verification code resent successfully");
                } else if (data.error) {
                    toast.error(data.error);
                } else {
                    toast.success("Code resent successfully");
                }
            } catch (error) {
                console.error("Resend error:", error);
                toast.error("Failed to resend code");
            }
        });
    }, [loginState.email, loginState.password, form, callbackUrl]);

    // Determine if codes are complete
    const isMFACodeComplete = codeValue.length === 6 || backupCodeValue.length >= 8;
    const isDeviceCodeComplete = deviceVerificationCode.length === 6;

    // Computed values for cleaner JSX
    const isCredentialsFlow = loginState.flow === "credentials";
    const isTwoFactorFlow = loginState.flow === "twoFactor";
    const isDeviceVerificationFlow = loginState.flow === "deviceVerification";
    const isCombinedVerificationFlow = loginState.flow === "combinedVerification";

    const headerLabel = useMemo(() => {
        switch (loginState.flow) {
            case "twoFactor":
                return "Two-Factor Authentication";
            case "deviceVerification":
                return "Device Verification";
            case "combinedVerification":
                return "Two-Factor & Device Verification";
            default:
                return "Welcome to Intellisirn family. Please log in with your personal account information below.";
        }
    }, [loginState.flow]);

    const backButtonLabel = useMemo(() => {
        if (isTwoFactorFlow || isDeviceVerificationFlow || isCombinedVerificationFlow) {
            return "Back to Login";
        }
        return "Don't have an account?";
    }, [isTwoFactorFlow, isDeviceVerificationFlow, isCombinedVerificationFlow]);

    const submitButtonText = useMemo(() => {
        // Check both isPending and isSubmitting
        if (isPending || isSubmitting) {
            return (
                <span className="flex gap-2 items-center">
                    <ClipLoader
                        color="white"
                        size={15}
                        aria-label="Loading Spinner"
                        data-testid="loader"
                    />
                    {isCredentialsFlow ? "Signing in..." : "Verifying..."}
                </span>
            );
        }

        switch (loginState.flow) {
            case "twoFactor":
                return "Verify & Continue";
            case "deviceVerification":
                return "Verify Device";
            case "combinedVerification":
                return "Verify Both";
            default:
                return "Sign in";
        }
    }, [isPending, isSubmitting, loginState.flow, isCredentialsFlow]);

    // Determine if submit button should be disabled
    const isSubmitDisabled = useMemo(() => {
        // Disable if already submitting
        if (isPending || isSubmitting) return true;

        if (isTwoFactorFlow) {
            return !isMFACodeComplete;
        }

        if (isDeviceVerificationFlow) {
            return !isDeviceCodeComplete;
        }

        if (isCombinedVerificationFlow) {
            return !isMFACodeComplete || !isDeviceCodeComplete;
        }

        return false;
    }, [isPending, isSubmitting, isTwoFactorFlow, isDeviceVerificationFlow, isCombinedVerificationFlow, isMFACodeComplete, isDeviceCodeComplete]);

    return (
        <div className="relative w-full">
            <CardWrapper
                headerLabel={headerLabel}
                backButtonLabel={backButtonLabel}
                modalName={!isCredentialsFlow ? "LOGIN" : "REGISTER"}
                name={!isCredentialsFlow ? "Verification" : "Login"}
                showSocial={isCredentialsFlow}
            >
                <form
                    id="login-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="space-y-5 relative"
                >
                    {/* Hidden field for mfaDeviceId (challengeId) */}
                    <form.Field
                        name="mfaDeviceId"
                        children={(field) => (
                            <input type="hidden" name={field.name} value={field.state.value} />
                        )}
                    />

                    {/* Two-Factor Authentication Flow */}
                    {isTwoFactorFlow && (
                        <div className="space-y-4">
                            <OTPForm
                                codeValue={codeValue}
                                backupCodeValue={backupCodeValue}
                                onCodeChange={setCodeValue}
                                onBackupCodeChange={setBackupCodeValue}
                                email={loginState.email}
                                onBack={resetToCredentials}
                                onResend={handleResendCode}
                                disabled={isPending}
                                autoSubmit={false}
                                allowBackupCode={true}
                                backupCodeLength={8}
                                backupCodeType="alphanumeric"
                            />

                            <Button
                                type="submit"
                                variant="secondary"
                                disabled={isSubmitDisabled}
                                className="w-full"
                            >
                                {submitButtonText}
                            </Button>
                        </div>
                    )}

                    {/* Device Verification Flow */}
                    {isDeviceVerificationFlow && (
                        <div className="space-y-4">
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold">Device Verification Required</h3>
                                <p className="text-sm text-gray-600">
                                    We've sent a verification code to your email to verify this new device.
                                </p>
                                {loginState.deviceChallenge?.expiresAt && (
                                    <p className="text-xs text-gray-500">
                                        Code expires at {new Date(loginState.deviceChallenge.expiresAt).toLocaleTimeString()}
                                    </p>
                                )}
                            </div>

                            <form.Field
                                name="deviceVerificationCode"
                                children={(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                                    return (
                                        <Field data-invalid={isInvalid}>
                                            <FieldLabel htmlFor={field.name}>Device Verification Code</FieldLabel>
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                placeholder="Enter 6-digit code"
                                                disabled={isPending}
                                                value={deviceVerificationCode}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                    setDeviceVerificationCode(value);
                                                    field.handleChange(value);
                                                }}
                                                className="text-center text-lg tracking-widest"
                                                aria-invalid={isInvalid}
                                                autoFocus
                                            />
                                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                        </Field>
                                    )
                                }}
                            />

                            <div className="flex flex-col gap-3">
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    disabled={isSubmitDisabled}
                                    className="w-full"
                                >
                                    {submitButtonText}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={resetToCredentials}
                                    disabled={isPending}
                                >
                                    Back to Login
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleResendCode}
                                    disabled={isPending}
                                >
                                    Resend Device Code
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Combined Verification Flow */}
                    {isCombinedVerificationFlow && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold">Two-Factor & Device Verification</h3>
                                <p className="text-sm text-gray-600">
                                    For security, please enter both verification codes sent to your email.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <form.Field
                                    name="code"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Two-Factor Authentication Code</FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    placeholder="Enter 6-digit MFA code"
                                                    disabled={isPending}
                                                    value={codeValue}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                        setCodeValue(value);
                                                        field.handleChange(value);
                                                    }}
                                                    className="text-center text-lg tracking-widest"
                                                    aria-invalid={isInvalid}
                                                />
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        )
                                    }}
                                />

                                <form.Field
                                    name="deviceVerificationCode"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Device Verification Code</FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    placeholder="Enter 6-digit device code"
                                                    disabled={isPending}
                                                    value={deviceVerificationCode}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                        setDeviceVerificationCode(value);
                                                        field.handleChange(value);
                                                    }}
                                                    className="text-center text-lg tracking-widest"
                                                    aria-invalid={isInvalid}
                                                />
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        )
                                    }}
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    disabled={isSubmitDisabled}
                                    className="w-full"
                                >
                                    {submitButtonText}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={resetToCredentials}
                                    disabled={isPending}
                                >
                                    Back to Login
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleResendCode}
                                    disabled={isPending}
                                >
                                    Resend Both Codes
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Credentials Flow */}
                    {isCredentialsFlow && (
                        <>
                            <FieldGroup className="space-y-1">
                                <form.Field
                                    name="email"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                                                <div className="relative">
                                                    <Input
                                                        id={field.name}
                                                        name={field.name}
                                                        placeholder="john@example.com"
                                                        disabled={isPending}
                                                        value={field.state.value}
                                                        onBlur={field.handleBlur}
                                                        onChange={(e) => field.handleChange(e.target.value)}
                                                        className="pl-10 bg-transparent"
                                                        autoComplete="email"
                                                        type="email"
                                                        aria-invalid={isInvalid}
                                                        autoFocus
                                                    />
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                        <MdOutlineEmail />
                                                    </span>
                                                </div>
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        )
                                    }}
                                />

                                <form.Field
                                    name="password"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpen("RESET")}
                                                        className="text-sm text-blue-600 hover:underline"
                                                    >
                                                        Forgot password?
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <Input
                                                        id={field.name}
                                                        name={field.name}
                                                        placeholder="••••••••"
                                                        disabled={isPending}
                                                        value={field.state.value}
                                                        onBlur={field.handleBlur}
                                                        onChange={(e) => field.handleChange(e.target.value)}
                                                        type={loginState.showPassword ? "text" : "password"}
                                                        autoComplete="current-password"
                                                        className="pr-10 bg-transparent"
                                                        aria-invalid={isInvalid}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={togglePasswordVisibility}
                                                        disabled={isPending}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                                        aria-label={loginState.showPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {loginState.showPassword ? (
                                                            <LiaEyeSlashSolid size={18} />
                                                        ) : (
                                                            <LiaEyeSolid size={18} />
                                                        )}
                                                    </button>
                                                </div>
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        )
                                    }}
                                />

                                <form.Field
                                    name="rememberDevice"
                                    children={(field) => (
                                        <Field orientation="horizontal">
                                            <div className="relative flex gap-4">
                                                <Checkbox
                                                    checked={field.state.value}
                                                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                                                    id="remember-device"
                                                />
                                                <Label htmlFor="remember-device">Remember this device</Label>
                                            </div>
                                        </Field>
                                    )}
                                />
                            </FieldGroup>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                variant="secondary"
                                disabled={isPending}
                                className="w-full"
                                size="lg"
                            >
                                {submitButtonText}
                            </Button>
                        </>
                    )}
                </form>
            </CardWrapper>
        </div>
    );
}