"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Bot, RefreshCw, Sparkles, User, Loader2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import AgentStatusCard from "./AgentStatusCard";
import ContextRefSelector from "./ContextRefSelector";

type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";

interface ContextRef {
	refType: "doc" | "message" | "link";
	refId: string;
	title?: string;
}

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
		agentType?: "cursor";
		agentPrompt?: string;
		currentAgentRunId?: Id<"agent_runs">;
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
	const [status, setStatus] = useState<Status>(todo.status);
	const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);
	const [agentError, setAgentError] = useState<string | null>(null);

	const generateDescription = useAction(
		api.workspaceAi.generateTaskDescription,
	);
	const updateTodo = useMutation(api.workspaces.updateWorkspaceTodo);
	const queueForAgent = useMutation(api.workspaces.queueTodoForAgent);
	const startCursorAgent = useAction(api.agentExecution.startCursorAgent);
	const setContextRefsMutation = useMutation(api.todoContext.setContextRefs);

	// Query for existing context refs
	const existingRefs = useQuery(api.todoContext.getContextRefs, {
		todoId: todo._id,
	});

	// Check if workspace has required integrations for agent
	const integrationStatus = useQuery(api.integrations.hasRequiredIntegrations, {
		workspaceId,
	});

	const hasRequiredIntegrations = integrationStatus?.ready ?? false;

	// Reset form when todo changes
	useEffect(() => {
		setTitle(todo.title);
		setDescription(todo.description ?? "");
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
				})),
			);
		}
	}, [existingRefs]);

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

	const isAgentRunning =
		todo.assignee === "agent" &&
		todo.status === "in_progress" &&
		todo.currentAgentRunId;

	const isEditable = !isAgentRunning;

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
						<div className="flex items-center justify-between mb-1.5">
							<label htmlFor="task-desc" className="text-sm font-medium">
								Description
							</label>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRegenerate}
								disabled={isRegenerating || !isEditable}
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
							disabled={!isEditable}
						/>
						<p className="text-xs text-slate-500 mt-1">
							AI uses your workspace chat to generate detailed task
							descriptions.
						</p>
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
								{todo.assignee === "agent" ? (
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
					<div className="flex gap-2">
						{!isAgentRunning && (
							<>
								<Button
									variant="outline"
									onClick={handleQueueForAgent}
									disabled={todo.assignee === "agent"}
									className="gap-2"
								>
									<Bot className="w-4 h-4" />
									Queue for Agent
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
											Start Cursor Agent
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
	);
}
