
export default function CRMLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">CRM</h1>
                    <p className="text-slate-500">Manage your customers and pipeline.</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                {children}
            </div>
        </div>
    );
}
