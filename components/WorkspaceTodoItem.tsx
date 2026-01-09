import { useMutation, useQuery } from "convex/react";
import { Bot, GitPullRequest, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";

interface WorkspaceTodoItemProps {
	todo: {
		_id: Id<"workspace_todos">;
		title: string;
		status: Status;
		assignee?: "user" | "agent";
		agentType?: "cursor";
		currentAgentRunId?: Id<"agent_runs">;
	};
	onClick?: () => void;
}

export default function WorkspaceTodoItem({
	todo,
	onClick,
}: WorkspaceTodoItemProps) {
	const updateTodo = useMutation(api.workspaces.updateWorkspaceTodo);
	const deleteTodo = useMutation(api.workspaces.deleteWorkspaceTodo);

	// Get agent run info if available
	const agentRun = useQuery(
		api.agentExecutionMutations.getAgentRunForTodo,
		todo.currentAgentRunId ? { todoId: todo._id } : "skip",
	);

	const handleToggle = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const newStatus = todo.status === "done" ? "todo" : "done";
		await updateTodo({ id: todo._id, status: newStatus });
	};

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await deleteTodo({ id: todo._id });
	};

	const getStatusIndicator = () => {
		if (todo.assignee === "agent" && todo.status === "in_progress") {
			return (
				<span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse flex-shrink-0" />
			);
		}
		if (todo.status === "in_review" || agentRun?.prUrl) {
			return <GitPullRequest className="w-3 h-3 text-purple-500 flex-shrink-0" />;
		}
		if (todo.assignee === "agent") {
			return <Bot className="w-3 h-3 text-purple-500 flex-shrink-0" />;
		}
		return null;
	};

	return (
		<div
			className={cn(
				"group flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer",
				todo.assignee === "agent" && "border-l-2 border-l-purple-500 pl-1.5",
				todo.status === "in_review" && "bg-purple-50/50 dark:bg-purple-900/10",
			)}
			onClick={onClick}
		>
			<Checkbox
				checked={todo.status === "done"}
				onCheckedChange={() => {}}
				onClick={handleToggle}
				className="flex-shrink-0"
				disabled={todo.status === "in_progress" && todo.assignee === "agent"}
			/>
			<div className="flex-1 min-w-0 flex items-center gap-1.5">
				<span
					className={cn(
						"text-sm truncate",
						todo.status === "done" && "line-through opacity-50",
					)}
				>
					{todo.title}
				</span>
				{getStatusIndicator()}
			</div>
			<button
				type="button"
				onClick={handleDelete}
				className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
				title="Delete task"
				disabled={todo.status === "in_progress" && todo.assignee === "agent"}
			>
				<Trash2 className="w-3.5 h-3.5" />
			</button>
		</div>
	);
}
