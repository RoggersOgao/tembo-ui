"use client";
import { CurrentRole } from "@/lib/server/client-current-role";
import React from "react";


import FormError from "./form-error";
import { UserRole } from "@/types/auth-types";

interface RoleGateProps {
    children: React.ReactNode
    allowRole: UserRole
}


export const RoleGate = ({
    children,
    allowRole,
}: RoleGateProps) => {
    const role = CurrentRole();

    if (role !== allowRole) {
        return (
            <FormError message="You do not have permission to view this content!" />
        )
    }
    return (
        <>{children}</>
    )
}