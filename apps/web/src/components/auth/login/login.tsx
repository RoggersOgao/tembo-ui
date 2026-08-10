
import LoginForm from "./LoginForm";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { GoArrowLeft } from "react-icons/go";
import Image from "next/image";

export default function Login() {
  return (
    <div className=" h-svh  max-w-7xl mx-auto items-center place-content-center px-3">
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col h-full lg:border p-2 py-5">
          <div className="flex flex-1 justify-center relative">
            <div className="w-full max-w-md relative">
              <LoginForm />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <Image
            src="https://0xju7y00ag.ufs.sh/f/6MCGWTunDP9b5vm6w1etbO6CMUermXPLhZyTHz1BqK40Wk2E"
            alt="happy family"
            width={800}
            height={1600}
            className="w-full h-full object-cover absolute inset-0"
          />
        </div>

      </div>
    </div>
  )
}
