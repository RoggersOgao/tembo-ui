// app/(dashboard)/settings/components/delete-account.tsx
"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useUser } from "@/hooks/zustand/stores/use-auth-store";
import { AlertTriangle, Trash2 } from "lucide-react";

export default function DeleteAccount() {
    const user = useUser();
    const [confirmText, setConfirmText] = useState("");
    const [open, setOpen] = useState(false);
    const isValid = confirmText === "delete my account";

    const handleDelete = () => {
        if (!isValid) return;
        // Handle account deletion logic here
        console.log("Account deleted");
        setOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                        <Trash2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-lg">Delete Your Account</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            This action is permanent and cannot be undone. All your data, including:
                        </p>
                        <ul className="mt-3 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                            <li>Personal information and profile data</li>
                            <li>Account history and activity</li>
                            <li>Connected services and integrations</li>
                            <li>Any associated content or files</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mt-3">
                            will be permanently deleted from our systems.
                        </p>
                    </div>
                </div>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Permanent Account Deletion
                        </DialogTitle>
                        <DialogDescription>
                            This action is irreversible. Please confirm that you want to permanently delete your account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg bg-destructive/10 p-4 text-sm">
                            <p className="font-medium text-destructive">Warning</p>
                            <p className="text-muted-foreground mt-1">
                                Deleting your account will permanently remove all your data. This action cannot be undone.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-delete">
                                To verify, type <span className="font-mono font-medium">delete my account</span> below
                            </Label>
                            <Input
                                id="confirm-delete"
                                placeholder="delete my account"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="font-mono"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!isValid}
                        >
                            Permanently Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}