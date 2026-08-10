'use client';

import React from 'react';
import { Button } from '@workspace/ui/components/button'; // adjust path as needed
import { useModal } from '@/hooks/zustand/use-modal';

export default function ForgotPasswordButton() {
  const { onOpen } = useModal();

  return (
    <Button
      size="sm"
      variant="link"
      role='button'
      type='button'
      className="px-0 font-normal mt-1"
      onClick={() => onOpen("RESET")} // trigger your reset modal type here
    >
      Forgot password?
    </Button>
  );
}
