import React from "react";
import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { HiOutlineArrowSmallLeft } from "react-icons/hi2";

export default function ErrorCard(){
    return(
        <div className="flex justify-center items-center min-h-screen gap-10 relative overflow-hidden">
            <div className="rounded-xl before:w-[40rem] before:h-[40rem] before:block before:bg-linear-to-r before:from-yellow-600/20 before:to-blue-600/20 before:absolute relative before:rounded-full before:-bottom-10 before:right-0 before:-z-0 before:blur-[45rem]">
                <div className="absolute hidden md:block opacity-50">
                <span className="w-[50rem] h-[30rem] block bg-white/10 rounded-full blur-[10rem] absolute z-0 pointer-events-none"></span>
                <span className="w-[90rem] h-[30rem] block bg-blue-600/10 rounded-full blur-[10rem] absolute z-0 left-0 pointer-events-none"></span>
                </div>
            <Image 
                src="/504-Error-Gateway-Timeout-rafiki.svg"
                alt="fantasy-computer-workspace-illustration"
                width={500}
                height={900}
                className="rounded-[2rem] relative pointer-events-none hidden lg:block"    
            />
            <div className="mt-1  self-start">
                <Button variant="link" className="flex text-blue-600 gap-2 items-center relative" asChild >
                    <Link href="/auth/login" ><HiOutlineArrowSmallLeft />Back to login</Link>
                </Button>
            </div>
            </div>
        
        </div> 
    )
}