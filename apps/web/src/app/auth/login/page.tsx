import Login from "@/components/auth/login/login";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "login",
};
export default function Page(){
    
    return(
        <div className="loginGradient"><Login /></div>
    )
}