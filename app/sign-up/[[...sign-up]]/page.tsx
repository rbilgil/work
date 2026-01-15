"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tornado } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to waitlist after a brief moment
		const timer = setTimeout(() => {
			router.push("/waitlist");
		}, 2000);
		return () => clearTimeout(timer);
	}, [router]);

	return (
		<div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center">
			{/* Subtle background */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-20 right-[20%] w-72 h-72 bg-teal-100 rounded-full blur-3xl opacity-30" />
				<div className="absolute bottom-20 left-[20%] w-96 h-96 bg-orange-100 rounded-full blur-3xl opacity-20" />
			</div>

			<div className="relative z-10 text-center px-6">
				<Link href="/" className="inline-flex items-center gap-2.5 mb-8">
					<div className="w-10 h-10 rounded-lg bg-teal-700 flex items-center justify-center">
						<Tornado className="w-5 h-5 text-white" />
					</div>
					<span className="text-xl font-semibold text-stone-900 tracking-tight">Whirl</span>
				</Link>

				<h1 className="text-2xl font-bold text-stone-900 mb-3">
					We&apos;re not quite ready yet
				</h1>
				<p className="text-stone-500 mb-6 max-w-md">
					Sign-ups are currently closed while we&apos;re in development.
					Join our waitlist to get early access.
				</p>
				<p className="text-sm text-stone-400">
					Redirecting to waitlist...
				</p>
			</div>
		</div>
	);
}
