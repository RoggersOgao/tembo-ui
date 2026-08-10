import React from "react";
import Image from "next/image";
import NewPasswordForm from "../password/NewPasswordForm";

export default function ResetPassword() {
    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden  p-4 lg:flex-row lg:gap-20">

            {/* --- Background Effects --- */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -bottom-40 -right-20 h-[40rem] w-[40rem] rounded-full bg-gradient-to-r from-yellow-600/20 to-blue-600/20 blur-[6rem] lg:-right-40" />
                <div className="hidden md:block">
                    <span className="absolute top-1/2 left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-[10rem]" />
                    <span className="absolute left-0 top-1/2 h-[30rem] w-[40rem] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[8rem]" />
                </div>
            </div>
            {/* --- Form Section --- */}
            <div className="relative z-10 w-full max-w-md">
                <NewPasswordForm />
            </div>

        </div>
    );
}