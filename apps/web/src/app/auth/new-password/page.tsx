import ResetPassword from "@/components/auth/password/resetPassword";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "password reset",
};
export default function Page(){
    return(
        <ResetPassword />
    )
}