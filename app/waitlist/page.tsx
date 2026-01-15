"use client";

import { Waitlist } from "@clerk/nextjs";
import { Tornado, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function WaitlistPage() {
	return (
		<div className="min-h-screen bg-[#FAFAF8] flex flex-col">
			{/* Subtle background */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-20 right-[20%] w-72 h-72 bg-teal-100 rounded-full blur-3xl opacity-30" />
				<div className="absolute bottom-20 left-[20%] w-96 h-96 bg-orange-100 rounded-full blur-3xl opacity-20" />
			</div>

			{/* Header */}
			<header className="relative z-10 p-6">
				<Link href="/" className="flex items-center gap-2 w-fit text-stone-500 hover:text-stone-900 transition-colors">
					<ArrowLeft className="w-4 h-4" />
					<span className="text-sm">Back to home</span>
				</Link>
			</header>

			{/* Waitlist container */}
			<main className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
				<div className="w-full max-w-md">
					<div className="text-center mb-8">
						<Link href="/" className="inline-flex items-center gap-2.5 mb-6">
							<div className="w-10 h-10 rounded-lg bg-teal-700 flex items-center justify-center">
								<Tornado className="w-5 h-5 text-white" />
							</div>
							<span className="text-xl font-semibold text-stone-900 tracking-tight">Whirl</span>
						</Link>
						<h1 className="text-2xl font-bold text-stone-900 mb-2">
							Ship while you sleep
						</h1>
						<p className="text-stone-500">
							Get early access to autonomous AI agents
						</p>
					</div>
					<div className="bg-white rounded-xl border border-stone-200 shadow-lg shadow-stone-200/50 p-1">
						<Waitlist
							appearance={{
								elements: {
									rootBox: "w-full",
									card: "bg-transparent shadow-none border-0",
									headerTitle: "text-stone-900",
									headerSubtitle: "text-stone-500",
									socialButtonsBlockButton:
										"bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 transition-colors",
									socialButtonsBlockButtonText: "text-stone-700 font-medium",
									dividerLine: "bg-stone-200",
									dividerText: "text-stone-400",
									formFieldLabel: "text-stone-600",
									formFieldInput:
										"bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-teal-500 focus:ring-teal-500/20",
									formButtonPrimary:
										"bg-terracotta hover:bg-terracotta-dark text-white font-medium transition-all shadow-sm",
									footerActionLink:
										"text-teal-600 hover:text-teal-700 transition-colors",
									footerActionText: "text-stone-500",
									identityPreviewText: "text-stone-900",
									identityPreviewEditButton: "text-teal-600 hover:text-teal-700",
									formFieldAction: "text-teal-600 hover:text-teal-700",
									alertText: "text-stone-700",
									formFieldErrorText: "text-red-500",
								},
							}}
							signInUrl="/sign-in"
						/>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="relative z-10 p-6 border-t border-stone-200">
				<div className="max-w-md mx-auto">
					<p className="text-center text-sm text-stone-400 mb-4">
						What you&apos;ll get with early access
					</p>
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<div className="text-base font-semibold text-stone-700">Priority</div>
							<div className="text-xs text-stone-400">First in line</div>
						</div>
						<div>
							<div className="text-base font-semibold text-stone-700">Free</div>
							<div className="text-xs text-stone-400">Extended access</div>
						</div>
						<div>
							<div className="text-base font-semibold text-stone-700">Input</div>
							<div className="text-xs text-stone-400">Shape the product</div>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
