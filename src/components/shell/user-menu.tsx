"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

interface UserMenuProps {
  fullName: string;
  email: string;
  roleLabel: string;
}

export function UserMenu({ fullName, email, roleLabel }: UserMenuProps) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <span className="max-w-32 truncate text-sm font-medium">{fullName}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-11 gap-2"
          disabled={pending}
          onSelect={() => {
            startTransition(async () => {
              await signOut();
            });
          }}
        >
          <LogOut className="size-4" aria-hidden />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
