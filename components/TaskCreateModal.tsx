import { useMutation } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";

interface TaskCreateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaceId: Id<"workspaces">;
	initialStatus?: Status;
}

export default function TaskCreateModal({
	open,
	onOpenChange,
	workspaceId,
	initialStatus = "todo",
}: TaskCreateModalProps) {
	const [prompt, setPrompt] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const createTodoFromPrompt = useMutation(api.workspaces.createWorkspaceTodoFromPrompt);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!prompt.trim()) return;

		setIsCreating(true);
		try {
			await createTodoFromPrompt({
				workspaceId,
				prompt: prompt.trim(),
				status: initialStatus,
			});
			setPrompt("");
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to create task:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Create Task</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Describe what you want to accomplish..."
							className="min-h-[100px] resize-none"
							autoFocus
						/>
						<p className="text-xs text-slate-500 mt-2">
							AI will generate a title, link relevant context, create a description, and build an implementation plan.
						</p>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!prompt.trim() || isCreating}>
							{isCreating ? "Creating..." : "Create Task"}
						</Button>
					</div>
					<p className="text-xs text-slate-400">
						Press Cmd+Enter to create
					</p>
				</form>
			</DialogContent>
		</Dialog>
	);
}
