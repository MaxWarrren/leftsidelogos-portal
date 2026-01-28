"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { MediaGallery } from "@/components/media/media-gallery";
import { Loader2 } from "lucide-react";

export default function MediaPage() {
    const supabase = createClient();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getOrg = async () => {
            // Get active org from cookie (consistent with dashboard layout)
            const cookieValue = document.cookie
                .split("; ")
                .find((row) => row.startsWith("active_org_id="))
                ?.split("=")[1];

            if (cookieValue) {
                setOrgId(cookieValue);
                setLoading(false);
                return;
            }

            // Fallback: Fetch first org
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: membership } = await supabase
                    .from('organization_members')
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .limit(1)
                    .single();

                if (membership) setOrgId(membership.organization_id);
            }
            setLoading(false);
        };
        getOrg();
    }, [supabase]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <p>No organization found. Please join an organization first.</p>
            </div>
        );
    }

    return <MediaGallery organizationId={orgId} />;
}
