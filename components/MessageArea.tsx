import { useQuery, useMutation } from "convex/react";
import { useRef, useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import MessageItem from "./MessageItem";
import MessageComposer from "./MessageComposer";

interface MessageAreaProps {
	workspaceId: Id<"workspaces">;
	onOpenThread: (messageId: Id<"workspace_messages">) => void;
}

export default function MessageArea({
	workspaceId,
	onOpenThread,
}: MessageAreaProps) {
	const workspace = useQuery(api.workspaces.getWorkspace, { id: workspaceId });
	const messages = useQuery(api.workspaces.listMessages, { workspaceId });
	const sendMessage = useMutation(api.workspaces.createMessage);

	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages?.length]);

	const handleSend = async (content: string) => {
		await sendMessage({ workspaceId, content });
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
		</div>
	);
}
