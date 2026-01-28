"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export function LogoutButton() {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 gap-2 font-bold uppercase tracking-wider text-[10px]"
        >
            <LogOut className="h-4 w-4" />
            Logout
        </Button>
    );
}
