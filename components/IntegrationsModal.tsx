"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	Check,
	ExternalLink,
	FileText,
	GitBranch,
	Github,
	Hash,
	Key,
	Loader2,
	MessageSquare,
	Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import RepoSelector from "@/components/RepoSelector";
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
	const [notionApiKey, setNotionApiKey] = useState("");
	const [savingNotion, setSavingNotion] = useState(false);
	const [selectedRepo, setSelectedRepo] = useState<{
		owner: string;
		name: string;
		defaultBranch: string;
	} | null>(null);
	const [savingRepo, setSavingRepo] = useState(false);
	const [slackChannels, setSlackChannels] = useState<
		Array<{ id: string; name: string; isPrivate: boolean; memberCount: number }>
	>([]);
	const [loadingChannels, setLoadingChannels] = useState(false);
	const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
	const [savingChannel, setSavingChannel] = useState(false);

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
	const removeIntegration = useMutation(api.integrations.removeIntegration);
	const connectRepo = useMutation(api.integrations.connectRepoToWorkspace);
	const disconnectRepo = useMutation(api.integrations.disconnectRepo);
	const initiateGitHubOAuth = useMutation(api.integrations.initiateGitHubOAuth);
	const initiateNotionOAuth = useMutation(api.integrations.initiateNotionOAuth);
	const saveNotionApiKey = useMutation(api.integrations.saveNotionApiKey);

	// Slack integration
	const slackConnection = useQuery(
		api.slack.getSlackConnection,
		organizationId ? { organizationId } : "skip",
	);
	const linkedSlackChannel = useQuery(
		api.slack.getLinkedSlackChannel,
		workspaceId ? { workspaceId } : "skip",
	);
	const initiateSlackOAuth = useMutation(api.slack.initiateSlackOAuth);
	const removeSlackIntegration = useMutation(api.slack.removeSlackIntegration);
	const fetchSlackChannels = useAction(api.slack.fetchSlackChannels);
	const linkSlackChannel = useMutation(api.slack.linkSlackChannel);
	const unlinkSlackChannel = useMutation(api.slack.unlinkSlackChannel);

	// Handle OAuth callbacks (success/error messages only - tokens are stored server-side)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const githubConnected = params.get("github_connected");
		const githubError = params.get("github_error");
		const notionConnected = params.get("notion_connected");
		const notionError = params.get("notion_error");
		const slackConnected = params.get("slack_connected");
		const slackError = params.get("slack_error");

		if (githubConnected === "true" || githubError || notionConnected === "true" || notionError || slackConnected === "true" || slackError) {
			// Clean up URL params
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete("github_connected");
			newUrl.searchParams.delete("github_error");
			newUrl.searchParams.delete("notion_connected");
			newUrl.searchParams.delete("notion_error");
			newUrl.searchParams.delete("slack_connected");
			newUrl.searchParams.delete("slack_error");
			window.history.replaceState({}, "", newUrl.toString());

			if (githubError) {
				alert(`GitHub connection failed: ${githubError}`);
			}
			if (notionError) {
				alert(`Notion connection failed: ${notionError}`);
			}
			if (slackError) {
				alert(`Slack connection failed: ${slackError}`);
			}
		}
	}, []);

	// Pre-fill repo if already connected
	useEffect(() => {
		if (workspaceRepo) {
			setSelectedRepo({
				owner: workspaceRepo.owner,
				name: workspaceRepo.repo,
				defaultBranch: workspaceRepo.defaultBranch,
			});
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

	const handleSaveNotionKey = async () => {
		if (!organizationId || !notionApiKey.trim()) return;
		setSavingNotion(true);
		try {
			await saveNotionApiKey({ organizationId, apiKey: notionApiKey.trim() });
			setNotionApiKey("");
		} finally {
			setSavingNotion(false);
		}
	};

	const handleConnectNotion = async () => {
		if (!organizationId) return;
		try {
			// Initiate OAuth flow via mutation - this creates a state in the DB for CSRF protection
			const { authUrl } = await initiateNotionOAuth({ organizationId });
			window.location.href = authUrl;
		} catch (error) {
			console.error("Failed to initiate Notion OAuth:", error);
			alert("Failed to initiate Notion connection. Please try again.");
		}
	};

	const handleDisconnectNotion = async () => {
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
		if (!workspaceId || !selectedRepo) return;
		setSavingRepo(true);
		try {
			await connectRepo({
				workspaceId,
				owner: selectedRepo.owner,
				repo: selectedRepo.name,
				defaultBranch: selectedRepo.defaultBranch,
			});
		} finally {
			setSavingRepo(false);
		}
	};

	const handleDisconnectRepo = async () => {
		if (!workspaceId) return;
		await disconnectRepo({ workspaceId });
		setSelectedRepo(null);
	};

	const handleConnectSlack = async () => {
		if (!organizationId) return;
		try {
			const { authUrl } = await initiateSlackOAuth({ organizationId });
			window.location.href = authUrl;
		} catch (error) {
			console.error("Failed to initiate Slack OAuth:", error);
			alert("Failed to initiate Slack connection. Please try again.");
		}
	};

	const handleDisconnectSlack = async () => {
		if (!organizationId) return;
		await removeSlackIntegration({ organizationId });
		setSlackChannels([]);
		setSelectedChannelId(null);
	};

	const handleLoadSlackChannels = async () => {
		if (!organizationId) return;
		setLoadingChannels(true);
		try {
			const channels = await fetchSlackChannels({ organizationId });
			setSlackChannels(channels);
		} catch (error) {
			console.error("Failed to load Slack channels:", error);
			alert("Failed to load Slack channels. Please try again.");
		} finally {
			setLoadingChannels(false);
		}
	};

	const handleLinkSlackChannel = async () => {
		if (!workspaceId || !selectedChannelId) return;
		const channel = slackChannels.find((c) => c.id === selectedChannelId);
		if (!channel) return;
		setSavingChannel(true);
		try {
			await linkSlackChannel({
				workspaceId,
				slackChannelId: channel.id,
				slackChannelName: channel.name,
			});
			setSelectedChannelId(null);
		} finally {
			setSavingChannel(false);
		}
	};

	const handleUnlinkSlackChannel = async () => {
		if (!workspaceId) return;
		await unlinkSlackChannel({ workspaceId });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
				<DialogHeader className="shrink-0">
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
					<div className="flex flex-col gap-6 pt-2 overflow-y-auto flex-1 pr-2">
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
								{integrations?.notion?.connected && (
									<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
										<Check className="w-3 h-3" /> Connected
									</span>
								)}
							</div>
							<p className="text-sm text-slate-500">
								Connect Notion to automatically fetch document content when
								sharing Notion links.
							</p>
							{integrations?.notion?.connected ? (
								<div className="flex items-center gap-2">
									<span className="text-sm text-slate-500">
										Notion workspace connected
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={handleDisconnectNotion}
									>
										<Unlink className="w-4 h-4 mr-1" />
										Disconnect
									</Button>
								</div>
							) : (
								<div className="flex flex-col gap-3">
									{/* Internal Integration (API Key) */}
									<div className="flex gap-2">
										<Input
											type="password"
											value={notionApiKey}
											onChange={(e) => setNotionApiKey(e.target.value)}
											placeholder="Paste internal integration secret"
											className="flex-1"
										/>
										<Button
											onClick={handleSaveNotionKey}
											disabled={!notionApiKey.trim() || savingNotion}
										>
											{savingNotion ? (
												<Loader2 className="w-4 h-4 animate-spin" />
											) : (
												"Save"
											)}
										</Button>
									</div>
									<div className="flex items-center gap-2 text-xs text-slate-400">
										<span className="flex-1 border-t border-slate-200 dark:border-slate-700" />
										<span>or connect via OAuth</span>
										<span className="flex-1 border-t border-slate-200 dark:border-slate-700" />
									</div>
									{/* OAuth Option */}
									<Button onClick={handleConnectNotion} variant="outline">
										<FileText className="w-4 h-4 mr-2" />
										Connect with Notion OAuth
									</Button>
								</div>
							)}
							<p className="text-xs text-slate-400">
								After connecting, share your Notion pages with the integration
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

						<Separator />

						{/* Slack Integration */}
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<MessageSquare className="w-5 h-5 text-purple-500" />
								<h3 className="font-medium">Slack</h3>
								{slackConnection?.connected && (
									<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
										<Check className="w-3 h-3" /> Connected
									</span>
								)}
							</div>
							<p className="text-sm text-slate-500">
								Connect Slack to sync workspace chat with a Slack channel.
							</p>
							{slackConnection?.connected ? (
								<div className="flex items-center gap-2">
									<span className="text-sm">
										Connected to{" "}
										<span className="font-medium">{slackConnection.teamName}</span>
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={handleDisconnectSlack}
									>
										<Unlink className="w-4 h-4 mr-1" />
										Disconnect
									</Button>
								</div>
							) : (
								<Button onClick={handleConnectSlack} variant="outline">
									<MessageSquare className="w-4 h-4 mr-2" />
									Connect Slack
								</Button>
							)}
						</div>

						{/* Slack Channel Link (only show if Slack is connected and workspaceId is provided) */}
						{slackConnection?.connected && workspaceId && (
							<>
								<Separator />
								<div className="flex flex-col gap-3">
									<div className="flex items-center gap-2">
										<Hash className="w-5 h-5 text-purple-500" />
										<h3 className="font-medium">Workspace Slack Channel</h3>
										{linkedSlackChannel && (
											<span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
												<Check className="w-3 h-3" /> Linked
											</span>
										)}
									</div>
									<p className="text-sm text-slate-500">
										Link a Slack channel to sync messages bi-directionally.
									</p>
									{linkedSlackChannel ? (
										<div className="flex items-center gap-2">
											<span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
												#{linkedSlackChannel.channelName}
											</span>
											<Button
												variant="outline"
												size="sm"
												onClick={handleUnlinkSlackChannel}
											>
												<Unlink className="w-4 h-4 mr-1" />
												Unlink
											</Button>
										</div>
									) : (
										<div className="flex flex-col gap-2">
											{slackChannels.length === 0 ? (
												<Button
													variant="outline"
													onClick={handleLoadSlackChannels}
													disabled={loadingChannels}
												>
													{loadingChannels ? (
														<Loader2 className="w-4 h-4 animate-spin mr-2" />
													) : (
														<Hash className="w-4 h-4 mr-2" />
													)}
													Load Channels
												</Button>
											) : (
												<>
													<select
														className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
														value={selectedChannelId || ""}
														onChange={(e) => setSelectedChannelId(e.target.value || null)}
													>
														<option value="">Select a channel...</option>
														{slackChannels.map((ch) => (
															<option key={ch.id} value={ch.id}>
																#{ch.name} ({ch.memberCount} members)
															</option>
														))}
													</select>
													{selectedChannelId && (
														<Button
															onClick={handleLinkSlackChannel}
															disabled={savingChannel}
														>
															{savingChannel ? (
																<Loader2 className="w-4 h-4 animate-spin" />
															) : (
																"Link Channel"
															)}
														</Button>
													)}
												</>
											)}
										</div>
									)}
								</div>
							</>
						)}

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
											<RepoSelector
												organizationId={organizationId}
												selectedRepo={selectedRepo}
												onSelect={setSelectedRepo}
											/>
											{selectedRepo && (
												<div className="flex justify-end">
													<Button
														onClick={handleConnectRepo}
														disabled={savingRepo}
													>
														{savingRepo ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															"Connect Repository"
														)}
													</Button>
												</div>
											)}
										</div>
									)}
								</div>
							</>
						)}
					</div>
				)}

				<div className="flex justify-end pt-4 shrink-0 border-t mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
