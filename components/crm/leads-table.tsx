"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { FileText, ExternalLink } from "lucide-react";

interface Lead {
    id: string;
    created_at: string;
    name: string;
    email: string;
    company: string | null;
    status: string;
    summary: string | null;
    details: any;
    file_paths: string[] | null;
}

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700 hover:bg-blue-100/80';
            case 'contacted': return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80';
            case 'converted': return 'bg-green-100 text-green-700 hover:bg-green-100/80';
            case 'closed': return 'bg-gray-100 text-gray-700 hover:bg-gray-100/80';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                No leads found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        leads.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                                <TableCell className="whitespace-nowrap font-medium">
                                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{lead.name}</span>
                                        <span className="text-xs text-slate-500">{lead.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{lead.company || '-'}</TableCell>
                                <TableCell>
                                    <Badge className={`${getStatusColor(lead.status)} border-none shadow-none`}>
                                        {lead.status.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate text-slate-500">
                                    {lead.summary || 'No summary available.'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">View</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Lead Details</span>
                            {selectedLead && (
                                <Badge className={getStatusColor(selectedLead.status)}>
                                    {selectedLead.status.toUpperCase()}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLead && (
                        <ScrollArea className="flex-1 pr-4">
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Contact Info</h3>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <span className="block text-slate-400 text-xs">Name</span>
                                            <span className="font-medium">{selectedLead.name}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-xs">Email</span>
                                            <span className="font-medium">{selectedLead.email}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-xs">Company</span>
                                            <span className="font-medium">{selectedLead.company || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">AI Summary</h3>
                                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg">
                                        {selectedLead.summary || "No summary available."}
                                    </p>
                                </div>
                            </div>

                            {selectedLead.file_paths && selectedLead.file_paths.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Attachments</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedLead.file_paths.map((path, idx) => (
                                            <a
                                                key={idx}
                                                // Note: This requires a signed URL generation or public bucket. 
                                                // For MVP with private bucket, we might need a download API. 
                                                // But typically for admin we can generate a signed URL on the fly or just link if public.
                                                // Assuming we need to implement a 'download' action or similar.
                                                // addressing this simply for now:
                                                href="#"
                                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                                            >
                                                <FileText size={14} />
                                                <span>Attachment {idx + 1}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Order Specifications</h3>
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                    <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap">
                                        {JSON.stringify(selectedLead.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
