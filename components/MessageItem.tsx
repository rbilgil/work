import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { Id } from "../convex/_generated/dataModel";

interface Replier {
	userId: Id<"users">;
	name?: string;
	slackUserName?: string;
}

interface MessageItemProps {
	message: {
		_id: Id<"workspace_messages">;
		content: string;
		createdAt: number;
		updatedAt?: number;
		replyCount?: number;
		fromSlack?: boolean;
		slackUserName?: string;
		authorName?: string;
		repliers?: Replier[];
		lastReplyAt?: number;
	};
	onOpenThread: () => void;
	isReply?: boolean;
}

// Get initials from name (up to 2 characters)
function getInitials(name?: string): string {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Generate a consistent color based on name
function getAvatarColor(name?: string): string {
	const colors = [
		"from-blue-400 to-blue-600",
		"from-green-400 to-green-600",
		"from-purple-400 to-purple-600",
		"from-pink-400 to-pink-600",
		"from-orange-400 to-orange-600",
		"from-teal-400 to-teal-600",
		"from-indigo-400 to-indigo-600",
		"from-rose-400 to-rose-600",
	];
	if (!name) return colors[0];
	const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return colors[hash % colors.length];
}

export default function MessageItem({
	message,
	onOpenThread,
	isReply = false,
}: MessageItemProps) {
	const authorName = message.authorName || message.slackUserName || "User";
	const hasReplies = (message.replyCount ?? 0) > 0;

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className={`group rounded-lg border border-slate-200/70 dark:border-white/10 p-3 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors ${
				isReply ? "ml-6" : ""
			}`}
		>
			<div className="flex items-start gap-3">
				<div
					className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(authorName)} flex-shrink-0 flex items-center justify-center text-white text-xs font-medium`}
				>
					{getInitials(authorName)}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">{authorName}</span>
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

					{/* Reply button / thread indicator - Slack style */}
					{!isReply && (
						<button
							type="button"
							onClick={onOpenThread}
							className={`mt-2 flex items-center gap-2 text-xs transition-colors rounded-md -ml-1 px-1 py-1 ${
								hasReplies
									? "hover:bg-slate-100 dark:hover:bg-slate-800"
									: "text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
							}`}
						>
							{hasReplies && message.repliers && message.repliers.length > 0 ? (
								<>
									{/* Replier avatars - stacked */}
									<div className="flex -space-x-1.5">
										{message.repliers.map((replier, i) => {
											const replierName = replier.name || replier.slackUserName;
											return (
												<div
													key={replier.userId}
													className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(replierName)} flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-white dark:ring-slate-900`}
													style={{ zIndex: message.repliers!.length - i }}
												>
													{getInitials(replierName)}
												</div>
											);
										})}
									</div>
									{/* Reply count and time */}
									<span className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
										{message.replyCount}{" "}
										{message.replyCount === 1 ? "reply" : "replies"}
									</span>
									{message.lastReplyAt && (
										<span className="text-slate-500">
											{formatRelativeTime(message.lastReplyAt)}
										</span>
									)}
								</>
							) : (
								<>
									<MessageSquare className="w-3.5 h-3.5" />
									<span>Reply</span>
								</>
							)}
						</button>
					)}
				</div>
			</div>
		</motion.div>
	);
}
