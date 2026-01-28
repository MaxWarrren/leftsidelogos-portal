import { createClient } from "@/utils/supabase/server";
import { ContactsTable } from "@/components/crm/customers-table";
import { PortalUsersTable } from "@/components/crm/portal-users-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function CrmPage() {
    const supabase = await createClient();

    // Fetch Contacts (Leads)
    const { data: leads } = await supabase
        .from('leads')
        .select('*, organizations(name), converted_profile_id')
        .order('created_at', { ascending: false });

    // Fetch Active Users (Profiles)
    const { data: profiles } = await supabase
        .from('profiles')
        .select(`
            *,
            organization_members (
                organizations (
                    name
                )
            )
        `)
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full space-y-6">
            <Tabs defaultValue="users" className="w-full flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="users">Active Users</TabsTrigger>
                        <TabsTrigger value="contacts">CRM Contacts</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="users" className="flex-1 flex flex-col mt-0">
                    <PortalUsersTable initialUsers={profiles || []} />
                </TabsContent>

                <TabsContent value="contacts" className="flex-1 flex flex-col mt-0">
                    <ContactsTable initialCustomers={leads || []} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
