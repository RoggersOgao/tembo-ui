"use client";
import { ResetPassword } from "@/actions/reset";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import ClipLoader from "react-spinners/ClipLoader";
import { toast } from "sonner";
import { z } from "zod";

import { ResetSchema } from "@/lib/schemas";
import { CardWrapper } from "../auth-global/CardWrapper";
import { useModal } from "@/hooks/zustand/use-modal";

export default function ResetForm() {



    const [isPending, startTransition] = useTransition();
    const {onClose} = useModal()
    const form = useForm<z.infer<typeof ResetSchema>>({
        resolver: zodResolver(ResetSchema),
        defaultValues: {
            email: "",
        },
    });

    function onSubmit(values: z.infer<typeof ResetSchema>) {
    

        startTransition(() => {
            ResetPassword(values)
                .then((data) => {
                    if (data.error) {
                        toast(data?.error)
                    }
                    if (data.success) {
                        toast(data?.success)
                        form.reset()
                        onClose()
                    }
                })
        });
    }
    return (
        <div>
            <CardWrapper
                headerLabel="This will reset your password. A link to create a new one will be sent to your email."
                backButtonLabel="Back to login"
                modalName="LOGIN"
                name="Reset your Password"
            >
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-8"
                    >
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="johndoe@example.com"
                                            disabled={isPending}
                                            {...field}
                                            className="h-12 text-md rounded-xl bg-transparent"
                                        />
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full text-white text-text-color text-md rounded-full"
                        >
                            {isPending ? <span className="flex gap-1 items-center text-white">
                                <ClipLoader
                                    color="white"
                                    size={15}
                                    aria-label="Loading Spinner"
                                    data-testid="loader"
                                />
                                {" sending email..."}
                            </span> : <span className="text-white">send reset email</span>}
                        </Button>
                    </form>
                </Form>
            </CardWrapper>
        </div>
    );
}
