"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Profile {
    id: string;
    created_at: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
    role: string;
    organization_members?: {
        organizations: {
            name: string;
        } | null;
    }[];
}

export function PortalUsersTable({ initialUsers }: { initialUsers: Profile[] }) {
    const [users, setUsers] = useState<Profile[]>(initialUsers);

    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Joined</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No active users found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        users.map((user) => {
                            const userOrgs = user.role === 'admin'
                                ? []
                                : (user.organization_members?.map(m => m.organizations?.name).filter(Boolean) || []);

                            return (
                                <TableRow key={user.id} className="hover:bg-slate-50/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.avatar_url || undefined} />
                                                <AvatarFallback>{user.full_name?.[0] || 'U'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{user.full_name || 'Unknown User'}</span>
                                                <span className="text-xs text-slate-500">{user.email || 'No email synced'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {userOrgs.length > 0 ? (
                                                userOrgs.map((org, i) => (
                                                    <Badge key={i} variant="secondary" className="font-normal">
                                                        {org}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-slate-500 whitespace-nowrap">
                                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
