"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Settings, Tornado } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import IntegrationsModal from "@/components/IntegrationsModal";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const [settingsOpen, setSettingsOpen] = useState(false);

	const organizations = useQuery(api.organizations.listMyOrganizations);
	const currentOrganization = organizations?.[0];

	return (
		<div className="grid grid-rows-[56px_1fr] h-screen">
			{/* Header */}
			<header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between px-4">
				<Link href="/app" className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
						<Tornado className="w-4 h-4 text-white" />
					</div>
					<span className="font-semibold text-slate-900 dark:text-white">
						Whirl
					</span>
				</Link>

				<div className="flex items-center gap-2">
					{currentOrganization && (
						<span className="text-sm text-slate-500 dark:text-slate-400 mr-2">
							{currentOrganization.name}
						</span>
					)}
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSettingsOpen(true)}
						className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
					>
						<Settings className="w-5 h-5" />
					</Button>
					<UserButton
						appearance={{
							elements: {
								avatarBox: "w-8 h-8",
								userButtonPopoverCard:
									"bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
								userButtonPopoverActionButton:
									"hover:bg-slate-100 dark:hover:bg-slate-800",
								userButtonPopoverActionButtonText:
									"text-slate-700 dark:text-slate-300",
								userButtonPopoverFooter: "hidden",
							},
						}}
						afterSignOutUrl="/"
					/>
				</div>
			</header>

			{/* Main Content */}
			<main className="overflow-hidden">{children}</main>

			<IntegrationsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				organizationId={currentOrganization?._id}
			/>
		</div>
	);
}
