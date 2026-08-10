"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Mail, Phone, Shield, User, UserCog, Building2, KeyRound, CreditCard } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { UserRole, SignupSource, VerificationLevel, TwoFactorMethod } from "@/loginActions/user-actions"
import { Button } from "@workspace/ui/components/button"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@workspace/ui/components/card"
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { useHasRole } from "@/hooks/zustand/stores/use-auth-store"

// ─── Static options ───────────────────────────────────────────────────────────

const SIGNUP_SOURCES: { value: SignupSource; label: string }[] = [
    { value: "WEB", label: "Web" },
    { value: "MOBILE_WEB", label: "Mobile Web" },
    { value: "IOS", label: "iOS" },
    { value: "ANDROID", label: "Android" },
    { value: "REFERRAL", label: "Referral" },
    { value: "PARTNER", label: "Partner" },
    { value: "SOCIAL", label: "Social" },
]

const VERIFICATION_LEVELS: { value: VerificationLevel; label: string }[] = [
    { value: "BASIC", label: "Basic" },
    { value: "INTERMEDIATE", label: "Intermediate" },
    { value: "ADVANCED", label: "Advanced" },
    { value: "VERIFIED", label: "Verified" },
]

const TWO_FACTOR_METHODS: { value: TwoFactorMethod; label: string }[] = [
    { value: "APP", label: "Authenticator App" },
    { value: "SMS", label: "SMS" },
    { value: "EMAIL", label: "Email" },
]

const GENDERS = [
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "NON_BINARY", label: "Non-Binary" },
    { value: "PREFER_NOT_TO_SAY", label: "Prefer Not to Say" },
    { value: "OTHER", label: "Other" },
]

const LANGUAGES = [
    { value: "en", label: "English" },
    { value: "fr", label: "French" },
    { value: "sw", label: "Swahili" },
]

const TIMEZONES = [
    { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
    { value: "Africa/Lagos", label: "Lagos (WAT)" },
    { value: "Europe/London", label: "London (GMT)" },
    { value: "America/New_York", label: "New York (EST)" },
]

const CURRENCIES = [
    { value: "KES", label: "KES — Kenyan Shilling" },
    { value: "USD", label: "USD — US Dollar" },
    { value: "EUR", label: "EUR — Euro" },
    { value: "GBP", label: "GBP — British Pound" },
]

const DATE_FORMATS = [
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
]

const ID_DOCUMENT_TYPES = [
    { value: "NATIONAL_ID", label: "National ID" },
    { value: "PASSPORT", label: "Passport" },
    { value: "DRIVING_LICENSE", label: "Driving License" },
    { value: "ALIEN_ID", label: "Alien ID" },
]

// ─── Role constants ───────────────────────────────────────────────────────────

const ROLES_VALUES = [
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF',
    'DELIVERY', 'SUPPLIER', 'CUSTOMER', 'SUPPORT', 'VIEWER',
] as const

const PROFESSIONAL_ROLES = [
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF',
    'DELIVERY', 'SUPPLIER', 'SUPPORT',
] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const SIGNUP_SOURCES_VALUES = ["WEB", "MOBILE_WEB", "IOS", "ANDROID", "REFERRAL", "PARTNER", "SOCIAL"] as const
const VERIFICATION_VALUES = ["BASIC", "INTERMEDIATE", "ADVANCED", "VERIFIED"] as const
const TWO_FACTOR_VALUES = ["APP", "SMS", "EMAIL"] as const
const GENDER_VALUES = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY", "OTHER"] as const
const ID_DOCUMENT_TYPE_VALUES = ["NATIONAL_ID", "PASSPORT", "DRIVING_LICENSE", "ALIEN_ID"] as const

// Base schema (fields shared between add and edit)
const baseSchema = z.object({
    // ── Core identity ─────────────────────────────────────────────────────────
    name: z.string().min(1, "Display name is required").max(100),

    email: z.string()
        .min(1, "Email is required")
        .email("Invalid email address")
        .max(100),

    phone: z.string()
        .min(1, "Phone number is required")
        .regex(/^[+]?[\d\s\-()]+$/, "Invalid phone number format")
        .max(20),

    // ── Role & access ─────────────────────────────────────────────────────────
    role: z.enum(ROLES_VALUES),
    signupSource: z.enum(SIGNUP_SOURCES_VALUES),
    verificationLevel: z.enum(VERIFICATION_VALUES),
    twoFactorMethod: z.enum(TWO_FACTOR_VALUES),

    // ── Account flags ─────────────────────────────────────────────────────────
    isActive: z.boolean().default(true),
    isVerified: z.boolean().default(false),
    isTwoFactorEnabled: z.boolean().default(false),
    isSuspended: z.boolean().default(false),

    // ── Localisation ─────────────────────────────────────────────────────────
    language: z.string().min(1, "Language is required"),
    timezone: z.string().min(1, "Timezone is required"),
    currency: z.string().min(1, "Currency is required"),
    dateFormat: z.string().min(1, "Date format is required"),

    // ── Consent ───────────────────────────────────────────────────────────────
    termsAccepted: z.boolean(),
    privacyAccepted: z.boolean(),
    dataProcessingConsent: z.boolean(),
    marketingOptIn: z.boolean().default(false),

    // ── Optional refs ─────────────────────────────────────────────────────────
    referrerId: z.string().optional().or(z.literal("")),

    // ── Profile ───────────────────────────────────────────────────────────────
    profile: z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        middleName: z.string().max(100).optional().or(z.literal("")),
        displayName: z.string().max(100).optional().or(z.literal("")),
        dateOfBirth: z.string().optional().or(z.literal("")),
        gender: z.enum(GENDER_VALUES).optional().or(z.literal("")),
        bio: z.string().max(500).optional().or(z.literal("")),
        secondaryEmail: z.string().email("Invalid email").optional().or(z.literal("")),
        secondaryPhone: z.string().max(20).optional().or(z.literal("")),
        addressLine1: z.string().max(200).optional().or(z.literal("")),
        addressLine2: z.string().max(200).optional().or(z.literal("")),
        city: z.string().max(100).optional().or(z.literal("")),
        county: z.string().max(100).optional().or(z.literal("")),
        postalCode: z.string().max(20).optional().or(z.literal("")),
        country: z.string().max(2).default("KE"),
        idDocumentType: z.enum(ID_DOCUMENT_TYPE_VALUES).optional().or(z.literal("")),
        idDocumentNumber: z.string().max(50).optional().or(z.literal("")),
        idDocumentExpiry: z.string().optional().or(z.literal("")),
        occupation: z.string().max(100).optional().or(z.literal("")),
        company: z.string().max(100).optional().or(z.literal("")),
        jobTitle: z.string().max(100).optional().or(z.literal("")),
        yearsOfExperience: z.coerce.number().int().min(0).max(60).optional().or(z.literal("")),
    }),
})

// Add schema — password required, consent required
export const addUserFormSchema = baseSchema
    .extend({
        password: z.string()
            .min(8, "Password must be at least 8 characters")
            .max(72)
            .regex(/[A-Z]/, "Must contain at least one uppercase letter")
            .regex(/[a-z]/, "Must contain at least one lowercase letter")
            .regex(/[0-9]/, "Must contain at least one number"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
        termsAccepted: z.boolean().refine(v => v, { message: "Terms must be acknowledged" }),
        privacyAccepted: z.boolean().refine(v => v, { message: "Privacy policy must be acknowledged" }),
        dataProcessingConsent: z.boolean().refine(v => v, { message: "Data processing consent is required" }),
    })
    .refine(d => d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })
    .refine(d => {
        if ((PROFESSIONAL_ROLES as readonly string[]).includes(d.role)) {
            return !!d.profile.idDocumentNumber?.trim()
        }
        return true
    }, {
        message: "ID document number is required for this role",
        path: ["profile", "idDocumentNumber"],
    })
    .refine(d => {
        if (d.role === "DELIVERY") return !!d.profile.addressLine1?.trim()
        return true
    }, {
        message: "Address is required for delivery personnel",
        path: ["profile", "addressLine1"],
    })

// Edit schema — password optional, consent optional (already accepted)
export const editUserFormSchema = baseSchema
    .extend({
        password: z.string()
            .min(8, "Password must be at least 8 characters")
            .max(72)
            .regex(/[A-Z]/, "Must contain at least one uppercase letter")
            .regex(/[a-z]/, "Must contain at least one lowercase letter")
            .regex(/[0-9]/, "Must contain at least one number")
            .optional()
            .or(z.literal("")),
        confirmPassword: z.string().optional().or(z.literal("")),
        // Consent fields are informational-only in edit mode — no refine needed
        termsAccepted: z.boolean(),
        privacyAccepted: z.boolean(),
        dataProcessingConsent: z.boolean(),
    })
    .refine(d => !d.password || d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })
    .refine(d => {
        if ((PROFESSIONAL_ROLES as readonly string[]).includes(d.role)) {
            return !!d.profile.idDocumentNumber?.trim()
        }
        return true
    }, {
        message: "ID document number is required for this role",
        path: ["profile", "idDocumentNumber"],
    })
    .refine(d => {
        if (d.role === "DELIVERY") return !!d.profile.addressLine1?.trim()
        return true
    }, {
        message: "Address is required for delivery personnel",
        path: ["profile", "addressLine1"],
    })

export type AddUserFormInput = z.input<typeof addUserFormSchema>
export type AddUserFormValues = z.output<typeof addUserFormSchema>
export type EditUserFormInput = z.input<typeof editUserFormSchema>
export type EditUserFormValues = z.output<typeof editUserFormSchema>

// Union type used inside the shared component
type AnyFormInput = AddUserFormInput | EditUserFormInput
type AnyFormValues = AddUserFormValues | EditUserFormValues

// ─── Default values ───────────────────────────────────────────────────────────

export const defaultAddValues: AddUserFormInput = {
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "CUSTOMER",
    signupSource: "WEB",
    verificationLevel: "BASIC",
    twoFactorMethod: "APP",
    isActive: true,
    isVerified: false,
    isTwoFactorEnabled: false,
    isSuspended: false,
    language: "en",
    timezone: "Africa/Nairobi",
    currency: "KES",
    dateFormat: "DD/MM/YYYY",
    termsAccepted: false,
    privacyAccepted: false,
    dataProcessingConsent: false,
    marketingOptIn: false,
    referrerId: "",
    profile: {
        firstName: "",
        lastName: "",
        middleName: "",
        displayName: "",
        dateOfBirth: "",
        gender: "",
        bio: "",
        secondaryEmail: "",
        secondaryPhone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postalCode: "",
        country: "KE",
        idDocumentType: "",
        idDocumentNumber: "",
        idDocumentExpiry: "",
        occupation: "",
        company: "",
        jobTitle: "",
        yearsOfExperience: "",
    },
}

// ─── Props ────────────────────────────────────────────────────────────────────

type UserFormProps =
    | {
        mode: "add"
        defaultValues?: AddUserFormInput
        onSubmit: (data: AddUserFormValues) => Promise<void>
        isSubmitting: boolean
        onCancel: () => void
    }
    | {
        mode: "edit"
        defaultValues?: EditUserFormInput
        onSubmit: (data: EditUserFormValues) => Promise<void>
        isSubmitting: boolean
        onCancel: () => void
    }

// ─── Shared Component ─────────────────────────────────────────────────────────

export function UserForm({ mode, defaultValues, onSubmit, isSubmitting, onCancel }: UserFormProps) {
    const isSuperAdmin = useHasRole("SUPER_ADMIN")
    const isEditMode = mode === "edit"

    const schema = isEditMode ? editUserFormSchema : addUserFormSchema

    const ROLES: { value: UserRole; label: string }[] = [
        ...(isSuperAdmin ? [{ value: 'SUPER_ADMIN' as UserRole, label: 'Super Admin' }] : []),
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MANAGER', label: 'Manager' },
        { value: 'STAFF', label: 'Staff' },
        { value: 'DELIVERY', label: 'Delivery' },
        { value: 'SUPPLIER', label: 'Supplier' },
        { value: 'CUSTOMER', label: 'Customer' },
        { value: 'SUPPORT', label: 'Support' },
        { value: 'VIEWER', label: 'Viewer' },
    ]

    const form = useForm<AnyFormInput, any, AnyFormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues ?? defaultAddValues,
    })

    const watchedRole = form.watch("role")
    const isProfessionalRole = (PROFESSIONAL_ROLES as readonly string[]).includes(watchedRole)
    const isDeliveryRole = watchedRole === "DELIVERY"

    const handleSubmit = async (data: AnyFormValues) => {
        if (mode === "add") {
            await onSubmit(data as AddUserFormValues)
        } else {
            await onSubmit(data as EditUserFormValues)
        }

        if (!isEditMode) form.reset(defaultAddValues)
    }

    return (
        <div className="max-w-4xl mx-auto py-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

                    {/* ── Basic Information ──────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Basic Information
                            </CardTitle>
                            <CardDescription>The user's core identity details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="profile.firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                                            <FormControl><Input placeholder="Jane" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.middleName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Middle Name <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="Marie" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.lastName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                                            <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Display Name <span className="text-destructive">*</span></FormLabel>
                                            <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                                            <FormDescription>Shown publicly across the platform.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.displayName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Profile Display Name <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="JaneDoe92" {...field} /></FormControl>
                                            <FormDescription>Overrides display name on the profile page.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="profile.dateOfBirth"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date of Birth <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input type="date" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.gender"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Gender <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {GENDERS.map(g => (
                                                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="profile.bio"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bio <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                        <FormControl><Input placeholder="A short bio..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* ── Contact Details ────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Contact Details
                            </CardTitle>
                            <CardDescription>Primary and secondary contact information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                                            <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Phone className="h-4 w-4" />
                                                Phone Number <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl><Input placeholder="+254 712 345 678" {...field} /></FormControl>
                                            <FormDescription>Include country code.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.secondaryEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Secondary Email <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input type="email" placeholder="backup@example.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.secondaryPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Secondary Phone <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="+254 722 000 000" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Address ────────────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Address</CardTitle>
                            <CardDescription>
                                Primary address for this user's profile.
                                {isDeliveryRole && (
                                    <span className="text-destructive ml-1 font-medium">
                                        Address Line 1 is required for Delivery role.
                                    </span>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="profile.addressLine1"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Address Line 1{" "}
                                                {isDeliveryRole
                                                    ? <span className="text-destructive">*</span>
                                                    : <span className="text-muted-foreground font-normal">(Optional)</span>
                                                }
                                            </FormLabel>
                                            <FormControl><Input placeholder="123 Moi Avenue" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.addressLine2"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address Line 2 <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="Apt 4B" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="Nairobi" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.county"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>County <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="Nairobi County" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.postalCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Postal Code <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="00100" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country</FormLabel>
                                            <FormControl><Input placeholder="KE" maxLength={2} {...field} /></FormControl>
                                            <FormDescription>ISO 2-letter country code.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Password ───────────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5" />
                                Password
                            </CardTitle>
                            <CardDescription>
                                {isEditMode
                                    ? "Leave blank to keep the current password."
                                    : "A temporary password — the user should change this on first login."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Password{" "}
                                                {isEditMode
                                                    ? <span className="text-muted-foreground font-normal">(Optional)</span>
                                                    : <span className="text-destructive">*</span>
                                                }
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder={isEditMode ? "Leave blank to keep current" : "Min. 8 characters"}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>Uppercase, lowercase, and a number required.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Confirm Password{" "}
                                                {isEditMode
                                                    ? <span className="text-muted-foreground font-normal">(Optional)</span>
                                                    : <span className="text-destructive">*</span>
                                                }
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder="Re-enter password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Role & Access ──────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserCog className="h-5 w-5" />
                                Role & Access
                            </CardTitle>
                            <CardDescription>
                                Assign the user's role, signup source, and verification level.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {ROLES.map(r => (
                                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="signupSource"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Signup Source</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {SIGNUP_SOURCES.map(s => (
                                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="verificationLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Verification Level</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {VERIFICATION_LEVELS.map(v => (
                                                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="referrerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Referrer ID <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                        <FormControl><Input placeholder="e.g., clxyz123..." {...field} /></FormControl>
                                        <FormDescription>The ID of the user who referred this account.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* ── Identity Document ──────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Identity Document
                            </CardTitle>
                            <CardDescription>
                                {isProfessionalRole
                                    ? "ID document is required for this role."
                                    : "Optional for customer and viewer accounts."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="profile.idDocumentType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Document Type{" "}
                                                {isProfessionalRole
                                                    ? <span className="text-destructive">*</span>
                                                    : <span className="text-muted-foreground font-normal">(Optional)</span>
                                                }
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {ID_DOCUMENT_TYPES.map(t => (
                                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.idDocumentNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Document Number{" "}
                                                {isProfessionalRole
                                                    ? <span className="text-destructive">*</span>
                                                    : <span className="text-muted-foreground font-normal">(Optional)</span>
                                                }
                                            </FormLabel>
                                            <FormControl><Input placeholder="e.g., 12345678" {...field} /></FormControl>
                                            <FormDescription>National ID, passport, or driving licence number.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.idDocumentExpiry"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Document Expiry <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input type="date" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Professional Details ───────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Professional Details
                            </CardTitle>
                            <CardDescription>Occupation and company information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="profile.occupation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Occupation <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="e.g., Driver" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.jobTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Job Title <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="e.g., Senior Butcher" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.company"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input placeholder="e.g., Kuku Shop" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profile.yearsOfExperience"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Years of Experience <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                            <FormControl><Input type="number" min={0} max={60} placeholder="e.g., 5" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Security & 2FA ─────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Security & 2FA
                            </CardTitle>
                            <CardDescription>Two-factor authentication settings for this account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="isTwoFactorEnabled"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Enable Two-Factor Authentication</FormLabel>
                                            <FormDescription>Require a second verification step on login.</FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {form.watch("isTwoFactorEnabled") && (
                                <FormField
                                    control={form.control}
                                    name="twoFactorMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>2FA Method</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {TWO_FACTOR_METHODS.map(m => (
                                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Localisation ───────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Localisation</CardTitle>
                            <CardDescription>Language, timezone, currency, and date format preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(
                                    [
                                        { name: "language" as const, label: "Language", options: LANGUAGES, placeholder: "Select language" },
                                        { name: "timezone" as const, label: "Timezone", options: TIMEZONES, placeholder: "Select timezone" },
                                        { name: "currency" as const, label: "Currency", options: CURRENCIES, placeholder: "Select currency" },
                                        { name: "dateFormat" as const, label: "Date Format", options: DATE_FORMATS, placeholder: "Select format" },
                                    ] as const
                                ).map(({ name, label, options, placeholder }) => (
                                    <FormField
                                        key={name}
                                        control={form.control}
                                        name={name}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{label}</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {options.map((o: { value: string; label: string }) => (
                                                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Account Settings ───────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Settings</CardTitle>
                            <CardDescription>Set the initial state of this user's account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(
                                [
                                    { name: "isActive" as const, label: "Active Account", description: "User can log in and access the platform." },
                                    { name: "isVerified" as const, label: "Mark as Verified", description: "Skip email verification for this account." },
                                    { name: "isSuspended" as const, label: "Suspended", description: "Temporarily block this user from accessing the platform." },
                                    { name: "marketingOptIn" as const, label: "Marketing Opt-In", description: "User consents to receive marketing communications." },
                                ] as const
                            ).map(({ name, label, description }) => (
                                <FormField
                                    key={name}
                                    control={form.control}
                                    name={name}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">{label}</FormLabel>
                                                <FormDescription>{description}</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </CardContent>
                    </Card>

                    {/* ── Consent & Legal — hidden in edit mode ──────────────── */}
                    {!isEditMode && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Consent & Legal</CardTitle>
                                <CardDescription>Confirm these have been acknowledged before creating the account.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(
                                    [
                                        { name: "termsAccepted" as const, label: "Terms of Service", description: "Confirm the user has accepted the terms of service." },
                                        { name: "privacyAccepted" as const, label: "Privacy Policy", description: "Confirm the user has accepted the privacy policy." },
                                        { name: "dataProcessingConsent" as const, label: "Data Processing Consent", description: "Confirm consent to process this user's personal data." },
                                    ] as const
                                ).map(({ name, label, description }) => (
                                    <FormField
                                        key={name}
                                        control={form.control}
                                        name={name}
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">{label}</FormLabel>
                                                    <FormDescription>{description}</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Actions ────────────────────────────────────────────── */}
                    <div className="flex gap-4 justify-end">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isEditMode ? "Saving..." : "Creating..."}
                                </>
                            ) : (
                                isEditMode ? "Save Changes" : "Create User"
                            )}
                        </Button>
                    </div>

                </form>
            </Form>
        </div>
    )
}