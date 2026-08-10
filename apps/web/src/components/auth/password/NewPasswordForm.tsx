"use client";
import { newPassword } from "@/actions/new-password";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { LiaEyeSolid } from "react-icons/lia";
import ClipLoader from "react-spinners/ClipLoader";
import { toast } from "sonner";
import { z } from "zod";

import { NewPasswordSchema } from "@/lib/schemas";
import { CardWrapper } from "../auth-global/CardWrapper";

export default function NewPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams?.get("token");
    const router = useRouter()
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showRepeatPassword, setShowRepeatPassword] = useState<boolean>(false)
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof NewPasswordSchema>>({
        resolver: zodResolver(NewPasswordSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    function onSubmit(values: z.infer<typeof NewPasswordSchema>) {
        // Do something with the form values.
        //  This will be type-safe and validated.
        setError("");
        setSuccess("");

        startTransition(() => {
            newPassword(values, token as string).then((data) => {
                if (data.error) {
                    toast(data?.error);
                }
                if (data.success) {
                    toast(data?.success);
                    form.reset()
                    router.push("/auth/login")
                    
                }
            });
        });
    }
    return (
        <div>
            <CardWrapper
                headerLabel="Enter your new password below and confirm it to complete the reset process"
                backButtonLabel="Back to login"
                modalName="LOGIN"
                name="Reset Password"
            >
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-8"
                    >
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                placeholder="|********"
                                                disabled={isPending}
                                                {...field}
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                autoComplete="off"
                                                className="h-[5rem] text-md rounded-xl bg-transparent"
                                            />
                                            <span
                                                onClick={() =>
                                                    setShowPassword(
                                                        !showPassword,
                                                    )
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[2rem] text-sub-text cursor-pointer p-3"
                                            >
                                                <LiaEyeSolid />
                                            </span>
                                        </div>
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                placeholder="|********"
                                                disabled={isPending}
                                                {...field}
                                                type={
                                                    showRepeatPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                autoComplete="off"
                                                className="h-[5rem] text-md rounded-xl bg-transparent"
                                            />
                                            <span
                                                onClick={() =>
                                                    setShowRepeatPassword(
                                                        !showRepeatPassword,
                                                    )
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[2rem] text-sub-text cursor-pointer p-3"
                                            >
                                                <LiaEyeSolid />
                                            </span>
                                        </div>
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-blue-600 text-text-color text-md rounded-full hover:bg-blue-500"
                        >
                            {isPending ? (
                                <span className="flex gap-1 items-center">
                                    <ClipLoader
                                        color="white"
                                        size={15}
                                        aria-label="Loading Spinner"
                                        data-testid="loader"
                                    />
                                    {" resetting..."}
                                </span>
                            ) : (
                                <span className="text-white">Reset password</span>
                            )}
                        </Button>
                    </form>
                </Form>
            </CardWrapper>
        </div>
    );
}
