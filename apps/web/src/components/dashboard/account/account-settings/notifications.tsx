// app/(dashboard)/settings/components/notifications.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UserNotificationSettingSchema } from "@/schemas/user-schema";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Form, FormField, FormItem, FormMessage } from "@workspace/ui/components/form";
import { cn } from "@workspace/ui/lib/utils";
import { Mail, Megaphone, Users, Bell } from "lucide-react";

const notificationOptions = [
    {
        id: "news",
        name: "News & Updates",
        description: "Product announcements and feature updates",
        icon: Megaphone,
    },
    {
        id: "updates",
        name: "Service Updates",
        description: "Important updates about our services",
        icon: Mail,
    },
    {
        id: "userResearch",
        name: "User Research",
        description: "Beta testing and paid research opportunities",
        icon: Users,
    },
    {
        id: "reminders",
        name: "Reminders",
        description: "Notifications about things you might have missed",
        icon: Bell,
    },
];

export default function ProfileNotifications() {
    const form = useForm<z.infer<typeof UserNotificationSettingSchema>>({
        resolver: zodResolver(UserNotificationSettingSchema),
        defaultValues: {
            news: true,
            updates: true,
            userResearch: false,
            reminders: false,
        },
    });

    return (
        <Form {...form}>
            <form className="space-y-0">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                        Choose which emails you'd like to receive
                    </p>
                </div>
                <div className="divide-y rounded-lg border mt-4">
                    {notificationOptions.map((option, idx) => (
                        <FormField
                            key={option.id}
                            control={form.control}
                            name={option.id as any}
                            render={({ field }) => (
                                <FormItem
                                    className={cn(
                                        "flex items-center justify-between p-4",
                                        idx !== notificationOptions.length - 1 && "border-b"
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 rounded-full bg-primary/10 text-primary">
                                            <option.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <Label className="font-medium">{option.name}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {option.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
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