// app/(dashboard)/settings/components/profile-security.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { settings } from "@/actions/settings";
import { SettingsSchema } from "@/schemas/user-schema";
import { useUser } from "@/hooks/zustand/stores/use-auth-store";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@workspace/ui/components/form";
import { Shield, Lock } from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";

export default function ProfileSecurity() {
    const [isPending, startTransition] = useTransition();
    const { update } = useSession();
    const user = useUser();
    const isUserUsingOAuth = user?.isOAuth;

    const form = useForm<z.infer<typeof SettingsSchema>>({
        resolver: zodResolver(SettingsSchema),
        defaultValues: {
            password: "",
            newPassword: "",
        },
    });

    function onSubmit(values: z.infer<typeof SettingsSchema>) {
        startTransition(() => {
            settings(values)
                .then((data) => {
                    if (data.error) toast.error(data.error);
                    if (data.success) {
                        toast.success(data.success);
                        form.reset({ password: "", newPassword: "" });
                    }
                })
                .catch(() => toast.error("Something went wrong!"));
        });
    }

    if (isUserUsingOAuth) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex p-3 rounded-full bg-muted mb-4">
                    <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium">Password Management Unavailable</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    You signed up using {user?.provider || "OAuth"}. Password changes must be managed through your provider.
                </p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-sm">Password Security Tips</h3>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                            <li>Use at least 8 characters</li>
                            <li>Include numbers, uppercase, and special characters</li>
                            <li>Avoid using common words or personal information</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="Enter your current password"
                                        {...field}
                                        disabled={isPending}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="Enter your new password"
                                        {...field}
                                        disabled={isPending}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="pt-2 flex justify-end">
                    <Button type="submit" disabled={isPending} className="min-w-[120px]">
                        {isPending ? (
                            <span className="flex items-center gap-2">
                                <ClipLoader size={16} color="white" />
                                Updating...
                            </span>
                        ) : (
                            "Update Password"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}