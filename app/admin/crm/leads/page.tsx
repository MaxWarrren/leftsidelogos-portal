
import { createClient } from "@/utils/supabase/server";
import { LeadsTable } from "@/components/crm/leads-table"; // We will create this next

export default async function LeadsPage() {
    const supabase = await createClient();
    const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <LeadsTable initialLeads={leads || []} />
        </div>
    );
}
