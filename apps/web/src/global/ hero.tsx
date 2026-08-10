
import { cn } from "@/lib/utils";
import React from "react";

type Props = {
    children: React.ReactNode;
    className?: string
};

interface HeroElementProps {
    children: React.ReactNode;
    className?: string
}
export const HeroTitle = ({ children, className }: HeroElementProps) => {
    return (
        <div className={cn("text-[45px] leading-15 font-bold bg-radial-[at_55%_25%] from-gray-400 via-zinc-700 to-gray-600 to-75% inline-block text-transparent bg-clip-text", className)}>{children}</div>
    )
};

export const HeroSubtitle = ({ children, className }: HeroElementProps) => {
    return (
        <div className={cn("text-md text-[var(--text-color-primary)] font-regular w-full", className)}>{children}</div>
    )
};
function Hero({ children }: Props) {
    return <div>{children}</div>;
}

export default Hero;
