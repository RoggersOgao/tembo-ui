import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

function cn(...inputs: (string | undefined | null | false)[]): string {
    return inputs.filter(Boolean).join(" ");
}

// Applied to the outer wrapper div — controls sizing
const glassButtonWrapVariants = cva(
    "glass-button-wrap group relative inline-flex items-center justify-center rounded-full",
    {
        variants: {
            size: {
                default: "text-base font-medium",
                sm: "text-sm font-medium",
                lg: "text-lg font-medium",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            size: "default",
        },
    }
);

// Applied to the inner <button> — fills wrapper, centers content
const glassButtonVariants = cva(
    [
        "relative isolate cursor-pointer rounded-full",
        "transition-all duration-200",
        "appearance-none border-none bg-transparent p-0 outline-none",
        // Always fill the wrapper and center text
        "w-full h-full flex items-center justify-center",
    ].join(" "),
    {
        variants: {
            size: {
                default: "",
                sm: "",
                lg: "",
                icon: "",
            },
        },
        defaultVariants: {
            size: "default",
        },
    }
);

// Text span padding — only applied when not icon
const glassButtonTextVariants = cva(
    "relative z-10 block select-none tracking-tighter text-white/90 text-center w-full",
    {
        variants: {
            size: {
                default: "px-6 py-3.5",
                sm: "px-4 py-2",
                lg: "px-8 py-4",
                icon: "flex h-full w-full items-center justify-center",
            },
        },
        defaultVariants: {
            size: "default",
        },
    }
);

export interface GlassButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
    contentClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
    ({ className, children, size, contentClassName, ...props }, ref) => {
        return (
            <div className={cn(glassButtonWrapVariants({ size }), className)}>
                {/* Clear glass body */}
                <div className="pointer-events-none absolute inset-0 rounded-full border border-white/15 bg-white/5 backdrop-blur-[2px] transition-all duration-700 group-hover:border-white/25 group-hover:bg-transparent group-hover:backdrop-blur-[1px]" />

                {/* Water-like refraction shimmer on hover */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div
                        className="absolute inset-0 rounded-full opacity-60"
                        style={{
                            background: `
                radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.3) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.2) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)
              `,
                            filter: "blur(4px)",
                        }}
                    />
                </div>

                {/* Moving refraction lines */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full opacity-0 transition-all duration-700 group-hover:opacity-100">
                    <div
                        className="absolute -top-1/2 h-[200%] w-[1px] bg-gradient-to-b from-transparent via-white/50 to-transparent transition-transform duration-[1500ms] ease-in-out group-hover:translate-x-full"
                        style={{ left: "-2px" }}
                    />
                    <div
                        className="absolute -top-1/2 h-[200%] w-[2px] bg-gradient-to-b from-transparent via-white/30 to-transparent transition-transform delay-200 duration-[1800ms] ease-in-out group-hover:-translate-x-full"
                        style={{ right: "-2px" }}
                    />
                </div>

                {/* Water caustics */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full opacity-0 transition-opacity delay-100 duration-700 group-hover:opacity-40">
                    <div
                        className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full"
                        style={{
                            background: `conic-gradient(
                from 0deg,
                transparent 0deg,
                rgba(255,255,255,0.15) 45deg,
                transparent 90deg,
                rgba(255,255,255,0.1) 135deg,
                transparent 180deg,
                rgba(255,255,255,0.15) 225deg,
                transparent 270deg,
                rgba(255,255,255,0.1) 315deg,
                transparent 360deg
              )`,
                        }}
                    />
                </div>

                {/* Shifting gradient border */}
                <div
                    className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-all duration-500 group-hover:opacity-100"
                    style={{
                        background:
                            "linear-gradient(115deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.08) 20%, transparent 40%, transparent 60%, rgba(255,255,255,0.08) 80%, rgba(255,255,255,0.4) 100%)",
                        padding: "1px",
                        WebkitMask:
                            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude",
                    }}
                />

                {/* === REALISTIC WATER DROPLETS ON TOP === */}

                {/* Large droplet - left side */}
                <div className="pointer-events-none absolute -top-1 left-[15%] z-20">
                    {/* Droplet shadow */}
                    <div className="absolute top-[2px] left-[1px] h-[10px] w-[10px] rounded-full bg-black/20 blur-[2px]" />
                    {/* Main droplet body */}
                    <div className="relative h-[10px] w-[10px]">
                        {/* Droplet base */}
                        <div className="absolute inset-0 rounded-full bg-white/30 backdrop-blur-[1px]" />
                        {/* Droplet highlight */}
                        <div className="absolute top-[1px] left-[2px] h-[3px] w-[2px] rounded-full bg-white/90" />
                        {/* Droplet refraction */}
                        <div className="absolute bottom-[1px] right-[2px] h-[2px] w-[2px] rounded-full bg-white/10" />
                        {/* Droplet inner shadow for depth */}
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]" />
                    </div>
                </div>

                {/* Medium droplet - left-center */}
                <div className="pointer-events-none absolute top-0 left-[28%] z-20">
                    <div className="absolute top-[1px] left-[1px] h-[7px] w-[7px] rounded-full bg-black/15 blur-[1.5px]" />
                    <div className="relative h-[7px] w-[7px]">
                        <div className="absolute inset-0 rounded-full bg-white/25 backdrop-blur-[1px]" />
                        <div className="absolute top-[1px] left-[1px] h-[2px] w-[1.5px] rounded-full bg-white/85" />
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" />
                    </div>
                </div>

                {/* Small droplet cluster - right side */}
                <div className="pointer-events-none absolute -top-1 right-[22%] z-20">
                    <div className="absolute top-[1px] left-[0px] h-[6px] w-[6px] rounded-full bg-black/15 blur-[1px]" />
                    <div className="relative h-[6px] w-[6px]">
                        <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-[1px]" />
                        <div className="absolute top-[1px] left-[1px] h-[1.5px] w-[1px] rounded-full bg-white/80" />
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_0.5px_1.5px_rgba(0,0,0,0.08)]" />
                    </div>
                </div>

                {/* Tiny droplet - far right */}
                <div className="pointer-events-none absolute top-[1px] right-[12%] z-20">
                    <div className="absolute top-[0.5px] left-[0px] h-[4px] w-[4px] rounded-full bg-black/10 blur-[0.8px]" />
                    <div className="relative h-[4px] w-[4px]">
                        <div className="absolute inset-0 rounded-full bg-white/18 backdrop-blur-[0.5px]" />
                        <div className="absolute top-[0.5px] left-[0.5px] h-[1px] w-[0.8px] rounded-full bg-white/75" />
                        <div className="absolute inset-0 rounded-full shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.05)]" />
                    </div>
                </div>

                {/* Tiny droplet duo - center top */}
                <div className="pointer-events-none absolute top-[1px] left-[45%] z-20">
                    <div className="absolute top-[0.5px] left-[0px] h-[3.5px] w-[3.5px] rounded-full bg-black/10 blur-[0.8px]" />
                    <div className="relative h-[3.5px] w-[3.5px]">
                        <div className="absolute inset-0 rounded-full bg-white/15 backdrop-blur-[0.5px]" />
                        <div className="absolute top-[0.5px] left-[0.5px] h-[1px] w-[0.8px] rounded-full bg-white/70" />
                    </div>
                </div>

                {/* Edge water drops */}
                <div className="pointer-events-none absolute left-[15%] top-[2px] h-[6px] w-[6px] rounded-full bg-white/0 blur-[2px] transition-all duration-700 group-hover:-translate-y-[2px] group-hover:translate-x-[2px] group-hover:h-[8px] group-hover:w-[8px] group-hover:bg-white/40" />
                <div className="pointer-events-none absolute right-[25%] top-[2px] h-[4px] w-[4px] rounded-full bg-white/0 blur-[1px] transition-all delay-75 duration-700 group-hover:-translate-x-[1px] group-hover:-translate-y-[1px] group-hover:h-[6px] group-hover:w-[6px] group-hover:bg-white/35" />
                <div className="pointer-events-none absolute bottom-[3px] left-[30%] h-[4px] w-[4px] rounded-full bg-white/0 blur-[1px] transition-all delay-150 duration-700 group-hover:-translate-x-[2px] group-hover:translate-y-[2px] group-hover:h-[7px] group-hover:w-[7px] group-hover:bg-white/30" />
                <div className="pointer-events-none absolute bottom-[2px] right-[20%] h-[5px] w-[5px] rounded-full bg-white/0 blur-[2px] transition-all delay-200 duration-700 group-hover:translate-x-[3px] group-hover:translate-y-[3px] group-hover:h-[9px] group-hover:w-[9px] group-hover:bg-white/35" />

                {/* The actual button — fills the wrapper */}
                <button
                    className={cn(glassButtonVariants({ size }))}
                    ref={ref}
                    {...props}
                >
                    <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>
                        {children}
                    </span>
                </button>

                {/* Inner reflection */}
                <div className="pointer-events-none absolute inset-[2px] rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.2)] transition-all duration-500 group-hover:shadow-[inset_0_3px_6px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(0,0,0,0.1)]" />

                {/* Bottom water tension line */}
                <div className="pointer-events-none absolute bottom-0 left-1/2 h-[1px] w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-500 group-hover:w-3/4 group-hover:via-white/40" />
            </div>
        );
    }
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };