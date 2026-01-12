"use client";

import { useMutation, useQuery } from "convex/react";
import { Bot, Loader2, Send, User } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface TodoCommentsProps {
	todoId: Id<"workspace_todos">;
}

export default function TodoComments({ todoId }: TodoCommentsProps) {
	const [newComment, setNewComment] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const comments = useQuery(api.todoComments.listTodoComments, { todoId });
	const createComment = useMutation(api.todoComments.createTodoComment);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newComment.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			await createComment({
				todoId,
				content: newComment.trim(),
			});
			setNewComment("");
		} catch (error) {
			console.error("Failed to create comment:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	// Check if any comment is from agent and is "thinking"
	const hasAgentThinking = comments?.some(
		(c) => c.authorType === "user" && c.mentionsAgent,
	) && !comments?.some(
		(c, i, arr) => {
			const prevComment = arr[i - 1];
			return c.authorType === "agent" && prevComment?.mentionsAgent;
		},
	);

	// Check if the last user comment mentions agent and there's no agent response after it
	const lastUserMentionIdx = comments?.findLastIndex(
		(c) => c.authorType === "user" && c.mentionsAgent,
	);
	const lastAgentResponseIdx = comments?.findLastIndex(
		(c) => c.authorType === "agent",
	);
	const isAgentThinking =
		lastUserMentionIdx !== undefined &&
		lastUserMentionIdx !== -1 &&
		(lastAgentResponseIdx === undefined ||
			lastAgentResponseIdx === -1 ||
			lastAgentResponseIdx < lastUserMentionIdx);

	return (
		<div className="flex flex-col gap-3">
			{/* Comment list */}
			{comments && comments.length > 0 && (
				<ScrollArea className="max-h-64 pr-2">
					<div className="space-y-3">
						{comments.map((comment) => (
							<CommentItem key={comment._id} comment={comment} />
						))}
						{isAgentThinking && (
							<div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-l-2 border-purple-500">
								<Bot className="w-4 h-4 text-purple-500" />
								<span className="text-sm text-purple-600 dark:text-purple-400">
									Agent is thinking...
								</span>
								<Loader2 className="w-3 h-3 animate-spin text-purple-500" />
							</div>
						)}
					</div>
				</ScrollArea>
			)}

			{comments?.length === 0 && (
				<p className="text-sm text-slate-500 text-center py-4">
					No comments yet. Use @Agent to ask questions about the plan.
				</p>
			)}

			{/* Comment input */}
			<form onSubmit={handleSubmit} className="flex gap-2">
				<Textarea
					value={newComment}
					onChange={(e) => setNewComment(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Add a comment... Use @Agent to request plan changes"
					className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm"
				/>
				<Button
					type="submit"
					size="icon"
					disabled={!newComment.trim() || isSubmitting}
					className="h-auto"
				>
					{isSubmitting ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<Send className="w-4 h-4" />
					)}
				</Button>
			</form>
			<p className="text-xs text-slate-400">
				Press Cmd+Enter to send
			</p>
		</div>
	);
}

interface CommentItemProps {
	comment: {
		_id: Id<"todo_comments">;
		content: string;
		authorType: "user" | "agent";
		mentionsAgent: boolean;
		createdAt: number;
	};
}

function CommentItem({ comment }: CommentItemProps) {
	const isAgent = comment.authorType === "agent";

	return (
		<div
			className={cn(
				"p-3 rounded-lg",
				isAgent
					? "bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-500"
					: "bg-slate-50 dark:bg-slate-800",
			)}
		>
			<div className="flex items-center gap-2 mb-1.5">
				{isAgent ? (
					<Bot className="w-4 h-4 text-purple-500" />
				) : (
					<User className="w-4 h-4 text-slate-500" />
				)}
				<span className="text-xs font-medium">
					{isAgent ? "Agent" : "You"}
				</span>
				<span className="text-xs text-slate-400">
					{new Date(comment.createdAt).toLocaleString()}
				</span>
			</div>
			<div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
				<ReactMarkdown>{comment.content}</ReactMarkdown>
			</div>
		</div>
	);
}
