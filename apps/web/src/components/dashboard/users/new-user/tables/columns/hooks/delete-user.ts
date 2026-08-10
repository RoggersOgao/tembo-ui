import { useDeleteUser } from "@/hooks/user/useUser";
import { UserData } from "@/loginActions/user-actions";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useDeleteUserWarning() {
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const [userToDelete, setUserToDelete]           = useState<UserData | null>(null);
    const [isDeleting, setIsDeleting]               = useState(false);

    const deleteUserMutation = useDeleteUser();

    const handleDeleteClick = useCallback((user: UserData) => {
        setUserToDelete(user);
        setShowDeleteWarning(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            await deleteUserMutation.mutateAsync(userToDelete.id);
            toast.success(`User "${userToDelete.name}" has been deleted`);
            setShowDeleteWarning(false);
            setUserToDelete(null);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to delete user"
            );
        } finally {
            setIsDeleting(false);
        }
    }, [userToDelete, deleteUserMutation]);

    const handleDeleteCancel = useCallback(() => {
        setShowDeleteWarning(false);
        setUserToDelete(null);
    }, []);

    return {
        showDeleteWarning,
        userToDelete,
        isDeleting,
        handleDeleteClick,
        handleDeleteConfirm,
        handleDeleteCancel,
    };
}