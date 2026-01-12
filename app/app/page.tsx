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

	// Get user's organizations
	const organizations = useQuery(api.organizations.listMyOrganizations);

	// Use the first organization
	const currentOrganization = organizations?.[0];

	// Get workspaces for the current organization
	const workspaces = useQuery(
		api.workspaces.listWorkspaces,
		currentOrganization ? { organizationId: currentOrganization._id } : "skip",
	);

	// Auto-select first workspace
	useEffect(() => {
		if (selectedWorkspaceId === null && workspaces && workspaces.length > 0) {
			setSelectedWorkspaceId(workspaces[0]._id);
		}
	}, [workspaces, selectedWorkspaceId]);

	// Close thread panel when switching to board view
	useEffect(() => {
		if (viewMode === "board") {
			setThreadMessageId(null);
		}
	}, [viewMode]);

	// Show loading while fetching organizations
	if (organizations === undefined) {
		return (
			<div className="flex h-[calc(100vh-5rem)] items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
			</div>
		);
	}

	// No organization - user needs to complete onboarding
	if (!currentOrganization) {
		return (
			<div className="flex h-[calc(100vh-5rem)] items-center justify-center">
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
		<div className="flex h-[calc(100vh-3.5rem)] border-t border-slate-200/70 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-950">
			{/* Left Sidebar - Workspace List */}
			<WorkspaceSidebar
				organizationId={currentOrganization._id}
				selectedWorkspaceId={selectedWorkspaceId}
				onSelectWorkspace={setSelectedWorkspaceId}
				onNewWorkspace={() => setCreateWorkspaceOpen(true)}
			/>

			{/* Main Area */}
			<div className="flex-1 flex flex-col min-w-0 relative">
				{selectedWorkspaceId ? (
					<>
						{/* View Toggle Header */}
						<div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/70 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
							<div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
								<button
									type="button"
									onClick={() => setViewMode("chat")}
									className={cn(
										"flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
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
										"flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
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

						{/* Content Area */}
						{viewMode === "chat" ? (
							<MessageArea
								workspaceId={selectedWorkspaceId}
								onOpenThread={setThreadMessageId}
							/>
						) : (
							<KanbanBoard
								workspaceId={selectedWorkspaceId}
								onTaskClick={(todo) => setSelectedTodo(todo)}
							/>
						)}

						{/* Thread Panel (slides over from right, only in chat view) */}
						{threadMessageId && viewMode === "chat" && (
							<ThreadPanel
								messageId={threadMessageId}
								workspaceId={selectedWorkspaceId}
								onClose={() => setThreadMessageId(null)}
							/>
						)}
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

			{/* Right Sidebar - Context (Docs, Todos, Links) */}
			{selectedWorkspaceId && (
				<ContextSidebar
					organizationId={currentOrganization._id}
					workspaceId={selectedWorkspaceId}
					onTaskClick={(todo) => setSelectedTodo(todo)}
					onGoToBoard={() => setViewMode("board")}
				/>
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
