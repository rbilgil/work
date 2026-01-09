import { useQuery } from "convex/react";
import {
	Bot,
	CheckSquare,
	FileText,
	LayoutGrid,
	Link as LinkIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import ContextSection from "./ContextSection";
import DocCreateModal from "./DocCreateModal";
import DocItem from "./DocItem";
import LinkCreateModal from "./LinkCreateModal";
import LinkItem from "./LinkItem";
import TaskCreateModal from "./TaskCreateModal";
import WorkspaceTodoItem from "./WorkspaceTodoItem";

type Status = "backlog" | "todo" | "in_progress" | "done";

type Todo = {
	_id: Id<"workspace_todos">;
	title: string;
	description?: string;
	status: Status;
	order?: number;
	assignee?: "user" | "agent";
	agentPrompt?: string;
};

interface ContextSidebarProps {
	workspaceId: Id<"workspaces">;
	onTaskClick?: (todo: Todo) => void;
	onGoToBoard?: () => void;
}

export default function ContextSidebar({
	workspaceId,
	onTaskClick,
	onGoToBoard,
}: ContextSidebarProps) {
	const docs = useQuery(api.workspaces.listDocs, { workspaceId });
	const todos = useQuery(api.workspaces.listWorkspaceTodos, { workspaceId });
	const links = useQuery(api.workspaces.listLinks, { workspaceId });

	const [docModalOpen, setDocModalOpen] = useState(false);
	const [linkModalOpen, setLinkModalOpen] = useState(false);
	const [taskModalOpen, setTaskModalOpen] = useState(false);

	// Get tasks assigned to agent that are in progress
	const agentTasks =
		(todos as Todo[] | undefined)?.filter(
			(t) => t.assignee === "agent" && t.status === "in_progress",
		) ?? [];

	return (
		<div className="w-72 flex-shrink-0 border-l border-slate-200/70 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto">
			<div className="p-4">
				<h2 className="text-sm font-semibold opacity-70 uppercase tracking-wider mb-4">
					Added Context
				</h2>

				{/* Documents Section */}
				<ContextSection
					title="Documents"
					icon={<FileText className="w-4 h-4" />}
					onAdd={() => setDocModalOpen(true)}
					count={docs?.length}
				>
					{docs?.length === 0 ? (
						<p className="text-xs text-slate-500 py-2">No documents yet</p>
					) : (
						docs?.map((doc) => (
							<DocItem
								key={doc._id}
								doc={
									doc as {
										_id: Id<"workspace_docs">;
										title: string;
										content: string;
									}
								}
							/>
						))
					)}
				</ContextSection>

				{/* Todos Section */}
				<ContextSection
					title="Tasks"
					icon={<CheckSquare className="w-4 h-4" />}
					onAdd={() => setTaskModalOpen(true)}
					count={
						todos?.filter((t: { status: string }) => t.status !== "done").length
					}
				>
					{todos?.length === 0 ? (
						<p className="text-xs text-slate-500 py-2">No tasks yet</p>
					) : (
						(todos as Todo[] | undefined)?.map((todo) => (
							<WorkspaceTodoItem
								key={todo._id}
								todo={todo}
								onClick={() => onTaskClick?.(todo)}
							/>
						))
					)}
				</ContextSection>

				{/* Links Section */}
				<ContextSection
					title="Links"
					icon={<LinkIcon className="w-4 h-4" />}
					onAdd={() => setLinkModalOpen(true)}
					count={links?.length}
				>
					{links?.length === 0 ? (
						<p className="text-xs text-slate-500 py-2">No links yet</p>
					) : (
						links?.map((link) => (
							<LinkItem
								key={link._id}
								link={
									link as {
										_id: Id<"workspace_links">;
										url: string;
										title: string;
										type:
											| "email"
											| "spreadsheet"
											| "figma"
											| "document"
											| "other";
									}
								}
							/>
						))
					)}
				</ContextSection>

				{/* Agents Section */}
				<ContextSection
					title="Agents"
					icon={<Bot className="w-4 h-4" />}
					count={agentTasks.length}
				>
					{agentTasks.length === 0 ? (
						<div className="py-2">
							<p className="text-xs text-slate-500 mb-3">
								All agents are idle and ready
							</p>
							<Button
								variant="outline"
								size="sm"
								className="w-full gap-2"
								onClick={onGoToBoard}
							>
								<LayoutGrid className="w-3.5 h-3.5" />
								Go to Board to assign tasks
							</Button>
						</div>
					) : (
						<div className="space-y-2">
							{agentTasks.map((task) => (
								<div
									key={task._id}
									className="p-2 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-500/20 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
									onClick={() => onTaskClick?.(task)}
								>
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse flex-shrink-0" />
										<span className="text-xs font-medium truncate">
											{task.title}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</ContextSection>
			</div>

			{/* Modals */}
			<DocCreateModal
				open={docModalOpen}
				onOpenChange={setDocModalOpen}
				workspaceId={workspaceId}
			/>
			<LinkCreateModal
				open={linkModalOpen}
				onOpenChange={setLinkModalOpen}
				workspaceId={workspaceId}
			/>
			<TaskCreateModal
				open={taskModalOpen}
				onOpenChange={setTaskModalOpen}
				workspaceId={workspaceId}
			/>
		</div>
	);
}
