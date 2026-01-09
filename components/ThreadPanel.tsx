import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import MessageComposer from "./MessageComposer";
import MessageItem from "./MessageItem";

interface ThreadPanelProps {
	messageId: Id<"workspace_messages">;
	workspaceId: Id<"workspaces">;
	onClose: () => void;
}

export default function ThreadPanel({
	messageId,
	workspaceId,
	onClose,
}: ThreadPanelProps) {
	const replies = useQuery(api.workspaces.listReplies, {
		parentMessageId: messageId,
	});

	const sendReply = useMutation(api.workspaces.createMessage);

	// Fetch the parent message to display it
	const messages = useQuery(api.workspaces.listMessages, { workspaceId });
	const parentMessage = messages?.find((m) => m._id === messageId);

	const handleSendReply = async (content: string) => {
		await sendReply({
			workspaceId,
			content,
			parentMessageId: messageId,
		});
	};

	return (
		<motion.div
			initial={{ x: "100%" }}
			animate={{ x: 0 }}
			exit={{ x: "100%" }}
			transition={{ type: "spring", damping: 25, stiffness: 200 }}
			className="absolute inset-y-0 right-0 w-96 bg-white dark:bg-slate-950 border-l border-slate-200/70 dark:border-white/10 flex flex-col shadow-xl z-10"
		>
			{/* Header */}
			<div className="p-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
				<h2 className="font-semibold">Thread</h2>
				<Button variant="ghost" size="icon" onClick={onClose}>
					<X className="w-4 h-4" />
				</Button>
			</div>

			{/* Parent message */}
			{parentMessage && (
				<div className="p-4 border-b border-slate-200/70 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
					<MessageItem
						message={parentMessage}
						onOpenThread={() => {}}
						isReply
					/>
				</div>
			)}

			{/* Replies */}
			<div className="flex-1 overflow-y-auto p-4 space-y-3">
				{replies?.length === 0 && (
					<p className="text-sm text-slate-500 text-center py-4">
						No replies yet. Start the conversation!
					</p>
				)}
				{replies?.map((reply) => (
					<MessageItem
						key={reply._id}
						message={{ ...reply, replyCount: 0 }}
						onOpenThread={() => {}}
						isReply
					/>
				))}
			</div>

			{/* Reply composer */}
			<MessageComposer onSend={handleSendReply} placeholder="Reply..." />
		</motion.div>
	);
}
