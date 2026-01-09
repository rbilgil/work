"use client";

import { UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
			{/* App Header */}
			<header className="h-14 border-b border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-950 flex items-center justify-between px-4 sticky top-0 z-50">
				<Link href="/app" className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-500 flex items-center justify-center">
						<Sparkles className="w-4 h-4 text-white" />
					</div>
					<span className="font-semibold text-slate-900 dark:text-white">
						Whirl
					</span>
				</Link>

				<div className="flex items-center gap-4">
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
		</div>
	);
}
