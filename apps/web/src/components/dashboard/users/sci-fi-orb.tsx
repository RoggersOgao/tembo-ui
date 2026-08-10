"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useS3Store } from "@/hooks/zustand/stores/use-S3-store";
import { Check, AlertCircle, Server, CloudUpload } from "lucide-react";

const ProClockProgress: React.FC = () => {
    const [visualProgress, setVisualProgress] = useState(0);
    const visualProgressRef = useRef(0); // 👈 ref to always have latest value in calculateRealTarget

    const {
        progress,
        loading,
        processingState,
        error,
    } = useS3Store();

    // --- 1. Raw Target (your original logic, untouched) ---
    const calculateRawTarget = (): number => {
        if (error) return visualProgressRef.current;

        if (
            processingState?.step === "done" ||
            processingState?.step === "asset_created" && !loading
        ) {
            return 100;
        }

        if (processingState.step?.startsWith("deleting") || processingState.step === "listing_objects" || processingState.step === "delete_start") {
            const deletionMap: Record<string, number> = {
                delete_start: 95,
                listing_objects: 96,
                deleting_s3: 97,
                deleting_assets: 98,
                deleting_site: 99,
            };
            return deletionMap[processingState.step] || 95;
        }

        if (loading && !processingState.step) {
            return Math.min(progress * 0.5, 50);
        }

        if (processingState.step) {
            const step = processingState.step;

            const stepBaseMap: Record<string, number> = {
                start: 50,
                download: 55,
                extract: 60,
                upload: 65,
                upload_file: 65,
                entry: 90,
                assets: 93,
                asset_created: 94,
            };

            let base = stepBaseMap[step] || 50;

            if (step === "upload_file" && processingState.fileProgress) {
                const fileBonus = (processingState.fileProgress / 100) * 25;
                base += fileBonus;
            }

            return Math.min(base, 99);
        }

        return 0;
    };

    // --- 2. Real Target: never go below where we already are ---
    const calculateRealTarget = (): number => {
        const raw = calculateRawTarget();
        return Math.max(raw, visualProgressRef.current); // 👈 the key fix
    };

    const targetProgress = calculateRealTarget();

    // --- 3. Smooth Interpolation Engine ---
    useEffect(() => {
        let animationFrameId: number;

        const updateVisuals = () => {
            setVisualProgress((prev) => {
                // Never go backwards
                if (targetProgress <= prev) {
                    visualProgressRef.current = prev;
                    return prev;
                }

                const diff = targetProgress - prev;

                if (Math.abs(diff) < 0.1) {
                    visualProgressRef.current = targetProgress;
                    return targetProgress;
                }

                const next = prev + diff * 0.1;
                visualProgressRef.current = next; // 👈 keep ref in sync
                return next;
            });

            animationFrameId = requestAnimationFrame(updateVisuals);
        };

        animationFrameId = requestAnimationFrame(updateVisuals);
        return () => cancelAnimationFrame(animationFrameId);
    }, [targetProgress]);


    // --- 4. UI Helper States ---
    const isError = !!error;
    const isComplete = processingState?.step === "done" && visualProgress >= 99;
    const isPhaseOne = targetProgress <= 50;

    // --- 5. Visual Math ---
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (visualProgress / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center py-6 w-full max-w-sm mx-auto font-sans">

            {/* --- THE CLOCK UI --- */}
            <div className="relative w-48 h-48 flex items-center justify-center mb-6">

                {/* A. Activity Ring */}
                {!isComplete && !isError && (
                    <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
                        <div className="w-full h-full rounded-full border border-zinc-100 dark:border-zinc-800 border-t-zinc-300 dark:border-t-zinc-600 opacity-100" />
                    </div>
                )}

                {/* B. Static Background Track */}
                <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-zinc-100 dark:text-zinc-900"
                    />
                </svg>

                {/* C. Progress Ring */}
                <svg className="absolute w-full h-full transform -rotate-90 drop-shadow-sm">
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className={cn(
                            "transition-colors duration-300",
                            isError ? "text-red-500" :
                                isComplete ? "text-emerald-600" : "text-zinc-800 dark:text-zinc-100"
                        )}
                    />
                </svg>

                {/* D. Center Display */}
                <div className="flex flex-col items-center justify-center z-10 space-y-1">
                    <div className="text-zinc-400 mb-1">
                        {isError ? <AlertCircle className="w-5 h-5 text-red-500" /> :
                            isComplete ? <Check className="w-6 h-6 text-emerald-600" /> :
                                isPhaseOne ? <CloudUpload className="w-5 h-5" /> :
                                    <Server className="w-5 h-5" />}
                    </div>

                    <span className={cn(
                        "text-3xl font-mono font-bold tracking-tighter tabular-nums",
                        isError ? "text-red-600" : "text-zinc-900 dark:text-white"
                    )}>
                        {Math.floor(visualProgress)}
                    </span>

                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                        {isPhaseOne ? "Uploading" : "Processing"}
                    </span>
                </div>
            </div>

            {/* --- TEXT FEEDBACK --- */}
            <div className="w-full text-center space-y-2 px-4 h-16">

                <h3 className={cn(
                    "text-sm font-semibold uppercase tracking-wide",
                    isError ? "text-red-600" : "text-zinc-700 dark:text-zinc-300"
                )}>
                    {isError ? "Upload Failed" :
                        isComplete ? "Success" :
                            processingState.step ? processingState.step.replace(/_/g, " ") : "Uploading..."}
                </h3>

                {!isComplete && !isError && (
                    <div className="flex flex-col items-center">
                        <p className="text-xs font-mono text-zinc-500 truncate max-w-[240px]">
                            {processingState.currentFilename
                                ? `Syncing: ${processingState.currentFilename}`
                                : loading && !processingState.step
                                    ? "Sending data to S3 bucket..."
                                    : "processing request..."}
                        </p>
                    </div>
                )}

                {isError && (
                    <p className="text-xs font-mono text-red-400 max-w-[260px] mx-auto leading-tight break-words">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ProClockProgress;