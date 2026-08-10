'use client';

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { ModalType, useModal } from "@/hooks/zustand/use-modal";

interface BackButtonProps {
  modalName: ModalType; // ensure only valid types
  label: string;
}

export default function BackButton({ modalName, label }: BackButtonProps) {
  const { onOpen } = useModal();

  return (
    <Button
      variant="link"
      className="font-normal text-sm text-sub-text"
      size="sm"
      onClick={() => onOpen(modalName)}
    >
      <span>{label}</span>
    </Button>
  );
}
