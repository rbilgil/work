import { useAction, useMutation } from "convex/react";
import { Bot, RefreshCw, Sparkles, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Status = "backlog" | "todo" | "in_progress" | "done";

interface TaskDetailModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaceId: Id<"workspaces">;
	todo: {
		_id: Id<"workspace_todos">;
		title: string;
		description?: string;
		status: Status;
		assignee?: "user" | "agent";
		agentPrompt?: string;
	};
}

export default function TaskDetailModal({
	open,
	onOpenChange,
	workspaceId,
	todo,
}: TaskDetailModalProps) {
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [title, setTitle] = useState(todo.title);
	const [description, setDescription] = useState(todo.description ?? "");
	const [status, setStatus] = useState<Status>(todo.status);

	const generateDescription = useAction(
		api.workspaceAi.generateTaskDescription,
	);
	const updateTodo = useMutation(api.workspaces.updateWorkspaceTodo);
	const queueForAgent = useMutation(api.workspaces.queueTodoForAgent);

	// Reset form when todo changes
	useEffect(() => {
		setTitle(todo.title);
		setDescription(todo.description ?? "");
		setStatus(todo.status);
	}, [todo]);

	const handleRegenerate = async () => {
		setIsRegenerating(true);
		try {
			const result = await generateDescription({
				workspaceId,
				todoId: todo._id,
				taskTitle: title,
			});

			let fullDescription = result.description;
			if (result.suggestedSteps && result.suggestedSteps.length > 0) {
				fullDescription +=
					"\n\n**Steps:**\n" +
					result.suggestedSteps
						.map((s: string, i: number) => `${i + 1}. ${s}`)
						.join("\n");
			}

			setDescription(fullDescription);
		} catch (error) {
			console.error("Failed to regenerate description:", error);
		} finally {
			setIsRegenerating(false);
		}
	};

	const handleSave = async () => {
		await updateTodo({
			id: todo._id,
			title,
			description,
			status,
		});
		onOpenChange(false);
	};

	const handleQueueForAgent = async () => {
		await queueForAgent({ id: todo._id });
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="w-5 h-5 text-blue-500" />
						Task Details
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto space-y-4 pr-2">
					{/* Title */}
					<div>
						<label
							htmlFor="task-title"
							className="text-sm font-medium block mb-1.5"
						>
							Title
						</label>
						<Input
							id="task-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Task title..."
						/>
					</div>

					{/* Status */}
					<div>
						<label
							htmlFor="task-status"
							className="text-sm font-medium block mb-1.5"
						>
							Status
						</label>
						<Select
							value={status}
							onValueChange={(v) => setStatus(v as Status)}
						>
							<SelectTrigger id="task-status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="backlog">Backlog</SelectItem>
								<SelectItem value="todo">To Do</SelectItem>
								<SelectItem value="in_progress">In Progress</SelectItem>
								<SelectItem value="done">Done</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Description */}
					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label htmlFor="task-desc" className="text-sm font-medium">
								Description
							</label>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRegenerate}
								disabled={isRegenerating}
							>
								<RefreshCw
									className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`}
								/>
								{isRegenerating ? "Generating..." : "Regenerate with AI"}
							</Button>
						</div>
						<Textarea
							id="task-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Task description... (AI will auto-generate from chat context)"
							className="min-h-[150px] resize-none"
						/>
						<p className="text-xs text-slate-500 mt-1">
							AI uses your workspace chat to generate detailed task
							descriptions.
						</p>
					</div>

					{/* Assignee Status */}
					<div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-white/10">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm">
								<span className="text-slate-500">Assigned to:</span>
								{todo.assignee === "agent" ? (
									<span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium">
										<Bot className="w-4 h-4" />
										Agent
										<span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
									</span>
								) : todo.assignee === "user" ? (
									<span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
										<User className="w-4 h-4" />
										You
									</span>
								) : (
									<span className="text-slate-400">Unassigned</span>
								)}
							</div>
						</div>

						{todo.agentPrompt && (
							<div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
								<p className="text-xs font-medium text-slate-500 mb-1">
									Agent Prompt:
								</p>
								<p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">
									{todo.agentPrompt}
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="flex justify-between pt-4 border-t border-slate-200 dark:border-white/10 mt-4">
					<Button
						variant="outline"
						onClick={handleQueueForAgent}
						disabled={todo.assignee === "agent"}
						className="gap-2"
					>
						<Bot className="w-4 h-4" />
						{todo.assignee === "agent" ? "Already Queued" : "Queue for Agent"}
					</Button>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave}>Save Changes</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
