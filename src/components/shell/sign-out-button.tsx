"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="pos"
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await signOut();
        });
      }}
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Đang thoát…" : "Đăng xuất"}
    </Button>
  );
}
