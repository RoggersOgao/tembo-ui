// app/(dashboard)/settings/components/profile-social.tsx
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UserSocialAccountsSchema } from "@/schemas/user-schema";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Form, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Twitter, Facebook, Instagram, Apple, Link2, Unlink } from "lucide-react";

const socialOptions = [
    {
        id: "twitter",
        name: "Twitter",
        icon: Twitter,
        color: "text-[#1DA1F2]",
    },
    {
        id: "facebook",
        name: "Facebook",
        icon: Facebook,
        color: "text-[#1877F2]",
    },
    {
        id: "instagram",
        name: "Instagram",
        icon: Instagram,
        color: "text-[#E4405F]",
    },
    {
        id: "apple",
        name: "Apple",
        icon: Apple,
        color: "text-foreground",
    },
];

export default function ProfileSocial() {
    const [connecting, setConnecting] = useState<string | null>(null);

    const form = useForm<z.infer<typeof UserSocialAccountsSchema>>({
        resolver: zodResolver(UserSocialAccountsSchema),
        defaultValues: {
            twitter: false,
            facebook: false,
            instagram: false,
            apple: false,
        },
    });

    const handleConnect = (id: string, isConnected: boolean) => {
        setConnecting(id);
        // Simulate connection logic
        setTimeout(() => {
            form.setValue(id as any, !isConnected);
            setConnecting(null);
        }, 1000);
    };

    return (
        <Form {...form}>
            <form className="space-y-0">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                        Connect your social accounts to enable additional features
                    </p>
                </div>
                <div className="divide-y rounded-lg border mt-4">
                    {socialOptions.map((option, idx) => (
                        <FormField
                            key={option.id}
                            control={form.control}
                            name={option.id as any}
                            render={({ field }) => (
                                <FormItem
                                    className={cn(
                                        "flex items-center justify-between p-4",
                                        idx !== socialOptions.length - 1 && "border-b"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-2 rounded-full bg-muted", option.color)}>
                                            <option.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <Label className="font-medium">{option.name}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {field.value ? "Connected" : "Not connected"}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant={field.value ? "outline" : "default"}
                                        size="sm"
                                        onClick={() => handleConnect(option.id, field.value)}
                                        disabled={connecting === option.id}
                                        className="gap-1.5"
                                    >
                                        {connecting === option.id ? (
                                            "Connecting..."
                                        ) : field.value ? (
                                            <>
                                                <Unlink className="h-3.5 w-3.5" />
                                                Disconnect
                                            </>
                                        ) : (
                                            <>
                                                <Link2 className="h-3.5 w-3.5" />
                                                Connect
                                            </>
                                        )}
                                    </Button>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ))}
                </div>
            </form>
        </Form>
    );
}