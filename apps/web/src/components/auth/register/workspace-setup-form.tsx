"use client";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import {
    COMPANY_SIZE_OPTIONS,
    WorkspaceSetupSchema,
    WorkspaceSetupValues,
} from "@/lib/schemas";

interface WorkspaceSetupFormProps {
    userData: {
        firstName: string;
        lastName: string;
        email: string;
    };
    onSubmit: (values: WorkspaceSetupValues) => void;
    onBack: () => void;
    isLoading: boolean;
}

function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

export function WorkspaceSetupForm({ userData, onSubmit, onBack, isLoading }: WorkspaceSetupFormProps) {
    // Tracks whether the user has hand-edited the slug — once they have,
    // stop overwriting it when workspaceName changes.
    const slugManuallyEdited = useRef(false);

    const defaultValues: WorkspaceSetupValues = {
        workspaceName: `${userData.firstName}'s Storage`,
        workspaceSlug: slugify(`${userData.firstName}-storage`),
        isCompany: false,
        companySize: "",
        useCase: "",
        dataProcessingConsent: false,
    };

    const form = useForm({
        defaultValues,
        validators: {
            onSubmit: WorkspaceSetupSchema,
        },
        onSubmit: async ({ value }) => {
            onSubmit(value);
        },
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            className="space-y-4"
        >
            <div className="space-y-1">
                <h3 className="text-lg font-semibold">Set up your workspace</h3>
                <p className="text-sm text-muted-foreground">
                    This is where your buckets, keys, and usage will live. You can rename it later.
                </p>
            </div>

            <FieldGroup className="space-y-3">
                <form.Field
                    name="workspaceName"
                    children={(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                            <Field data-invalid={isInvalid}>
                                <FieldLabel htmlFor={field.name}>Workspace name</FieldLabel>
                                <Input
                                    id={field.name}
                                    name={field.name}
                                    disabled={isLoading}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => {
                                        field.handleChange(e.target.value);
                                        if (!slugManuallyEdited.current) {
                                            form.setFieldValue("workspaceSlug", slugify(e.target.value));
                                        }
                                    }}
                                    placeholder="Acme Inc, or Jane's Storage"
                                    aria-invalid={isInvalid}
                                />
                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                        );
                    }}
                />

                <form.Field
                    name="workspaceSlug"
                    children={(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                            <Field data-invalid={isInvalid}>
                                <FieldLabel htmlFor={field.name}>Workspace URL</FieldLabel>
                                <div className="flex items-center gap-1 text-sm">
                                    <span className="text-muted-foreground">tembo.dev/</span>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        disabled={isLoading}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            slugManuallyEdited.current = true;
                                            field.handleChange(slugify(e.target.value));
                                        }}
                                        className="flex-1"
                                        aria-invalid={isInvalid}
                                    />
                                </div>
                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                        );
                    }}
                />

                <form.Field
                    name="isCompany"
                    children={(field) => (
                        <Field orientation="horizontal">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is-company"
                                    checked={field.state.value}
                                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                                />
                                <FieldLabel htmlFor="is-company" className="font-normal cursor-pointer">
                                    This is for a company
                                </FieldLabel>
                            </div>
                        </Field>
                    )}
                />

                {/* Optional, skippable company fields — pure lead qualification, no gating */}
                <form.Subscribe
                    selector={(state) => state.values.isCompany}
                    children={(isCompany) =>
                        isCompany ? (
                            <div className="space-y-3 rounded-md border border-border/60 p-3">
                                <p className="text-xs text-muted-foreground">
                                    Optional — helps us tailor onboarding. Skip if you'd rather not say.
                                </p>

                                <form.Field
                                    name="companySize"
                                    children={(field) => (
                                        <Field>
                                            <FieldLabel htmlFor={field.name}>Company size</FieldLabel>
                                            <Select
                                                value={field.state.value}
                                                onValueChange={(value) => field.handleChange(value ?? "")}
                                            >
                                                <SelectTrigger id={field.name} className="w-full">
                                                    <SelectValue placeholder="Select a range (optional)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Team size</SelectLabel>
                                                        {COMPANY_SIZE_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                />

                                <form.Field
                                    name="useCase"
                                    children={(field) => (
                                        <Field>
                                            <FieldLabel htmlFor={field.name}>What will you store? (optional)</FieldLabel>
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                disabled={isLoading}
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                placeholder="e.g. backups, media, ML datasets"
                                            />
                                        </Field>
                                    )}
                                />
                            </div>
                        ) : null
                    }
                />

                <form.Field
                    name="dataProcessingConsent"
                    children={(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                            <Field data-invalid={isInvalid}>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="data-processing-consent"
                                        checked={field.state.value}
                                        onCheckedChange={(checked) => field.handleChange(!!checked)}
                                    />
                                    <FieldLabel htmlFor="data-processing-consent" className="font-normal cursor-pointer">
                                        I agree to the data processing terms for stored objects *
                                    </FieldLabel>
                                </div>
                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                        );
                    }}
                />
            </FieldGroup>

            <div className="flex flex-col gap-2">
                <form.Subscribe
                    selector={(state) => [state.canSubmit, state.isSubmitting]}
                    children={([canSubmit]) => (
                        <Button type="submit" variant="secondary" disabled={isLoading || !canSubmit} className="w-full">
                            {isLoading ? "Creating workspace..." : "Create workspace"}
                        </Button>
                    )}
                />
                <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
                    Back
                </Button>
            </div>
        </form>
    );
}