import Register from "@/components/auth/register/register";
import { Metadata } from "next";
export const metadata: Metadata = {
    title: "register",
};
export default function Page(){
    return(
        <div className="loginGradient"><Register /></div>
    )
}