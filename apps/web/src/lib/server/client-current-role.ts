"use client"

import { useSession } from "next-auth/react";

export const CurrentRole = () => {
    const session = useSession()
    
    return session.data?.user?.role
}