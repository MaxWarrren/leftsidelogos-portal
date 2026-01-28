"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

type Member = {
    user_id: string;
    profiles: {
        id: string;
        full_name: string;
        role: string;
        created_at: string;
    };
};

type Organization = {
    name: string;
};

export default function ClientMembersPage() {
    const { id: orgId } = useParams();
    const router = useRouter();
    const supabase = createClient();
    const [members, setMembers] = useState<Member[]>([]);
    const [org, setOrg] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!orgId) return;

            // Fetch Org Name
            const { data: orgData } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', orgId)
                .single();
            setOrg(orgData);

            // 1. Fetch Member IDs first
            const { data: membersData, error: membersError } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', orgId);

            if (membersError) {
                console.error("Error fetching members:", membersError);
                setIsLoading(false);
                return;
            }

            if (membersData && membersData.length > 0) {
                const userIds = membersData.map(m => m.user_id);

                // 2. Fetch Profiles for those IDs
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, role, created_at')
                    .in('id', userIds);

                if (profilesError) {
                    console.error("Error fetching profiles:", profilesError);
                } else {
                    // unexpected formatting errors can occur if we rely on precise db ordering, 
                    // but functionally this list represents the members.
                    const combined = (profilesData || []).map(p => ({
                        user_id: p.id,
                        profiles: p
                    }));
                    setMembers(combined as any);
                }
            } else {
                setMembers([]);
            }
            setIsLoading(false);
        };

        fetchData();
    }, [orgId, supabase]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="hover:bg-slate-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {org ? `${org.name} Members` : "Client Members"}
                    </h1>
                    <p className="text-slate-500">View all users associated with this organization.</p>
                </div>
            </div>

            <Card className="bg-white border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-slate-400" />
                        Active Portal Users
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="pl-6">Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right pr-6">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="p-12 text-center text-slate-400">
                                        Loading members...
                                    </TableCell>
                                </TableRow>
                            ) : members.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="p-12 text-center text-slate-500 italic">
                                        No members joined this portal yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.user_id} className="hover:bg-slate-50 transition-colors border-slate-100">
                                        <TableCell className="pl-6 font-semibold text-slate-900">
                                            {member.profiles?.full_name || "New User"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-bold uppercase text-[10px] px-2 py-0.5 border-slate-200 text-slate-600 bg-slate-50">
                                                {member.profiles?.role || 'customer'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                {member.profiles?.created_at ? format(new Date(member.profiles.created_at), 'MMM d, yyyy') : "N/A"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-bold text-[10px] uppercase">
                                                Active
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
