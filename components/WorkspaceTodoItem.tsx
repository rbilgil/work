import { useMutation } from "convex/react";
import { Bot, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Status = "backlog" | "todo" | "in_progress" | "done";

interface WorkspaceTodoItemProps {
	todo: {
		_id: Id<"workspace_todos">;
		title: string;
		status: Status;
		assignee?: "user" | "agent";
	};
	onClick?: () => void;
}

export default function WorkspaceTodoItem({
	todo,
	onClick,
}: WorkspaceTodoItemProps) {
	const updateTodo = useMutation(api.workspaces.updateWorkspaceTodo);
	const deleteTodo = useMutation(api.workspaces.deleteWorkspaceTodo);

	const handleToggle = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const newStatus = todo.status === "done" ? "todo" : "done";
		await updateTodo({ id: todo._id, status: newStatus });
	};

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await deleteTodo({ id: todo._id });
	};

	return (
		<div
			className={cn(
				"group flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer",
				todo.assignee === "agent" && "border-l-2 border-l-purple-500 pl-1.5",
			)}
			onClick={onClick}
		>
			<Checkbox
				checked={todo.status === "done"}
				onCheckedChange={() => {}}
				onClick={handleToggle}
				className="flex-shrink-0"
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
				{todo.assignee === "agent" && (
					<Bot className="w-3 h-3 text-purple-500 flex-shrink-0" />
				)}
			</div>
			<button
				type="button"
				onClick={handleDelete}
				className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
				title="Delete task"
			>
				<Trash2 className="w-3.5 h-3.5" />
			</button>
		</div>
	);
}
