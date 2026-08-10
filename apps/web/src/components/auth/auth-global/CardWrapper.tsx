"use client";
import React from "react";
import BackButton from "./BackButton";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card";
import Social from "./Social";
import { ModalType } from "@/hooks/zustand/use-modal";
import { TemboLogo } from "@/components/layout/logo";

interface CardWrapperProps {
    children: React.ReactNode;
    headerLabel: string;
    backButtonLabel: string;
    modalName: ModalType
    showSocial?: boolean;
    name: string
}

export const CardWrapper = ({
    children,
    headerLabel,
    backButtonLabel,
    modalName,
    showSocial,
    name,
}: CardWrapperProps) => {
    return (
        <div className="flex items-center justify-center w-full">
            <Card className="w-full rounded-none border-0! border-amber-300 ring-0">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-black mb-2 flex justify-center">
                        <TemboLogo className="w-30 h-10 flex-shrink-0 mt-1" aria-hidden="true" />
                    </CardTitle>
                    <CardDescription className="text-sm">
                        {headerLabel}
                    </CardDescription>

                </CardHeader>
                
                <CardContent>{children}</CardContent>

                <CardFooter className="flex flex-col">
                    {showSocial && <Social />}
                </CardFooter>
            </Card>
        </div>
    );
};
