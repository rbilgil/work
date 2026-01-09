"use client";

import { SignUp } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
	return (
		<div className="min-h-screen bg-[#0a0a0f] flex flex-col">
			{/* Background effects */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px]" />
				<div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[120px]" />
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
							Create your account
						</h1>
						<p className="text-white/50">
							Start building products faster with AI agents
						</p>
					</div>
					<SignUp
						appearance={{
							elements: {
								rootBox: "w-full",
								card: "bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-cyan-500/10",
								headerTitle: "text-white",
								headerSubtitle: "text-white/60",
								socialButtonsBlockButton:
									"bg-white/10 border-white/10 text-white hover:bg-white/20 transition-colors",
								socialButtonsBlockButtonText: "text-white font-medium",
								dividerLine: "bg-white/10",
								dividerText: "text-white/40",
								formFieldLabel: "text-white/70",
								formFieldInput:
									"bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500 focus:ring-cyan-500/20",
								formButtonPrimary:
									"bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-medium transition-all",
								footerActionLink:
									"text-cyan-400 hover:text-cyan-300 transition-colors",
								footerActionText: "text-white/50",
								identityPreviewText: "text-white",
								identityPreviewEditButton: "text-cyan-400 hover:text-cyan-300",
								formFieldAction: "text-cyan-400 hover:text-cyan-300",
								alertText: "text-white/80",
								formFieldErrorText: "text-red-400",
							},
							layout: {
								socialButtonsPlacement: "top",
								socialButtonsVariant: "blockButton",
							},
						}}
						redirectUrl="/app"
						signInUrl="/sign-in"
					/>
				</div>
			</main>

			{/* Features teaser */}
			<footer className="relative z-10 p-6 border-t border-white/5">
				<div className="max-w-md mx-auto">
					<p className="text-center text-sm text-white/40 mb-4">
						What you&apos;ll get with Whirl
					</p>
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<div className="text-lg font-semibold text-white">24/7</div>
							<div className="text-xs text-white/40">Agent availability</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-white">10x</div>
							<div className="text-xs text-white/40">Faster shipping</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-white">Free</div>
							<div className="text-xs text-white/40">To get started</div>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
