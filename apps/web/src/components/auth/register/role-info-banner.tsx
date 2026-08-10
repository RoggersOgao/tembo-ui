import { UserRole, getRoleInfoMessage } from "@/utils/registration-utils";
import { InfoIcon } from "lucide-react";

interface RoleInfoBannerProps {
    role: UserRole;
}

export function RoleInfoBanner({ role }: RoleInfoBannerProps) {
    const message = getRoleInfoMessage(role);

    if (!message) return null;

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
                <InfoIcon className="w-4 h-4 text-blue-700 dark:text-blue-300 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    {message}
                </p>
            </div>
        </div>
    );
}