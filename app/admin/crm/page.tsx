import { createClient } from "@/utils/supabase/server";
import { LeadsTable } from "@/components/crm/leads-table";

export default async function CrmPage() {
    const supabase = await createClient();

    const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                <LeadsTable initialLeads={leads || []} />
            </div>
        </div>
    );
}
