import EmailSent from "@/components/auth/emailSentPage/EmailSent";
import { Metadata } from "next";
export const metadata: Metadata = {
    title: "mail sent",
};
export default function Page(){
    return(
        <div>
            <EmailSent />
        </div>
    )
}