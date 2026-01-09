import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { formatRelativeTime } from "../../lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

interface MessageItemProps {
	message: {
		_id: Id<"workspace_messages">;
		content: string;
		createdAt: number;
		updatedAt?: number;
		replyCount?: number;
	};
	onOpenThread: () => void;
	isReply?: boolean;
}

export default function MessageItem({
	message,
	onOpenThread,
	isReply = false,
}: MessageItemProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className={`group rounded-lg border border-slate-200/70 dark:border-white/10 p-3 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors ${
				isReply ? "ml-6" : ""
			}`}
		>
			<div className="flex items-start gap-3">
				<div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 flex items-center justify-center text-white text-sm font-medium">
					U
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">You</span>
						<span className="text-xs text-slate-500">
							{formatRelativeTime(message.createdAt)}
						</span>
						{message.updatedAt && (
							<span className="text-xs text-slate-400">(edited)</span>
						)}
					</div>
					<div className="mt-1 text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none">
						{message.content}
					</div>

					{/* Reply button / thread indicator */}
					{!isReply && (
						<button
							type="button"
							onClick={onOpenThread}
							className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
						>
							<MessageSquare className="w-3.5 h-3.5" />
							{message.replyCount
								? `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}`
								: "Reply"}
						</button>
					)}
				</div>
			</div>
		</motion.div>
	);
}
