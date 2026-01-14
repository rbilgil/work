"use client";

import { useQuery } from "convex/react";
import { LayoutGrid, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ContextSidebar from "@/components/ContextSidebar";
import KanbanBoard from "@/components/KanbanBoard";
import MessageArea from "@/components/MessageArea";
import TaskDetailModal from "@/components/TaskDetailModal";
import ThreadPanel from "@/components/ThreadPanel";
import WorkspaceCreateModal from "@/components/WorkspaceCreateModal";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type ViewMode = "chat" | "board";
type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";

type Todo = {
	_id: Id<"workspace_todos">;
	title: string;
	description?: string;
	status: Status;
	order?: number;
	assignee?: "user" | "agent";
	agentType?: "cursor" | "local";
	agentPrompt?: string;
	currentAgentRunId?: Id<"agent_runs">;
};

export default function Work() {
	const [selectedWorkspaceId, setSelectedWorkspaceId] =
		useState<Id<"workspaces"> | null>(null);
	const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
	const [threadMessageId, setThreadMessageId] =
		useState<Id<"workspace_messages"> | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>("chat");
	const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

	const organizations = useQuery(api.organizations.listMyOrganizations);
	const currentOrganization = organizations?.[0];

	const workspaces = useQuery(
		api.workspaces.listWorkspaces,
		currentOrganization ? { organizationId: currentOrganization._id } : "skip",
	);

	useEffect(() => {
		if (selectedWorkspaceId === null && workspaces && workspaces.length > 0) {
			setSelectedWorkspaceId(workspaces[0]._id);
		}
	}, [workspaces, selectedWorkspaceId]);

	useEffect(() => {
		if (viewMode === "board") {
			setThreadMessageId(null);
		}
	}, [viewMode]);

	if (organizations === undefined) {
		return (
			<div className="h-full flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
			</div>
		);
	}

	if (!currentOrganization) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center">
					<p className="text-lg text-slate-700 dark:text-slate-300 mb-4">
						Please complete onboarding first.
					</p>
					<Link
						href="/app/onboarding"
						className="text-indigo-600 hover:text-indigo-700 font-medium"
					>
						Go to Onboarding →
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full grid grid-cols-[220px_1fr_260px] bg-white dark:bg-slate-950">
			{/* Left Sidebar */}
			<div className="border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
				<WorkspaceSidebar
					organizationId={currentOrganization._id}
					selectedWorkspaceId={selectedWorkspaceId}
					onSelectWorkspace={setSelectedWorkspaceId}
					onNewWorkspace={() => setCreateWorkspaceOpen(true)}
				/>
			</div>

			{/* Main Content */}
			<div className="flex flex-col overflow-hidden">
				{selectedWorkspaceId ? (
					<>
						{/* View Toggle */}
						<div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
							<div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
								<button
									type="button"
									onClick={() => setViewMode("chat")}
									className={cn(
										"flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
										viewMode === "chat"
											? "bg-white dark:bg-slate-700 shadow-sm font-medium"
											: "hover:bg-white/50 dark:hover:bg-white/10",
									)}
								>
									<MessageSquare className="w-4 h-4" />
									Chat
								</button>
								<button
									type="button"
									onClick={() => setViewMode("board")}
									className={cn(
										"flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
										viewMode === "board"
											? "bg-white dark:bg-slate-700 shadow-sm font-medium"
											: "hover:bg-white/50 dark:hover:bg-white/10",
									)}
								>
									<LayoutGrid className="w-4 h-4" />
									Board
								</button>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-hidden relative">
							{viewMode === "chat" ? (
								<MessageArea
									workspaceId={selectedWorkspaceId}
									organizationId={currentOrganization._id}
									onOpenThread={setThreadMessageId}
								/>
							) : (
								<KanbanBoard
									workspaceId={selectedWorkspaceId}
									onTaskClick={(todo) => setSelectedTodo(todo)}
								/>
							)}

							{threadMessageId && viewMode === "chat" && (
								<ThreadPanel
									messageId={threadMessageId}
									workspaceId={selectedWorkspaceId}
									onClose={() => setThreadMessageId(null)}
								/>
							)}
						</div>
					</>
				) : (
					<div className="flex-1 flex items-center justify-center text-slate-500">
						<div className="text-center">
							<p className="text-lg">No workspace selected</p>
							<p className="text-sm opacity-70 mt-1">
								Select or create a workspace to get started
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Right Sidebar */}
			{selectedWorkspaceId ? (
				<div className="border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
					<ContextSidebar
						organizationId={currentOrganization._id}
						workspaceId={selectedWorkspaceId}
						onTaskClick={(todo) => setSelectedTodo(todo)}
						onGoToBoard={() => setViewMode("board")}
					/>
				</div>
			) : (
				<div className="border-l border-slate-200 dark:border-slate-800" />
			)}

			{/* Modals */}
			<WorkspaceCreateModal
				open={createWorkspaceOpen}
				onOpenChange={setCreateWorkspaceOpen}
				organizationId={currentOrganization._id}
			/>

			{selectedTodo && selectedWorkspaceId && (
				<TaskDetailModal
					open={!!selectedTodo}
					onOpenChange={(open) => !open && setSelectedTodo(null)}
					workspaceId={selectedWorkspaceId}
					todo={selectedTodo}
				/>
			)}
		</div>
	);
}
