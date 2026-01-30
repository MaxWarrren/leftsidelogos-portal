import { createClient } from "@/utils/supabase/server";
import { ContactsTable } from "@/components/crm/customers-table";
import { ContactsTable } from "@/components/crm/customers-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function CrmPage() {
    const supabase = await createClient();

    // Fetch All Leads
    const { data: allLeads } = await supabase
        .from('leads')
        .select('*, organizations(name), converted_profile_id')
        .order('created_at', { ascending: false });

    // Filter
    const newLeads = allLeads?.filter(l => l.status === 'new') || [];
    const contacts = allLeads?.filter(l => l.status !== 'new') || [];

    return (
        <div className="flex flex-col h-full space-y-6">
            <Tabs defaultValue="contacts" className="w-full flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="contacts">Contacts</TabsTrigger>
                        <TabsTrigger value="new-leads">
                            New Leads
                            {newLeads.length > 0 && (
                                <span className="ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                    {newLeads.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="contacts" className="flex-1 flex flex-col mt-0">
                    <ContactsTable initialCustomers={contacts} />
                </TabsContent>

                <TabsContent value="new-leads" className="flex-1 flex flex-col mt-0">
                    <ContactsTable initialCustomers={newLeads} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
