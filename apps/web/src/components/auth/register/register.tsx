'use client'

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import RegisterForm from "./RegisterForm";

export default function Register() {
  const pathname = usePathname()
  return (
    <div className=" h-svh  max-w-7xl mx-auto items-center px-3">
      <div className="grid lg:grid-cols-2 py-20">
        <div className="flex flex-col h-full lg:border ">
         
          <div className="flex flex-1 justify-center relative">
            <div className="w-full max-w-xl relative py-0 mt-0">
              <RegisterForm />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <Image
            src="https://0xju7y00ag.ufs.sh/f/6MCGWTunDP9beWJY54OJjw35b4nXNdSCrPT6lRsthZOiVFzu"
            alt="happy family"
            width={800}
            height={1200}
            className="h-full w-full object-cover dark:brightness-[0.5] dark:grayscale"
          />
        </div>

      </div>
    </div>
  )
}



