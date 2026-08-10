import { NewVerificationForm } from "@/components/auth/reset/verification/new-verification-form";
import { Metadata } from "next";
export const metadata: Metadata = {
    title: "verification",
};
export default function Page(){
    return(
        <div>
            <NewVerificationForm />
        </div>
    )
    
}