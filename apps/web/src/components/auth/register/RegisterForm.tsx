"use client";

import { register } from "@/actions/register";
import { getIpAndGeo } from "@/hooks/useAnalytics";
import { useModal } from "@/hooks/zustand/use-modal";
import { UserRegistrationInput, WorkspaceSetupValues } from "@/lib/schemas";
import { userClient } from "@/loginActions/user-actions";
import { getSignupMetadataAsync } from "@/utils/signupsource";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CardWrapper } from "../auth-global/CardWrapper";
import { UserRegistrationForm } from "./userRegistration";
import { WorkspaceSetupForm } from "./workspace-setup-form";

type RegistrationStep = "USER_INFO" | "WORKSPACE_INFO";

export default function RegistrationCoordinator() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<RegistrationStep>("USER_INFO");
  const [userFormData, setUserFormData] = useState<UserRegistrationInput | null>(null);
  const { onClose } = useModal();

  const [timezone, setTimezone] = useState<string>("Africa/Nairobi");
  const [metadata, setMetadata] = useState<any>({});

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    getSignupMetadataAsync().then((data) => {
      setMetadata(data);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Shared: build requestMetadata from backend + geo
  // ─────────────────────────────────────────────────────────────────────────
  async function buildRequestMetadata() {
    const metadataResponse = await userClient.getRequestMetadata();
    if (!metadataResponse.success || !metadataResponse.data) {
      throw new Error("Failed to retrieve metadata");
    }
    const meta = metadataResponse.data;
    const geo = await getIpAndGeo();

    return {
      meta,
      requestMetadata: {
        ipAddress: meta.network?.ipAddress || geo.ip,
        userAgent: meta.userAgent?.raw || navigator.userAgent,
        location: meta.network?.country || geo.country,
        city: meta.network?.city || geo.city,
        timezone: meta.timing?.timezone,
        deviceType: meta.userAgent?.device?.type,
        browser: meta.userAgent?.browser?.name,
        os: meta.userAgent?.os?.name,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared: handle success / error response from register()
  //
  // Note on verification: the account + workspace are created together in
  // one call. If the backend flags requiresVerification, we still redirect
  // to the dashboard-adjacent verify screen — but the workspace already
  // exists. Downstream, gate bucket creation / API key issuance / billing
  // behind a verified email rather than blocking signup itself.
  // ─────────────────────────────────────────────────────────────────────────
  function handleRegistrationResponse(
    data: Awaited<ReturnType<typeof register>>,
    email: string,
    successMessage: string
  ) {
    if (data.error) {
      toast.error(data.error);
      if (data.code === "RATE_LIMITED" && data.retryAfter) {
        const minutes = Math.ceil(data.retryAfter / 60);
        toast.error(
          `Too many attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`
        );
      }
      return false;
    }

    if (data.success) {
      toast.success(successMessage);

      if (data.requiresDeviceVerification && data.deviceChallenge) {
        sessionStorage.setItem(
          "pendingDeviceVerification",
          JSON.stringify({
            challengeId: data.deviceChallenge.challengeId,
            deviceId: data.deviceChallenge.deviceId,
            method: data.deviceChallenge.method,
          })
        );
      }

      if (data.requiresVerification) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        router.push("/dashboard");
      }
      onClose();
      return true;
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. USER FORM SUBMIT — always advances to workspace setup
  // ─────────────────────────────────────────────────────────────────────────
  function handleUserFormSubmit(values: UserRegistrationInput) {
    setUserFormData(values);
    setStep("WORKSPACE_INFO");
  }

  function handleBackToUserInfo() {
    setStep("USER_INFO");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. WORKSPACE SETUP SUBMIT — creates account + workspace together
  // ─────────────────────────────────────────────────────────────────────────
  async function handleWorkspaceSetup(workspaceData: WorkspaceSetupValues) {
    if (!userFormData) {
      toast.error("Your details are missing. Please start over.");
      setStep("USER_INFO");
      return;
    }

    startTransition(async () => {
      try {
        const { meta, requestMetadata } = await buildRequestMetadata();

        const combinedData = {
          ...userFormData,
          language: meta.headers?.acceptLanguage?.split(",")[0] || "en",
          timezone: meta.timing?.timezone || "Africa/Nairobi",
          signupSource: metadata.signupSource || "WEB",
          workspace: {
            name: workspaceData.workspaceName,
            slug: workspaceData.workspaceSlug,
            isCompany: workspaceData.isCompany,
            companySize: workspaceData.companySize || undefined,
            useCase: workspaceData.useCase || undefined,
          },
          dataProcessingConsent: workspaceData.dataProcessingConsent,
        };

        const data = await register(combinedData, requestMetadata);
        handleRegistrationResponse(data, userFormData.email, "Account created successfully!");
      } catch (error) {
        console.error("Registration error:", error);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="w-full">
      <CardWrapper
        headerLabel="Enter your information below to create your account"
        backButtonLabel="Already have an account?"
        modalName="LOGIN"
        name="Register"
        showSocial={step === "USER_INFO"}
      >
        <AnimatePresence mode="wait">
          {step === "USER_INFO" && (
            <motion.div
              key="user-info"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <UserRegistrationForm onSubmit={handleUserFormSubmit} isPending={isPending} />
            </motion.div>
          )}

          {step === "WORKSPACE_INFO" && userFormData && (
            <motion.div
              key="workspace-info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <WorkspaceSetupForm
                userData={{
                  firstName: userFormData.firstName,
                  lastName: userFormData.lastName,
                  email: userFormData.email,
                }}
                onSubmit={handleWorkspaceSetup}
                onBack={handleBackToUserInfo}
                isLoading={isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardWrapper>
    </div>
  );
}