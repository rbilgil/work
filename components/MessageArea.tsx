import { useMutation, useQuery } from "convex/react";
import { Hash, MessageSquare, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import IntegrationsModal from "./IntegrationsModal";
import MessageComposer from "./MessageComposer";
import MessageItem from "./MessageItem";
import { Button } from "./ui/button";

interface MessageAreaProps {
	workspaceId: Id<"workspaces">;
	organizationId: Id<"organizations">;
	onOpenThread: (messageId: Id<"workspace_messages">) => void;
}

export default function MessageArea({
	workspaceId,
	organizationId,
	onOpenThread,
}: MessageAreaProps) {
	const workspace = useQuery(api.workspaces.getWorkspace, { id: workspaceId });
	const messages = useQuery(api.workspaces.listMessages, { workspaceId });
	const sendMessage = useMutation(api.workspaces.createMessage);

	// Slack connection status
	const slackConnection = useQuery(api.slack.getSlackConnection, { organizationId });
	const linkedSlackChannel = useQuery(api.slack.getLinkedSlackChannel, { workspaceId });
	const userSlackConnection = useQuery(api.slack.getUserSlackConnection, { organizationId });
	const initiateUserSlackOAuth = useMutation(api.slack.initiateUserSlackOAuth);

	const [settingsOpen, setSettingsOpen] = useState(false);
	const [connectingSlack, setConnectingSlack] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages?.length]);

	const handleSend = async (content: string) => {
		await sendMessage({ workspaceId, content });
	};

	const handleConnectUserSlack = async () => {
		setConnectingSlack(true);
		try {
			const { authUrl } = await initiateUserSlackOAuth({ organizationId });
			window.location.href = authUrl;
		} catch (error) {
			console.error("Failed to initiate user Slack OAuth:", error);
			alert("Failed to connect Slack. Please try again.");
			setConnectingSlack(false);
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="p-4 border-b border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-950">
				<h1 className="text-lg font-semibold flex items-center gap-2">
					{workspace?.icon && <span>{workspace.icon}</span>}
					{workspace?.name}
				</h1>
				{workspace?.description && (
					<p className="text-sm text-slate-500 mt-0.5">
						{workspace.description}
					</p>
				)}
			</div>

			{/* Slack Connection Banners */}
			{slackConnection !== undefined && !linkedSlackChannel && (
				<div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200/50 dark:border-purple-500/20">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
							<MessageSquare className="w-4 h-4" />
							{slackConnection?.connected ? (
								<span>Link a Slack channel to sync messages</span>
							) : (
								<span>Connect Slack to sync chat with your team</span>
							)}
						</div>
						<Button
							variant="outline"
							size="sm"
							className="shrink-0 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/50"
							onClick={() => setSettingsOpen(true)}
						>
							{slackConnection?.connected ? (
								<>
									<Hash className="w-3.5 h-3.5 mr-1.5" />
									Link Channel
								</>
							) : (
								<>
									<MessageSquare className="w-3.5 h-3.5 mr-1.5" />
									Connect Slack
								</>
							)}
						</Button>
					</div>
				</div>
			)}

			{/* User Slack Connection Banner - show when channel linked but user not connected */}
			{linkedSlackChannel && userSlackConnection !== undefined && !userSlackConnection.connected && (
				<div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200/50 dark:border-blue-500/20">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
							<User className="w-4 h-4" />
							<span>Connect your Slack account so messages appear as you</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="shrink-0 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"
							onClick={handleConnectUserSlack}
							disabled={connectingSlack}
						>
							<User className="w-3.5 h-3.5 mr-1.5" />
							{connectingSlack ? "Connecting..." : "Connect Account"}
						</Button>
					</div>
				</div>
			)}

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-3">
				{messages?.length === 0 && (
					<div className="text-center text-slate-500 py-8">
						<p>No messages yet.</p>
						<p className="text-sm opacity-70 mt-1">
							Start the conversation below!
						</p>
					</div>
				)}
				{messages?.map((message) => (
					<MessageItem
						key={message._id}
						message={message}
						onOpenThread={() => onOpenThread(message._id)}
					/>
				))}
				<div ref={messagesEndRef} />
			</div>

			{/* Composer */}
			<MessageComposer
				onSend={handleSend}
				placeholder={`Message ${workspace?.name || "workspace"}...`}
			/>

			{/* Integrations Modal */}
			<IntegrationsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				organizationId={organizationId}
				workspaceId={workspaceId}
			/>
		</div>
	);
}
