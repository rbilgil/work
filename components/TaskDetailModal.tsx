"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Bot, CheckCircle2, ChevronDown, ChevronRight, Circle, ListTodo, MessageSquare, RefreshCw, Sparkles, User, Loader2, Terminal, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
	const [planOpen, setPlanOpen] = useState(false);
	const [subTasksOpen, setSubTasksOpen] = useState(true);
	const [commentsOpen, setCommentsOpen] = useState(true);

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

	return (
	<>
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2">
							<Sparkles className="w-5 h-5 text-blue-500" />
							Task Details
						</DialogTitle>
						{todo.prompt && isEditable && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleRegenerateTicket}
								disabled={isRegenerating}
								className="gap-2"
							>
								<RefreshCw
									className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`}
								/>
								{isRegenerating ? "Regenerating..." : "Regenerate"}
							</Button>
						)}
					</div>
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
							disabled={!isEditable}
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
							disabled={!isEditable}
						>
							<SelectTrigger id="task-status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="backlog">Backlog</SelectItem>
								<SelectItem value="todo">To Do</SelectItem>
								<SelectItem value="in_progress">In Progress</SelectItem>
								<SelectItem value="in_review">In Review</SelectItem>
								<SelectItem value="done">Done</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Description */}
					<div>
						<label htmlFor="task-desc" className="text-sm font-medium block mb-1.5">
							Description
						</label>
						<Textarea
							id="task-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Task description..."
							className="min-h-[100px] resize-none"
							disabled={!isEditable}
						/>
					</div>

					<Separator />

					{/* Linked Context */}
					<div>
						<label className="text-sm font-medium block mb-2">
							Linked Context
						</label>
						<p className="text-xs text-slate-500 mb-3">
							Link relevant messages, docs, or links that the agent should
							reference.
						</p>
						<ContextRefSelector
							workspaceId={workspaceId}
							todoId={todo._id}
							todoTitle={title}
							selectedRefs={contextRefs}
							onRefsChange={setContextRefs}
							compact={false}
						/>
					</div>

					{/* Original Prompt */}
					{todo.prompt && (
						<>
							<Separator />
							<div>
								<label className="text-sm font-medium block mb-2">
									Original Prompt
								</label>
								<div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
									<p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
										{todo.prompt}
									</p>
								</div>
							</div>
						</>
					)}

					{/* Implementation Plan */}
					{(plan || todo.plan || todo.planStatus === "generating" || todo.planStatus === "pending" || todo.planStatus === "failed") && (
						<>
							<Separator />
							<Collapsible open={planOpen} onOpenChange={setPlanOpen}>
								<CollapsibleTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors"
									>
										{planOpen ? (
											<ChevronDown className="w-4 h-4" />
										) : (
											<ChevronRight className="w-4 h-4" />
										)}
										Implementation Plan
										{(todo.planStatus === "generating" || todo.planStatus === "pending") && (
											<span className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-normal">
												<Loader2 className="w-3 h-3 animate-spin" />
												Analyzing codebase...
											</span>
										)}
										{todo.planStatus === "failed" && (
											<span className="text-xs text-red-600 dark:text-red-400 font-normal">
												Failed
											</span>
										)}
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-3">
									{(todo.planStatus === "generating" || todo.planStatus === "pending") ? (
										<div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3">
											<div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
												<Loader2 className="w-5 h-5 animate-spin" />
												<span className="text-sm font-medium">Analyzing codebase...</span>
											</div>
											<p className="text-xs text-slate-500 text-center max-w-sm">
												OpenCode is exploring your repository to create a detailed implementation plan. This typically takes 1-2 minutes.
											</p>
										</div>
									) : todo.planStatus === "failed" ? (
										<div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
											<p className="text-sm text-red-600 dark:text-red-400">
												Failed to generate plan. You can try regenerating or write the plan manually.
											</p>
										</div>
									) : (
										<div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 prose prose-xs max-w-none dark:prose-invert prose-p:my-1 prose-p:text-xs prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-xs prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-sm prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-code:text-xs prose-pre:my-1 prose-pre:text-xs">
											<ReactMarkdown>{plan || todo.plan || ""}</ReactMarkdown>
										</div>
									)}
								</CollapsibleContent>
							</Collapsible>
						</>
					)}

					{/* Sub-Tasks Section */}
					{subTasks && subTasks.length > 0 && (
						<>
							<Separator />
							<Collapsible open={subTasksOpen} onOpenChange={setSubTasksOpen}>
								<CollapsibleTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors"
									>
										{subTasksOpen ? (
											<ChevronDown className="w-4 h-4" />
										) : (
											<ChevronRight className="w-4 h-4" />
										)}
										<ListTodo className="w-4 h-4" />
										Sub-Tasks
										<span className="text-xs text-slate-500 font-normal">
											({subTasks.filter((t) => t.status === "done").length}/{subTasks.length})
										</span>
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-3">
									<div className="space-y-2">
										{subTasks.map((subTask) => (
											<div
												key={subTask._id}
												className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
											>
												<button
													type="button"
													onClick={() => handleToggleSubTaskStatus(subTask._id, subTask.status)}
													className="mt-0.5 flex-shrink-0"
												>
													{subTask.status === "done" ? (
														<CheckCircle2 className="w-5 h-5 text-green-500" />
													) : (
														<Circle className="w-5 h-5 text-slate-400 hover:text-slate-600" />
													)}
												</button>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span
															className={`text-sm font-medium ${
																subTask.status === "done"
																	? "line-through text-slate-400"
																	: ""
															}`}
														>
															{subTask.title}
														</span>
														<span
															className={`text-xs px-1.5 py-0.5 rounded ${
																subTask.assignee === "agent"
																	? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
																	: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
															}`}
														>
															{subTask.assignee === "agent" ? (
																<span className="flex items-center gap-1">
																	<Bot className="w-3 h-3" />
																	Agent
																</span>
															) : (
																<span className="flex items-center gap-1">
																	<User className="w-3 h-3" />
																	You
																</span>
															)}
														</span>
													</div>
													{subTask.description && (
														<p className="text-xs text-slate-500 mt-1">
															{subTask.description}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								</CollapsibleContent>
							</Collapsible>
						</>
					)}

					{/* Comments Section */}
					<Separator />
					<Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors"
							>
								{commentsOpen ? (
									<ChevronDown className="w-4 h-4" />
								) : (
									<ChevronRight className="w-4 h-4" />
								)}
								<MessageSquare className="w-4 h-4" />
								Comments
							</button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-3">
							<TodoComments todoId={todo._id} />
						</CollapsibleContent>
					</Collapsible>

					<Separator />

					{/* Agent Status Card (if agent is assigned) */}
					{todo.currentAgentRunId && (
						<div>
							<label className="text-sm font-medium block mb-2">
								Agent Status
							</label>
							<AgentStatusCard
								todoId={todo._id}
								onRetry={handleStartAgent}
							/>
						</div>
					)}

					{/* Assignee and Agent Controls */}
					<div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-white/10">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm">
								<span className="text-slate-500">Assigned to:</span>
								{todo.assignee === "agent" && todo.agentType === "local" ? (
									<span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
										<Terminal className="w-4 h-4" />
										Local Agent (Claude Code)
									</span>
								) : todo.assignee === "agent" ? (
									<span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium">
										<Bot className="w-4 h-4" />
										Cursor Agent
										{isAgentRunning && (
											<span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
										)}
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

						{/* Integration status warning */}
						{!hasRequiredIntegrations && (
							<p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
								{integrationStatus && !integrationStatus.cursor &&
									"Cursor API key not configured. "}
								{integrationStatus && !integrationStatus.repo && "No GitHub repository connected. "}
								Configure in Settings to use agents.
							</p>
						)}

						{/* Agent error */}
						{agentError && (
							<p className="text-xs text-red-600 dark:text-red-400 mt-2">
								{agentError}
							</p>
						)}

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
					<div className="flex gap-2 flex-wrap">
						{!isAgentRunning && (
							<>
								<Button
									variant="outline"
									onClick={handleStartLocalAgent}
									disabled={isGeneratingMcp || todo.agentType === "local"}
									className="gap-2"
								>
									{isGeneratingMcp ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Setting up...
										</>
									) : (
										<>
											<Terminal className="w-4 h-4" />
											Local Agent
										</>
									)}
								</Button>
								<Button
									variant="default"
									onClick={handleStartAgent}
									disabled={
										!hasRequiredIntegrations ||
										isStartingAgent ||
										todo.assignee === "agent"
									}
									className="gap-2 bg-purple-600 hover:bg-purple-700"
								>
									{isStartingAgent ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Starting...
										</>
									) : (
										<>
											<Bot className="w-4 h-4" />
											Cursor Agent
										</>
									)}
								</Button>
							</>
						)}
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							{isAgentRunning ? "Close" : "Cancel"}
						</Button>
						{isEditable && <Button onClick={handleSave}>Save Changes</Button>}
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
