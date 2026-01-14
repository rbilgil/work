import { useQuery } from "convex/react";
import {
	Bot,
	CheckSquare,
	FileText,
	GitBranch,
	LayoutGrid,
	Link as LinkIcon,
	Settings,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import ContextSection from "./ContextSection";
import DocCreateModal from "./DocCreateModal";
import DocItem from "./DocItem";
import IntegrationsModal from "./IntegrationsModal";
import LinkCreateModal from "./LinkCreateModal";
import LinkItem from "./LinkItem";
import TaskCreateModal from "./TaskCreateModal";
import WorkspaceTodoItem from "./WorkspaceTodoItem";

type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";

type Todo = {
	_id: Id<"workspace_todos">;
	title: string;
	description?: string;
	status: Status;
	order?: number;
	assignee?: "user" | "agent";
	agentType?: "cursor";
	agentPrompt?: string;
	currentAgentRunId?: Id<"agent_runs">;
};

interface ContextSidebarProps {
	organizationId: Id<"organizations">;
	workspaceId: Id<"workspaces">;
	onTaskClick?: (todo: Todo) => void;
	onGoToBoard?: () => void;
}

export default function ContextSidebar({
	organizationId,
	workspaceId,
	onTaskClick,
	onGoToBoard,
}: ContextSidebarProps) {
	const docs = useQuery(api.workspaces.listDocs, { workspaceId });
	const todos = useQuery(api.workspaces.listWorkspaceTodos, { workspaceId });
	const links = useQuery(api.workspaces.listLinks, { workspaceId });
	const workspaceRepo = useQuery(api.integrations.getWorkspaceRepo, {
		workspaceId,
	});

	const [docModalOpen, setDocModalOpen] = useState(false);
	const [linkModalOpen, setLinkModalOpen] = useState(false);
	const [taskModalOpen, setTaskModalOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);

	// Get tasks assigned to agent that are in progress
	const agentTasks =
		(todos as Todo[] | undefined)?.filter(
			(t) =>
				t.assignee === "agent" &&
				(t.status === "in_progress" || t.status === "in_review"),
		) ?? [];

	return (
		<div className="h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto">
			<div className="p-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-semibold opacity-70 uppercase tracking-wider">
						Added Context
					</h2>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={() => setSettingsOpen(true)}
						title="Workspace Settings"
					>
						<Settings className="w-3.5 h-3.5" />
					</Button>
				</div>

				{/* Connected Repo Indicator */}
				{workspaceRepo && (
					<div className="mb-4 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-500/20">
						<div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
							<GitBranch className="w-3.5 h-3.5" />
							<span className="font-medium truncate">
								{workspaceRepo.owner}/{workspaceRepo.repo}
							</span>
						</div>
					</div>
				)}

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
								doc={{
									_id: doc._id,
									title: doc.title,
									content: doc.content,
									sourceUrl: (doc as { sourceUrl?: string }).sourceUrl,
									sourceType: (doc as { sourceType?: "notion" | "manual" }).sourceType,
									lastFetchedAt: (doc as { lastFetchedAt?: number }).lastFetchedAt,
								}}
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
								{workspaceRepo
									? "All agents are idle and ready"
									: "Connect a GitHub repo to use agents"}
							</p>
							{workspaceRepo ? (
								<Button
									variant="outline"
									size="sm"
									className="w-full gap-2"
									onClick={onGoToBoard}
								>
									<LayoutGrid className="w-3.5 h-3.5" />
									Go to Board to assign tasks
								</Button>
							) : (
								<Button
									variant="outline"
									size="sm"
									className="w-full gap-2"
									onClick={() => setSettingsOpen(true)}
								>
									<GitBranch className="w-3.5 h-3.5" />
									Connect Repository
								</Button>
							)}
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
										{task.status === "in_review" ? (
											<GitBranch className="w-3 h-3 text-purple-500" />
										) : (
											<span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse flex-shrink-0" />
										)}
										<span className="text-xs font-medium truncate">
											{task.title}
										</span>
									</div>
									{task.status === "in_review" && (
										<span className="text-xs text-purple-600 dark:text-purple-400 mt-1 block">
											PR Ready for Review
										</span>
									)}
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
			<IntegrationsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				organizationId={organizationId}
				workspaceId={workspaceId}
			/>
		</div>
	);
}
