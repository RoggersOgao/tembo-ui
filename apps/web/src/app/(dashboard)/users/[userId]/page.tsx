import { UserManagerDashboard } from "@/components/dashboard/users/view-user/view-user-details"

export default async function Page({
    params,
}: {
    params: Promise<{userId: string}>
    }) {
    
    const userId = (await params).userId
    return (
        <div>
            <UserManagerDashboard
                userId={userId }
            />
        </div>
    )
}