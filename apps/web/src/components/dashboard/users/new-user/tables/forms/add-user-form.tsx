"use client"

import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { UserForm, defaultAddValues, type AddUserFormValues } from "./userForm"
import { useCreateUserForAdmin } from "@/hooks/user/useUser"

// Helper to clean undefined values
const cleanUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    ) as Partial<T>
}

export function AddUserForm() {
    const createUserMutation = useCreateUserForAdmin()
    const router = useRouter()

    const handleSubmit = async (data: AddUserFormValues) => {
        try {
            await createUserMutation.mutateAsync({
                name: data.name,
                email: data.email,
                phone: data.phone,
                password: data.password,
                role: data.role,
                signupSource: data.signupSource,
                verificationLevel: data.verificationLevel,
                twoFactorMethod: data.twoFactorMethod,
                isActive: data.isActive,
                isVerified: data.isVerified,
                isTwoFactorEnabled: data.isTwoFactorEnabled,
                isSuspended: data.isSuspended,
                language: data.language,
                timezone: data.timezone,
                currency: data.currency,
                dateFormat: data.dateFormat,
                termsAccepted: data.termsAccepted,
                privacyAccepted: data.privacyAccepted,
                dataProcessingConsent: data.dataProcessingConsent,
                marketingOptIn: data.marketingOptIn,
                referrerId: data.referrerId || undefined,
                profile: {
                    // required fields
                    firstName: data.profile.firstName,
                    lastName: data.profile.lastName,
                    country: data.profile.country && data.profile.country !== ""
                        ? data.profile.country
                        : "KE",

                    // optional fields
                    ...cleanUndefined({
                        middleName: data.profile.middleName,
                        displayName: data.profile.displayName,
                        dateOfBirth: data.profile.dateOfBirth
                            ? new Date(data.profile.dateOfBirth).toISOString()
                            : undefined,
                        gender: data.profile.gender,
                        bio: data.profile.bio,
                        secondaryEmail: data.profile.secondaryEmail,
                        secondaryPhone: data.profile.secondaryPhone,
                        addressLine1: data.profile.addressLine1,
                        addressLine2: data.profile.addressLine2,
                        city: data.profile.city,
                        county: data.profile.county,
                        postalCode: data.profile.postalCode,
                        idDocumentType: data.profile.idDocumentType,
                        idDocumentNumber: data.profile.idDocumentNumber,
                        idDocumentExpiry: data.profile.idDocumentExpiry
                            ? new Date(data.profile.idDocumentExpiry).toISOString()
                            : undefined,
                        occupation: data.profile.occupation,
                        company: data.profile.company,
                        jobTitle: data.profile.jobTitle,
                        yearsOfExperience: typeof data.profile.yearsOfExperience === "number"
                            ? data.profile.yearsOfExperience
                            : undefined,
                    })
                }
            })

            toast.success("User created successfully", {
                description: `${data.name} has been added as a ${data.role.replace(/_/g, " ")}.`,
            })

            router.push("/users")
        } catch (error) {
            console.error("Failed to create user:", error)
        }
    }

    return (
        <UserForm
            mode="add"
            defaultValues={defaultAddValues}
            onSubmit={handleSubmit}
            isSubmitting={createUserMutation.isPending}
            onCancel={() => router.back()}
        />
    )
}