"use client";

import { AnimatePresence, motion, MotionProps } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface NodeRotateProps {
    nodes: React.ReactNode[]; //  array of nodes
    duration?: number;
    motionProps?: MotionProps;
    className?: string;
}

export function NodeRotate({
    nodes,
    duration = 2500,
    motionProps = {
        initial: { opacity: 0, y: -50 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 50 },
        transition: { duration: 0.25, ease: "easeOut" },
    },
    className,
}: NodeRotateProps) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!nodes.length) return;

        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % nodes.length);
        }, duration);

        return () => clearInterval(interval);
    }, [nodes, duration]);

    return (
        <div className="overflow-hidden py-2">
            <AnimatePresence mode="wait">
                <motion.div
                    key={index} //  stable key
                    className={cn(className)}
                    {...motionProps}
                >
                    {nodes[index]}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
