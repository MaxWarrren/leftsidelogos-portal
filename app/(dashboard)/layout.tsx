import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/logout-button";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";



export default async function DashboardLayout({
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

    if (profile?.role === 'admin') {
        redirect("/admin");
    }

    // Check if user has any organization memberships
    let userOrgs: { id: string; name: string }[] = [];

    if (profile?.role === 'admin') {
        // Admins see all orgs
        const { data: allOrgs } = await supabase.from('organizations').select('id, name').order('name');
        userOrgs = allOrgs || [];
    } else {
        const { data: memberships } = await supabase
            .from("organization_members")
            .select("organizations(id, name)")
            .eq("user_id", user.id);

        if ((!memberships || memberships.length === 0)) {
            redirect("/join");
        }

        // Flatten and filter out nulls/arrays if any
        userOrgs = (memberships?.flatMap(m => m.organizations ? [m.organizations] : []) || []) as unknown as { id: string; name: string }[];
    }

    // Get active org from cookie or default to first
    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('active_org_id')?.value || userOrgs[0]?.id;

    const role = profile?.role || "Member";
    const fullName = profile?.full_name || "User";

    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-white overflow-hidden">
                <AppSidebar organizations={userOrgs} currentOrgId={activeOrgId} />
                <SidebarInset className="flex flex-col flex-1 overflow-hidden bg-white border-l border-slate-200">
                    {/* Top Navbar */}
                    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-200">
                                <AvatarImage src="" />
                                <AvatarFallback className="bg-slate-100 text-slate-600">
                                    <User className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900 leading-none">{fullName}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{role}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
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
