"use client"

import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
    UserForm,
    type EditUserFormInput,
    type EditUserFormValues,
} from "../../new-user/tables/forms/userForm"
import { UserData } from "@/loginActions/user-actions"

interface EditUserFormProps {
    user: UserData
    onUpdate: (data: EditUserFormValues) => Promise<void>
    isUpdating: boolean
}

// ─── Safe enum casters ────────────────────────────────────────────────────────
// UserData uses loose `string` types; the form schema needs strict enums.
// These cast with a fallback so we never pass an invalid value.

const ROLES = ['SUPER_ADMIN','ADMIN','MANAGER','STAFF','DELIVERY','SUPPLIER','CUSTOMER','SUPPORT','VIEWER'] as const
type UserRole = typeof ROLES[number]

const SOURCES = ['WEB','MOBILE_WEB','IOS','ANDROID','REFERRAL','PARTNER','SOCIAL'] as const
type SignupSource = typeof SOURCES[number]

const VERIFICATIONS = ['BASIC','INTERMEDIATE','ADVANCED','VERIFIED'] as const
type VerificationLevel = typeof VERIFICATIONS[number]

const TFA_METHODS = ['APP','SMS','EMAIL'] as const
type TwoFactorMethod = typeof TFA_METHODS[number]

function isOneOf<T extends readonly string[]>(
  arr: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && arr.includes(value as T[number])
}


function asRole(v?: string): UserRole {
    return isOneOf(ROLES, v) ? v : 'CUSTOMER';
}

function asSource(v?: string): SignupSource {
    return isOneOf(SOURCES, v) ? v : 'WEB';
}

function asVerification(v?: string): VerificationLevel {
    return isOneOf(VERIFICATIONS, v) ? v : 'BASIC';
}

function asTfaMethod(v?: string): TwoFactorMethod {
    return isOneOf(TFA_METHODS, v) ? v : 'APP';
}
// ─── Mapper ───────────────────────────────────────────────────────────────────

function toFormValues(user: UserData): EditUserFormInput {
    return {
        name: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",

        role: asRole(user.role),
        signupSource: asSource(user.signupSource),
        verificationLevel: asVerification(user.verificationLevel),
        twoFactorMethod: asTfaMethod(user.twoFactorMethod),
        isActive: user.isActive ?? true,
        isVerified: user.isVerified ?? false,
        isTwoFactorEnabled: user.isTwoFactorEnabled ?? false,
        isSuspended: user.isSuspended ?? false,

        language: user.language ?? "en",
        timezone: user.timezone ?? "Africa/Nairobi",
        currency: user.currency ?? "KES",
        dateFormat: user.dateFormat ?? "DD/MM/YYYY",

        referrerId: user.referrerId ?? "",

        termsAccepted: user.termsAccepted ?? !!user.termsAcceptedAt,
        privacyAccepted: user.privacyAccepted ?? !!user.privacyAcceptedAt,
        dataProcessingConsent: user.dataProcessingConsent ?? true,
        marketingOptIn: user.marketingOptIn ?? false,

        password: "",
        confirmPassword: "",

        profile: {
            firstName: user.profile?.firstName ?? "",
            lastName: user.profile?.lastName ?? "",
            middleName: user.profile?.middleName ?? "",
            displayName: user.profile?.displayName ?? "",
            dateOfBirth: user.profile?.dateOfBirth
                ? new Date(user.profile.dateOfBirth).toISOString().split("T")[0]
                : "",
            gender: user.profile?.gender ?? "",
            bio: user.profile?.bio ?? "",
            secondaryEmail: user.profile?.secondaryEmail ?? "",
            secondaryPhone: user.profile?.secondaryPhone ?? "",
            addressLine1: user.profile?.addressLine1 ?? "",
            addressLine2: user.profile?.addressLine2 ?? "",
            city: user.profile?.city ?? "",
            county: user.profile?.county ?? "",
            postalCode: user.profile?.postalCode ?? "",
            country: user.profile?.country ?? "KE",
            idDocumentType: user.profile?.idDocumentType ?? "",
            idDocumentNumber: user.profile?.idDocumentNumber ?? "",
            idDocumentExpiry: user.profile?.idDocumentExpiry
                ? new Date(user.profile.idDocumentExpiry).toISOString().split("T")[0]
                : "",
            occupation: user.profile?.occupation ?? "",
            company: user.profile?.company ?? "",
            jobTitle: user.profile?.jobTitle ?? "",
            yearsOfExperience: user.profile?.yearsOfExperience ?? "",
        },
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditUserForm({ user, onUpdate, isUpdating }: EditUserFormProps) {
    const router = useRouter()

    const handleSubmit = async (data: EditUserFormValues) => {
        await onUpdate(data)
        toast.success("User updated successfully", {
            description: `${data.name}'s profile has been saved.`,
        })
    }

    return (
        <UserForm
            mode="edit"
            defaultValues={toFormValues(user)}
            onSubmit={handleSubmit}
            isSubmitting={isUpdating}
            onCancel={() => router.back()}
        />
    )
}