"use client";

import { useMutation, useQuery } from "convex/react";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "../../../convex/_generated/api";

export default function OnboardingPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	// This mutation creates the user + org if they don't exist
	const ensureUser = useMutation(api.organizations.ensureUser);
	const completeOnboarding = useMutation(api.organizations.completeOnboarding);

	// Create user+org on page load
	useEffect(() => {
		ensureUser();
	}, [ensureUser]);

	// Check onboarding status (will return data once user+org exist)
	const onboardingStatus = useQuery(api.organizations.needsOnboarding);

	// Redirect if onboarding is already complete
	useEffect(() => {
		if (onboardingStatus && !onboardingStatus.needsOnboarding) {
			router.replace("/app");
		}
	}, [onboardingStatus, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || saving) return;
		if (!onboardingStatus || !onboardingStatus.needsOnboarding) return;

		setError("");
		setSaving(true);
		try {
			await completeOnboarding({
				organizationId: onboardingStatus.organizationId,
				name: name.trim(),
			});
			router.replace("/app");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create organization",
			);
		} finally {
			setSaving(false);
		}
	};

	// Show loading while creating user or checking status
	if (!onboardingStatus || !onboardingStatus.needsOnboarding) {
		return (
			<div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/* Header */}
				<div className="text-center mb-8">
					<div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
						<Building2 className="w-8 h-8 text-white" />
					</div>
					<h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
						Welcome to Whirl! 🌪️
					</h1>
					<p className="text-slate-600 dark:text-slate-400">
						Let&apos;s set up your base of operations.
					</p>
				</div>

				{/* Form */}
				<form
					onSubmit={handleSubmit}
					className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-white/10 p-6 shadow-sm"
				>
					<div className="mb-6">
						<label
							htmlFor="org-name"
							className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
						>
							Organization Name
						</label>
						<Input
							id="org-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Acme Inc, My Team, or your name"
							autoFocus
							className="h-11"
						/>
						<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
							This is where your workspaces and team members will live.
						</p>
					</div>

					{error && (
						<div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
							{error}
						</div>
					)}

					<Button
						type="submit"
						className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
						disabled={!name.trim() || saving}
					>
						{saving ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Creating...
							</>
						) : (
							<>
								<Sparkles className="w-4 h-4 mr-2" />
								Get Started
							</>
						)}
					</Button>
				</form>

				{/* Footer hint */}
				<p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
					You can always change this later in settings.
				</p>
			</div>
		</div>
	);
}
