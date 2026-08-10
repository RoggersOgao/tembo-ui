"use client"

import { Button } from "@workspace/ui/components/button";

import Container from "@/global/container";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HiOutlineArrowSmallLeft } from "react-icons/hi2";
import { SiTicktick } from "react-icons/si";



export default function EmailSent (){
    const searchParams = useSearchParams()
    const email = searchParams?.get("email")
    
    return(
        <div className="flex justify-center items-center min-h-screen gap-10 relative">
            
            
            <Container>
                    <div className="rounded-xl before:w-[40rem] before:h-[40rem] before:block before:bg-linear-to-r before:from-yellow-600/20 before:to-blue-600/20 before:absolute relative before:rounded-full before:-bottom-10 before:right-0 before:-z-0 before:blur-[45rem]">
                   <div className="flex flex-col justify-center items-center gap-2">
                       <h1 className="text-4xl font-black flex items-center gap-4">Email verification sent <span className="text-[5rem] text-green-600"><SiTicktick /></span></h1>
                            <p className="text-sub-text text-md ">Check your email <span className="text-blue-600">{ email }</span> to complete the verification process </p>
                   </div>
                    <div className="flex justify-center mt-10">
                       
                    </div>
                    <div className="mt-1  self-start">
                        <Button variant="link" className="flex text-blue-600 gap-2 items-center relative" asChild >
                            <Link href="/auth/login" ><HiOutlineArrowSmallLeft />Back to login</Link>
                        </Button>
                    </div>
            </div>
            </Container>
            </div>
         
    )
}