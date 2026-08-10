"use client"

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteUserWarningProps {
    isOpen:      boolean;
    onConfirm:   () => void;
    onCancel:    () => void;
    userName:    string;
    isDeleting?: boolean;
}

export function DeleteUserWarning({
    isOpen,
    onConfirm,
    onCancel,
    userName,
    isDeleting = false,
}: DeleteUserWarningProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={onCancel}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pt-4">
                        Are you sure you want to delete{" "}
                        <span className="font-semibold text-foreground">
                            {userName}
                        </span>
                        ? This action cannot be undone.
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                <strong>Note:</strong> This will permanently remove the
                                user's account and all associated data. The user will
                                lose access immediately and will not be able to log in.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                        Cancel
                    </AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            "Delete User"
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}