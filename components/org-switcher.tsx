"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setActiveOrganization } from "@/app/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Organization = {
    id: string;
    name: string;
};

interface OrgSwitcherProps {
    organizations: Organization[];
    currentOrgId?: string;
}

export function OrgSwitcher({ organizations, currentOrgId }: OrgSwitcherProps) {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    const currentOrg = organizations.find((org) => org.id === currentOrgId) || organizations[0];

    // If we have an org but no cookie matches (or first load), we might want to sync strict equality in parent, 
    // but visual display defaults to first available if match fails is safe.

    const onSelectOrg = (orgId: string) => {
        setActiveOrganization(orgId);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between border-slate-200 hover:bg-slate-50 text-slate-900 font-medium"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Avatar className="h-5 w-5 border border-slate-200">
                            <AvatarFallback className="text-[10px] bg-slate-900 text-white">
                                {currentOrg?.name?.substring(0, 1).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{currentOrg?.name || "Select Organization"}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search organization..." />
                    <CommandList>
                        <CommandEmpty>No organization found.</CommandEmpty>
                        <CommandGroup heading="My Organizations">
                            {organizations.map((org) => (
                                <CommandItem
                                    key={org.id}
                                    value={org.name}
                                    onSelect={() => onSelectOrg(org.id)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentOrgId === org.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {org.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem onSelect={() => {
                                setOpen(false);
                                router.push('/join');
                            }} className="cursor-pointer">
                                <Plus className="mr-2 h-4 w-4" />
                                Join Organization
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
