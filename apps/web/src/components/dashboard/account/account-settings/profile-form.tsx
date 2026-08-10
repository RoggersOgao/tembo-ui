// app/(dashboard)/settings/components/profile-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useUser } from "@/hooks/zustand/stores/use-auth-store";
import { settings } from "@/actions/settings";
import { SettingsSchema, UserRole } from "@/schemas/user-schema";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@workspace/ui/components/form";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { FaEdit, FaCamera } from "react-icons/fa";
import ClipLoader from "react-spinners/ClipLoader";
import Image from "next/image";

export default function ProfileForm() {
    const [isPending, startTransition] = useTransition();
    const { update } = useSession();
    const user = useUser();
    const isUserUsingOAuth = user?.isOAuth;
    const [profilePreview, setProfilePreview] = useState<string | null>(null);

    const canEditRole = ["ADMIN", "ASSISTANT"].includes(user?.role as string);
    const allowedRoles = ['ADMIN', 'STAFF', 'DELIVERY', 'CUSTOMER', 'SUPPLIER'] as const;

    const form = useForm<z.infer<typeof SettingsSchema>>({
        resolver: zodResolver(SettingsSchema),
        defaultValues: {
            name: user?.name || "",
            email: user?.email || "",
            image: user?.image || "",
            role: allowedRoles.includes(user?.role as any) ? (user?.role as (typeof allowedRoles)[number]) : undefined,
            isTwoFactorEnabled: user?.isTwoFactorEnabled || false,
        },
    });

    function onSubmit(values: z.infer<typeof SettingsSchema>) {
        startTransition(() => {
            settings(values)
                .then((data) => {
                    if (data.error) toast.error(data.error);
                    if (data.success) {
                        toast.success(data.success);
                        update();
                    }
                })
                .catch(() => toast.error("Something went wrong!"));
        });
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePreview(reader.result as string);
                // Here you would upload to S3 and then update the form value
                form.setValue("image", reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Profile Photo Section */}
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center pb-6 border-b">
                    <div className="relative group">
                        <Avatar className="w-24 h-24 ring-4 ring-background shadow-lg">
                            <AvatarImage
                                src={profilePreview || user?.image || "https://avatar.vercel.sh/default"}
                                className="object-cover"
                            />
                            <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                                {user?.name?.charAt(0)?.toUpperCase() || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-md"
                                >
                                    <FaEdit className="h-3.5 w-3.5" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Update Profile Photo</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="flex justify-center">
                                        <Avatar className="w-32 h-32">
                                            <AvatarImage src={(profilePreview || user?.image) ?? undefined} />
                                            <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex justify-center">
                                        <Label htmlFor="profile-upload" className="cursor-pointer">
                                            <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors">
                                                <FaCamera className="h-4 w-4" />
                                                <span>Upload New Photo</span>
                                            </div>
                                            <Input
                                                id="profile-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageUpload}
                                            />
                                        </Label>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">{user?.name}</h3>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {user?.role?.toLowerCase()} · Joined {new Date(user?.emailVerified || "").toLocaleDateString()}
                        </p>
                    </div>
                </div>

                {/* Profile Information */}
                <div className="space-y-5">
                    <div>
                        <h3 className="font-medium">Profile Information</h3>
                        <p className="text-sm text-muted-foreground">Update your personal details</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} disabled={isPending} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {!isUserUsingOAuth && (
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <Input placeholder="john@example.com" {...field} disabled={isPending} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        {canEditRole && (
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User Role</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isPending}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Roles</SelectLabel>
                                                    <SelectItem value={UserRole.CUSTOMER}>Customer</SelectItem>
                                                    <SelectItem value={UserRole.SUPPLIER}>Supplier</SelectItem>
                                                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>
                </div>

                {/* Two Factor Authentication */}
                {!isUserUsingOAuth && (
                    <div className="space-y-4 pt-4 border-t">
                        <div>
                            <h3 className="font-medium">Two-Factor Authentication</h3>
                            <p className="text-sm text-muted-foreground">
                                Add an extra layer of security to your account
                            </p>
                        </div>
                        <FormField
                            control={form.control}
                            name="isTwoFactorEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable 2FA</FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                            Receive a verification code every time you sign in
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isPending}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                {/* Submit Button */}
                <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isPending} className="min-w-[120px]">
                        {isPending ? (
                            <span className="flex items-center gap-2">
                                <ClipLoader size={16} color="white" />
                                Saving...
                            </span>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}