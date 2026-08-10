"use client"

import { newVerification } from "@/actions/new-verification";
import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCcw, ArrowLeft, Loader2 } from "lucide-react";

type VerificationStatus = "idle" | "verifying" | "success" | "error";

interface VerificationState {
  status: VerificationStatus;
  message?: string;
  canRetry: boolean;
}

export const NewVerificationForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  // Use ref to prevent double execution in React StrictMode
  const verificationAttempted = useRef(false);
  const redirectTimeout = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<VerificationState>({
    status: "idle",
    canRetry: true,
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current);
      }
    };
  }, []);

  // Handle verification
  const handleVerification = useCallback(async () => {
    // Prevent multiple simultaneous verifications
    if (state.status === "verifying") {
      return;
    }

    if (!token) {
      setState({
        status: "error",
        message: "Missing verification token. Please check your email link.",
        canRetry: false,
      });
      toast.error("Missing verification token", {
        description: "Please check your email for the correct verification link.",
      });
      return;
    }

    setState({
      status: "verifying",
      message: undefined,
      canRetry: false,
    });

    try {
      const data = await newVerification(token);

      if (data?.success) {
        setState({
          status: "success",
          message: data.success,
          canRetry: false,
        });

        toast.success("Email verified successfully!", {
          description: "Redirecting you to login...",
          duration: 3000,
        });

        // Redirect after 2 seconds
        redirectTimeout.current = setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
        return;
      }

      if (data?.error) {
        setState({
          status: "error",
          message: data.error,
          canRetry: true,
        });

        toast.error("Verification failed", {
          description: data.error,
        });
        return;
      }

      // Unexpected response
      throw new Error("Unexpected response from server");
    } catch (error) {
      console.error("Verification error:", error);

      const errorMessage = error instanceof Error
        ? error.message
        : "An unexpected error occurred";

      setState({
        status: "error",
        message: errorMessage,
        canRetry: true,
      });

      toast.error("Verification failed", {
        description: errorMessage,
      });
    }
  }, [token, state.status, router]);

  // Auto-verify on mount (only once)
  useEffect(() => {
    if (token && !verificationAttempted.current) {
      verificationAttempted.current = true;
      handleVerification();
    }
  }, [token, handleVerification]);

  // Navigate back to login
  const goToLogin = useCallback(() => {
    if (redirectTimeout.current) {
      clearTimeout(redirectTimeout.current);
    }
    router.push("/auth/login");
  }, [router]);

  // Render status icon
  const renderStatusIcon = () => {
    switch (state.status) {
      case "verifying":
        return (
          <div className="relative">
            <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />
          </div>
        );
      case "success":
        return (
          <div className="relative animate-bounce-in">
            <CheckCircle2 className="w-20 h-20 text-green-600" />
          </div>
        );
      case "error":
        return (
          <div className="relative animate-shake">
            <XCircle className="w-20 h-20 text-red-600" />
          </div>
        );
      default:
        return (
          <Image
            src="/Confirmed-attendance-pana.svg"
            alt="Email verification illustration"
            width={200}
            height={200}
            className="pointer-events-none"
            priority
          />
        );
    }
  };

  // Render status message
  const renderStatusMessage = () => {
    switch (state.status) {
      case "verifying":
        return (
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">
              Verifying Your Email
            </h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your email address...
            </p>
          </div>
        );
      case "success":
        return (
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-green-600">
              Email Verified!
            </h1>
            <p className="text-muted-foreground">
              {state.message || "Your email has been successfully verified."}
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to login in 2 seconds...
            </p>
          </div>
        );
      case "error":
        return (
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-red-600">
              Verification Failed
            </h1>
            <p className="text-muted-foreground">
              {state.message || "We couldn't verify your email address."}
            </p>
          </div>
        );
      default:
        return (
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">
              Email Verification
            </h1>
            <p className="text-muted-foreground">
              Preparing to verify your email...
            </p>
          </div>
        );
    }
  };

  // Render action buttons
  const renderActions = () => {
    const isVerifying = state.status === "verifying";

    if (isVerifying) {
      return null;
    }

    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full mt-6 justify-center items-center">
        {/* Retry button (only show on error) */}
        {state.status === "error" && state.canRetry && (
          <Button
            onClick={handleVerification}
            variant="default"
            className="w-full sm:w-auto flex items-center gap-2 text-white"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </Button>
        )}

        {/* Back to login button */}
        <Button
          onClick={goToLogin}
          variant={state.status === "success" ? "default" : "outline"}
          className="w-full sm:w-auto flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {state.status === "success" ? "Go to Login" : "Back to Login"}
        </Button>
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <span className="w-[50rem] h-[30rem] block bg-white/10 dark:bg-white/5 rounded-full blur-[10rem] absolute top-1/4 left-1/4 animate-pulse-slow"></span>
        <span className="w-[90rem] h-[30rem] block bg-blue-600/20 dark:bg-blue-600/10 rounded-full blur-[10rem] absolute top-0 left-0 animate-pulse-slow" style={{ animationDelay: "1s" }}></span>
      </div>

      {/* Main content card */}
      <div className="w-full max-w-md border rounded-xl flex flex-col justify-center items-center p-8 relative bg-background/80 backdrop-blur-sm z-10 shadow-xl">
        {/* Status Icon */}
        <div className="mb-6">
          {renderStatusIcon()}
        </div>

        {/* Status Message */}
        <div className="w-full flex flex-col items-center mb-4">
          {renderStatusMessage()}
        </div>

        {/* Progress bar for verifying state */}
        {state.status === "verifying" && (
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden mb-6">
            <div className="bg-blue-600 h-full rounded-full animate-progress"></div>
          </div>
        )}

        {/* Action Buttons */}
        {renderActions()}

        {/* Help text */}
        {state.status === "error" && (
          <div className="mt-6 p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              Need help? Contact support or try requesting a new verification email.
            </p>
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-10px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(10px);
          }
        }

        @keyframes progress {
          0% {
            width: 0%;
          }
          50% {
            width: 60%;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .animate-shake {
          animation: shake 0.5s;
        }

        .animate-progress {
          animation: progress 2s ease-in-out;
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};