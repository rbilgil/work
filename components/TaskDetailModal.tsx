"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Bot, CheckCircle2, Circle, ListTodo, MessageSquare, RefreshCw, User, Loader2, Terminal, Copy, Check, MoreHorizontal, Link2, FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import AgentStatusCard from "./AgentStatusCard";
import ContextRefSelector from "./ContextRefSelector";
import TodoComments from "./TodoComments";

type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";

interface ContextRef {
	refType: "doc" | "message" | "link";
	refId: string;
	title?: string;
}

type PlanStatus = "pending" | "generating" | "ready" | "failed";

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
		agentType?: "cursor" | "local";
		agentPrompt?: string;
		currentAgentRunId?: Id<"agent_runs">;
		prompt?: string;
		plan?: string;
		planStatus?: PlanStatus;
	};
}

export default function TaskDetailModal({
	open,
	onOpenChange,
	workspaceId,
	todo,
}: TaskDetailModalProps) {
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [isStartingAgent, setIsStartingAgent] = useState(false);
	const [title, setTitle] = useState(todo.title);
	const [description, setDescription] = useState(todo.description ?? "");
	const [plan, setPlan] = useState(todo.plan ?? "");
	const [status, setStatus] = useState<Status>(todo.status);
	const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);
	const [agentError, setAgentError] = useState<string | null>(null);
	const [localAgentModalOpen, setLocalAgentModalOpen] = useState(false);
	const [mcpCommand, setMcpCommand] = useState<string | null>(null);
	const [isGeneratingMcp, setIsGeneratingMcp] = useState(false);
	const [copied, setCopied] = useState(false);
	const [planExpanded, setPlanExpanded] = useState(false);
	const [showContext, setShowContext] = useState(false);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);

	const regenerateTicket = useAction(api.ticketAi.regenerateTicket);
	const updateTodo = useMutation(api.workspaces.updateWorkspaceTodo);
	const queueForAgent = useMutation(api.workspaces.queueTodoForAgent);
	const startCursorAgent = useAction(api.agentExecution.startCursorAgent);
	const setContextRefsMutation = useMutation(api.todoContext.setContextRefs);
	const generateMcpToken = useMutation(api.mcp.generateMcpToken);
	const updateSubTaskStatus = useMutation(api.workspaces.updateWorkspaceTodo);

	// Query for existing context refs
	const existingRefs = useQuery(api.todoContext.getContextRefs, {
		todoId: todo._id,
	});

	// Check if workspace has required integrations for agent
	const integrationStatus = useQuery(api.integrations.hasRequiredIntegrations, {
		workspaceId,
	});

	// Query for sub-tasks
	const subTasks = useQuery(api.workspaces.listSubTasks, {
		parentId: todo._id,
	});

	const hasRequiredIntegrations = integrationStatus?.ready ?? false;

	// Reset form when todo changes
	useEffect(() => {
		setTitle(todo.title);
		setDescription(todo.description ?? "");
		setPlan(todo.plan ?? "");
		setStatus(todo.status);
		setAgentError(null);
	}, [todo]);

	// Load existing context refs
	useEffect(() => {
		if (existingRefs) {
			setContextRefs(
				existingRefs.map((ref) => ({
					refType: ref.refType,
					refId: ref.refId,
					title: ref.title,
				})),
			);
		}
	}, [existingRefs]);

	const handleRegenerateTicket = async () => {
		setIsRegenerating(true);
		try {
			const result = await regenerateTicket({
				todoId: todo._id,
			});
			if (!result.success && result.error) {
				console.error("Failed to regenerate ticket:", result.error);
			}
			// The UI will update automatically via the query subscriptions
		} catch (error) {
			console.error("Failed to regenerate ticket:", error);
		} finally {
			setIsRegenerating(false);
		}
	};

	const handleToggleSubTaskStatus = async (subTaskId: Id<"workspace_todos">, currentStatus: Status) => {
		const newStatus = currentStatus === "done" ? "todo" : "done";
		await updateSubTaskStatus({
			id: subTaskId,
			status: newStatus,
		});
	};

	const handleSave = async () => {
		// Save todo changes
		await updateTodo({
			id: todo._id,
			title,
			description,
			status,
		});

		// Save context refs
		await setContextRefsMutation({
			todoId: todo._id,
			refs: contextRefs.map((ref) => ({
				refType: ref.refType,
				refId: ref.refId,
			})),
		});

		onOpenChange(false);
	};

	const handleStartAgent = async () => {
		setIsStartingAgent(true);
		setAgentError(null);
		try {
			// First save context refs
			await setContextRefsMutation({
				todoId: todo._id,
				refs: contextRefs.map((ref) => ({
					refType: ref.refType,
					refId: ref.refId,
				})),
			});

			// Save current changes
			await updateTodo({
				id: todo._id,
				title,
				description,
				status: "in_progress",
			});

			// Start the Cursor agent
			const result = await startCursorAgent({ todoId: todo._id });

			if (!result.success) {
				setAgentError(result.error || "Failed to start agent");
				return;
			}

			// Close modal on success
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to start agent:", error);
			setAgentError(
				error instanceof Error ? error.message : "Failed to start agent",
			);
		} finally {
			setIsStartingAgent(false);
		}
	};

	const handleQueueForAgent = async () => {
		await queueForAgent({ id: todo._id });
	};

	const handleStartLocalAgent = async () => {
		setIsGeneratingMcp(true);
		setAgentError(null);
		try {
			// First save context refs and description
			await setContextRefsMutation({
				todoId: todo._id,
				refs: contextRefs.map((ref) => ({
					refType: ref.refType,
					refId: ref.refId,
				})),
			});

			await updateTodo({
				id: todo._id,
				title,
				description,
			});

			// Generate MCP token
			const result = await generateMcpToken({ todoId: todo._id });
			setMcpCommand(result.mcpCommand);
			setLocalAgentModalOpen(true);
		} catch (error) {
			console.error("Failed to generate MCP token:", error);
			setAgentError(
				error instanceof Error ? error.message : "Failed to set up local agent",
			);
		} finally {
			setIsGeneratingMcp(false);
		}
	};

	const handleCopyCommand = async () => {
		if (mcpCommand) {
			await navigator.clipboard.writeText(mcpCommand);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const isAgentRunning =
		todo.assignee === "agent" &&
		todo.status === "in_progress" &&
		todo.currentAgentRunId;

	const isEditable = !isAgentRunning;

	// Status badge colors
	const statusConfig: Record<Status, { label: string; color: string }> = {
		backlog: { label: "Backlog", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
		todo: { label: "Todo", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400" },
		in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400" },
		in_review: { label: "In Review", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400" },
		done: { label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" },
	};

	return (
	<>
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
				{/* Header Bar */}
				<div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700">
					<div className="flex items-center gap-3">
						{/* Status Badge */}
						<Select
							value={status}
							onValueChange={(v) => setStatus(v as Status)}
							disabled={!isEditable}
						>
							<SelectTrigger className={`h-7 w-auto gap-1.5 text-xs font-medium border-0 ${statusConfig[status].color}`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="backlog">Backlog</SelectItem>
								<SelectItem value="todo">Todo</SelectItem>
								<SelectItem value="in_progress">In Progress</SelectItem>
								<SelectItem value="in_review">In Review</SelectItem>
								<SelectItem value="done">Done</SelectItem>
							</SelectContent>
						</Select>

						{/* Assignee Badge */}
						{todo.assignee && (
							<div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
								todo.assignee === "agent"
									? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400"
									: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
							}`}>
								{todo.assignee === "agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
								{todo.assignee === "agent" ? (todo.agentType === "local" ? "Local Agent" : "Agent") : "You"}
							</div>
						)}
					</div>

					<div className="flex items-center gap-2">
						{/* Regenerate Button */}
						{todo.prompt && isEditable && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRegenerateTicket}
								disabled={isRegenerating}
								className="h-7 gap-1.5 text-xs"
							>
								<RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
								{isRegenerating ? "Regenerating..." : "Regenerate"}
							</Button>
						)}

						{/* More Menu */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-7 w-7 p-0">
									<MoreHorizontal className="w-4 h-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setShowContext(!showContext)}>
									<Link2 className="w-4 h-4 mr-2" />
									{showContext ? "Hide" : "Show"} Linked Context
								</DropdownMenuItem>
								{todo.prompt && (
									<DropdownMenuItem onClick={() => {}}>
										<FileText className="w-4 h-4 mr-2" />
										View Original Prompt
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem className="text-red-600">
									Delete Task
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Main Content */}
				<div className="flex-1 overflow-y-auto px-6 py-4">
					{/* Title - Large, prominent */}
					<div className="mb-4">
						{isEditingTitle ? (
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								onBlur={() => setIsEditingTitle(false)}
								onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
								autoFocus
								className="w-full text-xl font-semibold bg-transparent border-0 outline-none focus:ring-0 p-0"
								placeholder="Task title..."
							/>
						) : (
							<h1
								className="text-xl font-semibold cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -mx-1 py-0.5"
								onClick={() => isEditable && setIsEditingTitle(true)}
							>
								{title || "Untitled"}
							</h1>
						)}
					</div>

					{/* Description - Inline editable */}
					<div className="mb-6">
						{isEditingDescription ? (
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								onBlur={() => setIsEditingDescription(false)}
								autoFocus
								className="w-full text-sm text-slate-600 dark:text-slate-400 bg-transparent border-0 outline-none focus:ring-0 p-0 resize-none min-h-[60px]"
								placeholder="Add a description..."
							/>
						) : (
							<p
								className={`text-sm cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -mx-1 py-1 ${
									description ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
								}`}
								onClick={() => isEditable && setIsEditingDescription(true)}
							>
								{description || "Add a description..."}
							</p>
						)}
					</div>

					{/* Agent Status Card (if running) */}
					{todo.currentAgentRunId && (
						<div className="mb-6">
							<AgentStatusCard
								todoId={todo._id}
								onRetry={handleStartAgent}
							/>
						</div>
					)}

					{/* Sub-Tasks Section */}
					<div className="mb-6">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-medium flex items-center gap-2">
								<ListTodo className="w-4 h-4 text-slate-500" />
								Sub-tasks
								{subTasks && subTasks.length > 0 && (
									<span className="text-xs text-slate-500 font-normal">
										{subTasks.filter((t) => t.status === "done").length}/{subTasks.length}
									</span>
								)}
							</h2>
							<Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-slate-500 hover:text-slate-700">
								<Plus className="w-3.5 h-3.5" />
								Add
							</Button>
						</div>

						{subTasks && subTasks.length > 0 ? (
							<div className="space-y-1">
								{subTasks.map((subTask) => (
									<div
										key={subTask._id}
										className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
									>
										<button
											type="button"
											onClick={() => handleToggleSubTaskStatus(subTask._id, subTask.status)}
											className="flex-shrink-0"
										>
											{subTask.status === "done" ? (
												<CheckCircle2 className="w-4 h-4 text-green-500" />
											) : (
												<Circle className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
											)}
										</button>
										<span className={`flex-1 text-sm ${subTask.status === "done" ? "line-through text-slate-400" : ""}`}>
											{subTask.title}
										</span>
										<span className={`text-xs px-1.5 py-0.5 rounded ${
											subTask.assignee === "agent"
												? "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
												: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
										}`}>
											{subTask.assignee === "agent" ? "Agent" : "You"}
										</span>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-slate-400 py-2">No sub-tasks yet</p>
						)}
					</div>

					{/* Implementation Plan */}
					{(plan || todo.plan || todo.planStatus === "generating" || todo.planStatus === "pending" || todo.planStatus === "failed") && (
						<div className="mb-6">
							<h2 className="text-sm font-medium mb-3 flex items-center gap-2">
								<FileText className="w-4 h-4 text-slate-500" />
								Implementation Plan
								{(todo.planStatus === "generating" || todo.planStatus === "pending") && (
									<span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-normal">
										<Loader2 className="w-3 h-3 animate-spin" />
										Analyzing...
									</span>
								)}
							</h2>

							{(todo.planStatus === "generating" || todo.planStatus === "pending") ? (
								<div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
									<div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
										<Loader2 className="w-4 h-4 animate-spin" />
										<span className="text-sm font-medium">Analyzing codebase...</span>
									</div>
									<p className="text-xs text-purple-600/70 dark:text-purple-400/70">
										OpenCode is exploring your repository to create a detailed plan.
									</p>
								</div>
							) : todo.planStatus === "failed" ? (
								<div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
									<p className="text-sm text-red-600 dark:text-red-400">
										Failed to generate plan. Try regenerating.
									</p>
								</div>
							) : (
								<div>
									<div className="relative">
										<div className={`prose prose-sm dark:prose-invert max-w-none overflow-hidden ${!planExpanded ? "max-h-48" : ""}`}>
											<div className="text-sm text-slate-700 dark:text-slate-300 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:pl-5 [&_li]:my-0.5 [&_code]:text-xs [&_code]:bg-slate-100 [&_code]:dark:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:text-xs [&_pre]:my-2 [&_pre]:p-3 [&_pre]:bg-slate-100 [&_pre]:dark:bg-slate-800 [&_pre]:rounded-lg [&_strong]:font-semibold">
												<ReactMarkdown>{plan || todo.plan || ""}</ReactMarkdown>
											</div>
										</div>
										{!planExpanded && (plan || todo.plan || "").length > 300 && (
											<div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none" />
										)}
									</div>
									{(plan || todo.plan || "").length > 300 && (
										<button
											type="button"
											onClick={() => setPlanExpanded(!planExpanded)}
											className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
										>
											{planExpanded ? "Show less" : "See all"}
										</button>
									)}
								</div>
							)}
						</div>
					)}

					{/* Linked Context (collapsible) */}
					{showContext && (
						<div className="mb-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
							<h3 className="text-sm font-medium mb-3 flex items-center gap-2">
								<Link2 className="w-4 h-4 text-slate-500" />
								Linked Context
							</h3>
							<ContextRefSelector
								workspaceId={workspaceId}
								todoId={todo._id}
								todoTitle={title}
								selectedRefs={contextRefs}
								onRefsChange={setContextRefs}
								compact={false}
							/>

							{/* Original Prompt */}
							{todo.prompt && (
								<div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
									<h4 className="text-xs font-medium text-slate-500 mb-2">Original Prompt</h4>
									<p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
										{todo.prompt}
									</p>
								</div>
							)}
						</div>
					)}

					{/* Activity / Comments Section */}
					<div>
						<h2 className="text-sm font-medium mb-3 flex items-center gap-2">
							<MessageSquare className="w-4 h-4 text-slate-500" />
							Activity
						</h2>
						<TodoComments todoId={todo._id} />
					</div>
				</div>

				{/* Footer Actions */}
				<div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
					<div className="flex items-center gap-2">
						{/* Agent error */}
						{agentError && (
							<p className="text-xs text-red-600 dark:text-red-400">
								{agentError}
							</p>
						)}

						{/* Integration status warning */}
						{!hasRequiredIntegrations && !agentError && (
							<p className="text-xs text-amber-600 dark:text-amber-400">
								Configure integrations in Settings to use agents.
							</p>
						)}
					</div>

					<div className="flex items-center gap-2">
						{!isAgentRunning && (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={handleStartLocalAgent}
									disabled={isGeneratingMcp || todo.agentType === "local"}
									className="gap-1.5"
								>
									{isGeneratingMcp ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<Terminal className="w-3.5 h-3.5" />
									)}
									Local Agent
								</Button>
								<Button
									size="sm"
									onClick={handleStartAgent}
									disabled={!hasRequiredIntegrations || isStartingAgent || todo.assignee === "agent"}
									className="gap-1.5 bg-purple-600 hover:bg-purple-700"
								>
									{isStartingAgent ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<Bot className="w-3.5 h-3.5" />
									)}
									Cursor Agent
								</Button>
							</>
						)}
						<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
							{isAgentRunning ? "Close" : "Cancel"}
						</Button>
						{isEditable && (
							<Button size="sm" onClick={handleSave}>
								Save
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>

		{/* Local Agent Setup Modal */}
		<Dialog open={localAgentModalOpen} onOpenChange={setLocalAgentModalOpen}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Terminal className="w-5 h-5 text-green-500" />
						Set Up Local Agent
					</DialogTitle>
					<DialogDescription>
						Run this command in your terminal to connect Claude Code to this task.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="relative">
						<pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
							<code>{mcpCommand}</code>
						</pre>
						<Button
							size="sm"
							variant="secondary"
							className="absolute top-2 right-2 gap-1.5"
							onClick={handleCopyCommand}
						>
							{copied ? (
								<>
									<Check className="w-3.5 h-3.5" />
									Copied!
								</>
							) : (
								<>
									<Copy className="w-3.5 h-3.5" />
									Copy
								</>
							)}
						</Button>
					</div>

					<div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
						<p><strong>After running the command:</strong></p>
						<ol className="list-decimal list-inside space-y-1 ml-2">
							<li>Claude Code will have access to this task&apos;s context</li>
							<li>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">resources/list</code> to see available context</li>
							<li>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">search_context</code> to search chat, docs, links</li>
							<li>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">mark_complete</code> when done</li>
						</ol>
					</div>

					<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
						<p className="text-sm text-amber-800 dark:text-amber-200">
							<strong>Note:</strong> The token expires in 1 hour. Generate a new one if needed.
						</p>
					</div>
				</div>

				<div className="flex justify-end gap-2 pt-2">
					<Button variant="outline" onClick={() => setLocalAgentModalOpen(false)}>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	</>
	);
}
