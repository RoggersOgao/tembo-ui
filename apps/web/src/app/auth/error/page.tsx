import ErrorCard from "@/components/auth/auth-global/ErrorCard";
import { Metadata } from "next";
export const metadata: Metadata = {
    title: "Error",
};
export default function Page(){
    return(
        <ErrorCard />
    )
}