import Link from "next/link";
import { ResetPasswordForm } from "./components/reset-password-form";

export default function ResetPassword() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Reset your password</h1>
          <p className="text-muted-foreground text-sm">
            Enter your new password below.
          </p>
        </div>
        <div className="space-y-4">
          <ResetPasswordForm />
        </div>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          Remember your password?{" "}
          <Link prefetch={false} className="text-foreground" href="login">
            Login
          </Link>
        </div>
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-xs">© 2026 Mavibase™. Mavibase is a trademark of Eightve Limited. All rights reserved.</div>
      </div>
    </>
  );
}
