"use client";

import { SignIn } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
	return (
		<div className="min-h-screen bg-[#0a0a0f] flex flex-col">
			{/* Background effects */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px]" />
				<div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[120px]" />
				<div className="absolute inset-0 grid-pattern opacity-30" />
			</div>

			{/* Header */}
			<header className="relative z-10 p-6">
				<Link href="/" className="flex items-center gap-2 w-fit">
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-500 flex items-center justify-center">
						<Sparkles className="w-5 h-5 text-white" />
					</div>
					<span className="text-xl font-bold text-white">Whirl</span>
				</Link>
			</header>

			{/* Auth container */}
			<main className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
				<div className="w-full max-w-md">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold text-white mb-2">
							Welcome back
						</h1>
						<p className="text-white/50">
							Sign in to your account to continue building
						</p>
					</div>
					<SignIn
						appearance={{
							elements: {
								rootBox: "w-full",
								card: "bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-purple-500/10",
								headerTitle: "text-white",
								headerSubtitle: "text-white/60",
								socialButtonsBlockButton:
									"bg-white/10 border-white/10 text-white hover:bg-white/20 transition-colors",
								socialButtonsBlockButtonText: "text-white font-medium",
								dividerLine: "bg-white/10",
								dividerText: "text-white/40",
								formFieldLabel: "text-white/70",
								formFieldInput:
									"bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500 focus:ring-purple-500/20",
								formButtonPrimary:
									"bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-medium transition-all",
								footerActionLink:
									"text-purple-400 hover:text-purple-300 transition-colors",
								footerActionText: "text-white/50",
								identityPreviewText: "text-white",
								identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
								formFieldAction: "text-purple-400 hover:text-purple-300",
								alertText: "text-white/80",
								formFieldErrorText: "text-red-400",
							},
							layout: {
								socialButtonsPlacement: "top",
								socialButtonsVariant: "blockButton",
							},
						}}
						redirectUrl="/app"
						signUpUrl="/sign-up"
					/>
				</div>
			</main>
		</div>
	);
}
