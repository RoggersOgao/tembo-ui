"use client";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { BsPersonFillUp } from "react-icons/bs";
import { LiaEyeSlashSolid, LiaEyeSolid } from "react-icons/lia";
import { MdOutlineEmail, MdPhone } from "react-icons/md";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { UserRegistrationSchema, UserRegistrationInput } from "@/lib/schemas";

interface UserRegistrationFormProps {
  onSubmit: (values: UserRegistrationInput) => void;
  isPending: boolean;
}

const defaultValues: UserRegistrationInput = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
  repeatPassword: "",
  termsAccepted: false,
  privacyAccepted: false,
  marketingOptIn: false,
  signupSource: "WEB",
  language: "en",
  timezone: "Africa/Nairobi",
  currency: "KES",
  dateFormat: "DD/MM/YYYY",
};

export function UserRegistrationForm({ onSubmit, isPending }: UserRegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: UserRegistrationSchema,
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
      <div className="w-full space-y-3">
        {/* Full Name */}
        <div className="space-y-2">
          <FieldLabel>Full Name</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <form.Field
              name="firstName"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <div className="relative">
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="First Name"
                        disabled={isPending}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="pr-10"
                        autoComplete="given-name"
                        aria-invalid={isInvalid}
                      />
                      <BsPersonFillUp className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
            <form.Field
              name="lastName"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <div className="relative">
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="Last Name"
                        disabled={isPending}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className=" pr-10"
                        autoComplete="family-name"
                        aria-invalid={isInvalid}
                      />
                      <BsPersonFillUp className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <FieldLabel>Email</FieldLabel>
          <form.Field
            name="email"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="johndoe@example.com"
                      disabled={isPending}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className=" pr-10"
                      autoComplete="email"
                      type="email"
                      aria-invalid={isInvalid}
                    />
                    <MdOutlineEmail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <FieldLabel>Phone Number</FieldLabel>
          <form.Field
            name="phoneNumber"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="+254712345678"
                      disabled={isPending}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className=" pr-10"
                      autoComplete="tel"
                      type="tel"
                      aria-invalid={isInvalid}
                    />
                    <MdPhone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </div>

        {/* Password Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <FieldLabel>Password</FieldLabel>
            <form.Field
              name="password"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <div className="relative">
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="••••••••"
                        disabled={isPending}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className=" pr-10"
                        aria-invalid={isInvalid}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        tabIndex={-1}
                      >
                        {showPassword ? <LiaEyeSlashSolid size={18} /> : <LiaEyeSolid size={18} />}
                      </button>
                    </div>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Confirm Password</FieldLabel>
            <form.Field
              name="repeatPassword"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <div className="relative">
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="••••••••"
                        disabled={isPending}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type={showRepeatPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className=" pr-10"
                        aria-invalid={isInvalid}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        tabIndex={-1}
                      >
                        {showRepeatPassword ? <LiaEyeSlashSolid size={18} /> : <LiaEyeSolid size={18} />}
                      </button>
                    </div>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Must be at least 8 characters with uppercase, lowercase, number, and special character.
        </p>

        <div className="border-t my-4" />

        {/* Terms & Agreements */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            By continuing, you agree to our{" "}
            <a href="/terms" target="_blank" className="text-primary hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>

          <form.Field
            name="termsAccepted"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="agree-terms"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                      className="dark:text-white"
                    />
                    <FieldLabel htmlFor="agree-terms" className="font-normal cursor-pointer">
                      I agree to the Terms of Service *
                    </FieldLabel>
                  </div>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="privacyAccepted"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="agree-privacy"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                      className="dark:text-white"
                    />
                    <FieldLabel htmlFor="agree-privacy" className="font-normal cursor-pointer">
                      I agree to the Privacy Policy *
                    </FieldLabel>
                  </div>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="marketingOptIn"
            children={(field) => (
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="marketing-optin"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                    className="dark:text-white"
                  />
                  <FieldLabel
                    htmlFor="marketing-optin"
                    className="font-normal cursor-pointer text-muted-foreground"
                  >
                    Send me product updates (optional)
                  </FieldLabel>
                </div>
              </Field>
            )}
          />
        </div>
      </div>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit]) => (
          <Button type="submit" variant="secondary" disabled={isPending || !canSubmit} className="w-full">
            {isPending ? "Creating account..." : "Continue"}
          </Button>
        )}
      />
    </form>
  );
}