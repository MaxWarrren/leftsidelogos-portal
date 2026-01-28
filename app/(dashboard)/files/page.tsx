"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";

type ClientFile = {
    id: string;
    title: string;
    status: string;
    file_url: string;
    type: 'Contract' | 'Invoice';
    created_at: string;
};

export default function FilesPage() {
    const supabase = createClient();
    const [files, setFiles] = useState<ClientFile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let channel: any;

        const fetchFiles = async () => {
            let match = document.cookie.match(new RegExp('(^| )active_org_id=([^;]+)'));
            let activeOrgId = match ? match[2] : null;

            if (!activeOrgId) {
                // Fallback: Fetch first org
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: membership } = await supabase
                        .from('organization_members')
                        .select('organization_id')
                        .eq('user_id', user.id)
                        .limit(1)
                        .single();

                    if (membership) activeOrgId = membership.organization_id;
                }
            }

            if (!activeOrgId) {
                setLoading(false);
                return;
            }

            const { data } = await supabase
                .from('contracts')
                .select('*')
                .eq('organization_id', activeOrgId)
                .order('created_at', { ascending: false });

            if (data) setFiles(data as any);
            setLoading(false);

            // Subscribe to real-time changes
            channel = supabase
                .channel(`customer-files-${activeOrgId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'contracts',
                    filter: `organization_id=eq.${activeOrgId}`
                }, () => {
                    // Refetch data
                    supabase
                        .from('contracts')
                        .select('*')
                        .eq('organization_id', activeOrgId)
                        .order('created_at', { ascending: false })
                        .then(({ data }) => {
                            if (data) setFiles(data as any);
                        });
                })
                .subscribe();
        };

        fetchFiles();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [supabase]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Files</h2>
                <Button className="bg-slate-900 hover:bg-slate-800">New Request</Button>
            </div>

            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg">Contract & Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 italic">
                                    <TableHead>Type</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.map((file) => (
                                    <TableRow key={file.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">
                                                {file.type || 'Contract'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-900">{file.title}</TableCell>
                                        <TableCell className="text-slate-600 text-xs">
                                            {format(new Date(file.created_at), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`
                                                font-bold uppercase text-[10px] px-3
                                                ${file.status === 'signed' || file.status === 'paid' ? 'border-green-200 bg-green-50 text-green-700' : ''}
                                                ${file.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}
                                                ${file.status === 'rejected' || file.status === 'overdue' ? 'border-red-200 bg-red-50 text-red-700' : ''}
                                            `}>
                                                {file.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-600">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {file.file_url && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-600">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {files.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="p-12 text-center text-slate-500 italic">
                                            No files found for this organization.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
