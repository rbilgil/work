"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Check,
	ExternalLink,
	FileText,
	GitBranch,
	Github,
	Key,
	Loader2,
	Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface IntegrationsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organizationId?: Id<"organizations">; // Required for integrations (Cursor, GitHub)
	workspaceId?: Id<"workspaces">; // Optional for repo connection
}

export default function IntegrationsModal({
	open,
	onOpenChange,
	organizationId,
	workspaceId,
}: IntegrationsModalProps) {
	const [cursorApiKey, setCursorApiKey] = useState("");
	const [savingCursor, setSavingCursor] = useState(false);
	const [notionApiToken, setNotionApiToken] = useState("");
	const [savingNotion, setSavingNotion] = useState(false);
	const [repoOwner, setRepoOwner] = useState("");
	const [repoName, setRepoName] = useState("");
	const [repoBranch, setRepoBranch] = useState("main");
	const [savingRepo, setSavingRepo] = useState(false);

	// Integrations are now organization-scoped
	const integrations = useQuery(
		api.integrations.getOrganizationIntegrations,
		organizationId ? { organizationId } : "skip",
	);
	// Repos are workspace-scoped
	const workspaceRepo = useQuery(
		api.integrations.getWorkspaceRepo,
		workspaceId ? { workspaceId } : "skip",
	);

	const saveCursorApiKey = useMutation(api.integrations.saveCursorApiKey);
	const saveNotionApiToken = useMutation(api.integrations.saveNotionApiToken);
	const removeIntegration = useMutation(api.integrations.removeIntegration);
	const connectRepo = useMutation(api.integrations.connectRepoToWorkspace);
	const disconnectRepo = useMutation(api.integrations.disconnectRepo);
	const initiateGitHubOAuth = useMutation(api.integrations.initiateGitHubOAuth);

	// Handle GitHub OAuth callback (success/error messages only - tokens are stored server-side)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const githubConnected = params.get("github_connected");
		const githubError = params.get("github_error");

		if (githubConnected === "true" || githubError) {
			// Clean up URL params
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete("github_connected");
			newUrl.searchParams.delete("github_error");
			window.history.replaceState({}, "", newUrl.toString());

			if (githubError) {
				alert(`GitHub connection failed: ${githubError}`);
			}
		}
	}, []);

	// Pre-fill repo fields if already connected
	useEffect(() => {
		if (workspaceRepo) {
			setRepoOwner(workspaceRepo.owner);
			setRepoName(workspaceRepo.repo);
			setRepoBranch(workspaceRepo.defaultBranch);
		}
	}, [workspaceRepo]);

	const handleSaveCursorKey = async () => {
		if (!organizationId || !cursorApiKey.trim()) return;
		setSavingCursor(true);
		try {
			await saveCursorApiKey({ organizationId, apiKey: cursorApiKey.trim() });
			setCursorApiKey("");
		} finally {
			setSavingCursor(false);
		}
	};

	const handleRemoveCursor = async () => {
		if (!organizationId) return;
		await removeIntegration({ organizationId, type: "cursor" });
	};

	const handleSaveNotionToken = async () => {
		if (!organizationId || !notionApiToken.trim()) return;
		setSavingNotion(true);
		try {
			await saveNotionApiToken({ organizationId, apiToken: notionApiToken.trim() });
			setNotionApiToken("");
		} finally {
			setSavingNotion(false);
		}
	};

	const handleRemoveNotion = async () => {
		if (!organizationId) return;
		await removeIntegration({ organizationId, type: "notion" });
	};

	const handleConnectGitHub = async () => {
		if (!organizationId) return;
		try {
			// Initiate OAuth flow via mutation - this creates a state in the DB for CSRF protection
			const { authUrl } = await initiateGitHubOAuth({ organizationId });
			window.location.href = authUrl;
		} catch (error) {
			console.error("Failed to initiate GitHub OAuth:", error);
			alert("Failed to initiate GitHub connection. Please try again.");
		}
	};

	const handleDisconnectGitHub = async () => {
		if (!organizationId) return;
		await removeIntegration({ organizationId, type: "github" });
	};

	const handleConnectRepo = async () => {
		if (!workspaceId || !repoOwner.trim() || !repoName.trim()) return;
		setSavingRepo(true);
		try {
			await connectRepo({
				workspaceId,
				owner: repoOwner.trim(),
				repo: repoName.trim(),
				defaultBranch: repoBranch.trim() || "main",
			});
		} finally {
			setSavingRepo(false);
		}
	};

	const handleDisconnectRepo = async () => {
		if (!workspaceId) return;
		await disconnectRepo({ workspaceId });
		setRepoOwner("");
		setRepoName("");
		setRepoBranch("main");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Integrations</DialogTitle>
					<DialogDescription>
						Connect your accounts to enable AI agent features.
					</DialogDescription>
				</DialogHeader>

				{/* Show message if no organization selected */}
				{!organizationId ? (
					<div className="flex flex-col items-center gap-4 py-8 text-center">
						<p className="text-slate-500">
							Integrations are configured per organization.
						</p>
						<p className="text-sm text-slate-400">
							Please select an organization to manage its integrations.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-6 pt-2">
						{/* Cursor Integration */}
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<Key className="w-5 h-5 text-purple-500" />
								<h3 className="font-medium">Cursor API</h3>
								{integrations?.cursor.connected && (
									<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
										<Check className="w-3 h-3" /> Connected
									</span>
								)}
							</div>
							<p className="text-sm text-slate-500">
								Connect your Cursor API key to use Cursor agents for coding
								tasks.
							</p>
							{integrations?.cursor.connected ? (
								<div className="flex items-center gap-2">
									<span className="text-sm text-slate-500">API key saved</span>
									<Button
										variant="outline"
										size="sm"
										onClick={handleRemoveCursor}
									>
										<Unlink className="w-4 h-4 mr-1" />
										Disconnect
									</Button>
								</div>
							) : (
								<div className="flex gap-2">
									<Input
										type="password"
										value={cursorApiKey}
										onChange={(e) => setCursorApiKey(e.target.value)}
										placeholder="Enter your Cursor API key"
										className="flex-1"
									/>
									<Button
										onClick={handleSaveCursorKey}
										disabled={!cursorApiKey.trim() || savingCursor}
									>
										{savingCursor ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</div>
							)}
							<a
								href="https://cursor.com/settings"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-blue-500 hover:underline flex items-center gap-1"
							>
								Get your API key from Cursor
								<ExternalLink className="w-3 h-3" />
							</a>
						</div>

						<Separator />

						{/* Notion Integration */}
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<FileText className="w-5 h-5 text-slate-700" />
								<h3 className="font-medium">Notion</h3>
								{integrations?.notion.connected && (
									<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
										<Check className="w-3 h-3" /> Connected
									</span>
								)}
							</div>
							<p className="text-sm text-slate-500">
								Connect Notion to automatically fetch document content when
								sharing Notion links.
							</p>
							{integrations?.notion.connected ? (
								<div className="flex items-center gap-2">
									<span className="text-sm text-slate-500">
										Integration token saved
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={handleRemoveNotion}
									>
										<Unlink className="w-4 h-4 mr-1" />
										Disconnect
									</Button>
								</div>
							) : (
								<div className="flex gap-2">
									<Input
										type="password"
										value={notionApiToken}
										onChange={(e) => setNotionApiToken(e.target.value)}
										placeholder="Enter your Notion integration token"
										className="flex-1"
									/>
									<Button
										onClick={handleSaveNotionToken}
										disabled={!notionApiToken.trim() || savingNotion}
									>
										{savingNotion ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</div>
							)}
							<a
								href="https://www.notion.so/my-integrations"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-blue-500 hover:underline flex items-center gap-1"
							>
								Create a Notion integration
								<ExternalLink className="w-3 h-3" />
							</a>
							<p className="text-xs text-slate-400">
								After creating an integration, share your Notion pages with it
								to enable content fetching.
							</p>
						</div>

						<Separator />

						{/* GitHub Integration */}
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<Github className="w-5 h-5" />
								<h3 className="font-medium">GitHub</h3>
								{integrations?.github.connected && (
									<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
										<Check className="w-3 h-3" /> Connected
									</span>
								)}
							</div>
							<p className="text-sm text-slate-500">
								Connect GitHub to allow agents to create PRs and track their
								status.
							</p>
							{integrations?.github.connected ? (
								<div className="flex items-center gap-2">
									<span className="text-sm">
										Connected as{" "}
										<span className="font-medium">
											@{integrations.github.username}
										</span>
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={handleDisconnectGitHub}
									>
										<Unlink className="w-4 h-4 mr-1" />
										Disconnect
									</Button>
								</div>
							) : (
								<Button onClick={handleConnectGitHub} variant="outline">
									<Github className="w-4 h-4 mr-2" />
									Connect GitHub
								</Button>
							)}
						</div>

						{/* Workspace Repository (only show if GitHub is connected and workspaceId is provided) */}
						{integrations?.github.connected && workspaceId && (
							<>
								<Separator />
								<div className="flex flex-col gap-3">
									<div className="flex items-center gap-2">
										<GitBranch className="w-5 h-5 text-green-500" />
										<h3 className="font-medium">Workspace Repository</h3>
										{workspaceRepo && (
											<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
												<Check className="w-3 h-3" /> Connected
											</span>
										)}
									</div>
									<p className="text-sm text-slate-500">
										Connect a GitHub repository for agents to work on.
									</p>
									{workspaceRepo ? (
										<div className="flex items-center gap-2">
											<span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
												{workspaceRepo.owner}/{workspaceRepo.repo}
											</span>
											<span className="text-xs text-slate-500">
												({workspaceRepo.defaultBranch})
											</span>
											<Button
												variant="outline"
												size="sm"
												onClick={handleDisconnectRepo}
											>
												<Unlink className="w-4 h-4 mr-1" />
												Disconnect
											</Button>
										</div>
									) : (
										<div className="flex flex-col gap-2">
											<div className="flex gap-2">
												<Input
													value={repoOwner}
													onChange={(e) => setRepoOwner(e.target.value)}
													placeholder="Owner (e.g., octocat)"
													className="flex-1"
												/>
												<span className="text-slate-400 self-center">/</span>
												<Input
													value={repoName}
													onChange={(e) => setRepoName(e.target.value)}
													placeholder="Repository"
													className="flex-1"
												/>
											</div>
											<div className="flex gap-2">
												<Input
													value={repoBranch}
													onChange={(e) => setRepoBranch(e.target.value)}
													placeholder="Default branch (e.g., main)"
													className="w-40"
												/>
												<Button
													onClick={handleConnectRepo}
													disabled={
														!repoOwner.trim() || !repoName.trim() || savingRepo
													}
												>
													{savingRepo ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : (
														"Connect"
													)}
												</Button>
											</div>
										</div>
									)}
								</div>
							</>
						)}
					</div>
				)}

				<div className="flex justify-end pt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
