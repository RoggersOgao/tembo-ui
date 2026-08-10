import Reset from "@/components/auth/reset/reset";
import { Metadata } from "next";


export const metadata: Metadata = {
    title: "reset",
};
export default function Page(){
    return(
        <Reset />
    )
}