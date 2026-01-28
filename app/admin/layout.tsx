import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";


export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (profile?.role !== 'admin') {
        redirect("/");
    }

    const fullName = profile?.full_name || "Admin";
    const role = "Administrator";

    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-white overflow-hidden">
                <AdminSidebar />
                <SidebarInset className="flex flex-col flex-1 overflow-hidden bg-white border-l border-slate-200">
                    {/* Top Navbar */}
                    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-200">
                                <AvatarFallback className="bg-slate-900 text-white">
                                    <User className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900 leading-none">{fullName}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{role}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded border border-red-100 mr-2">Live Production</span>
                            <LogoutButton />
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-y-auto p-8">
                        <div className="mx-auto max-w-7xl">
                            {children}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
