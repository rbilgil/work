"use client";

import { UserButton } from "@clerk/nextjs";
import { Settings, Tornado } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import IntegrationsModal from "@/components/IntegrationsModal";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
			{/* App Header */}
			<header className="h-14 border-b border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-950 flex items-center justify-between px-4 sticky top-0 z-50">
				<Link href="/app" className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
						<Tornado className="w-4 h-4 text-white" />
					</div>
					<span className="font-semibold text-slate-900 dark:text-white">
						Whirl
					</span>
				</Link>

				<div className="flex items-center gap-2">
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

			{/* App Content */}
			<main className="flex-1 p-4">{children}</main>

			{/* Global Settings/Integrations Modal */}
			<IntegrationsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
			/>
		</div>
	);
}
