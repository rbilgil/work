"use client";

import { useQuery, useAction } from "convex/react";
import { Button } from "@/components/ui/button";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
	AlertCircle,
	CheckCircle2,
	Eye,
	ExternalLink,
	GitPullRequest,
	Loader2,
	PlayCircle,
	RefreshCw,
} from "lucide-react";

interface AgentStatusCardProps {
	todoId: Id<"workspace_todos">;
	onRetry?: () => void;
}

export default function AgentStatusCard({ todoId, onRetry }: AgentStatusCardProps) {
	const agentRun = useQuery(api.agentExecutionMutations.getAgentRunForTodo, {
		todoId,
	});

	if (!agentRun) {
		return null;
	}

	const getStatusIcon = () => {
		switch (agentRun.status) {
			case "creating":
				return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
			case "running":
				return <PlayCircle className="w-5 h-5 text-yellow-500 animate-pulse" />;
			case "finished":
				return <CheckCircle2 className="w-5 h-5 text-green-500" />;
			case "failed":
				return <AlertCircle className="w-5 h-5 text-red-500" />;
			default:
				return null;
		}
	};

	const getStatusLabel = () => {
		switch (agentRun.status) {
			case "creating":
				return "Starting agent...";
			case "running":
				return "Agent working...";
			case "finished":
				return "Agent completed";
			case "failed":
				return "Agent failed";
			default:
				return agentRun.status;
		}
	};

	const getStatusColor = () => {
		switch (agentRun.status) {
			case "creating":
				return "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800";
			case "running":
				return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800";
			case "finished":
				return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800";
			case "failed":
				return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
			default:
				return "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800";
		}
	};

	const getPrStatusBadge = () => {
		if (!agentRun.prStatus) return null;

		switch (agentRun.prStatus) {
			case "open":
				return (
					<span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
						Open
					</span>
				);
			case "merged":
				return (
					<span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-full">
						Merged
					</span>
				);
			case "closed":
				return (
					<span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full">
						Closed
					</span>
				);
			default:
				return null;
		}
	};

	const formatDuration = (start: number, end?: number) => {
		const endTime = end || Date.now();
		const diff = Math.floor((endTime - start) / 1000);
		if (diff < 60) return `${diff}s`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
		return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
	};

	return (
		<div className={`rounded-lg border p-4 ${getStatusColor()}`}>
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					{getStatusIcon()}
					<span className="font-medium text-sm">{getStatusLabel()}</span>
				</div>
				<span className="text-xs text-slate-500">
					{formatDuration(agentRun.startedAt, agentRun.finishedAt)}
				</span>
			</div>

			{/* Progress steps */}
			<div className="flex items-center gap-1 mb-3">
				<div
					className={`flex-1 h-1.5 rounded-full ${
						agentRun.status !== "creating"
							? "bg-blue-500"
							: "bg-blue-500 animate-pulse"
					}`}
				/>
				<div
					className={`flex-1 h-1.5 rounded-full ${
						agentRun.status === "running"
							? "bg-yellow-500 animate-pulse"
							: agentRun.status === "finished" || agentRun.status === "failed"
								? agentRun.status === "finished"
									? "bg-green-500"
									: "bg-red-500"
								: "bg-slate-200 dark:bg-slate-700"
					}`}
				/>
				<div
					className={`flex-1 h-1.5 rounded-full ${
						agentRun.status === "finished"
							? "bg-green-500"
							: agentRun.status === "failed"
								? "bg-red-500"
								: "bg-slate-200 dark:bg-slate-700"
					}`}
				/>
			</div>

			{/* Summary */}
			{agentRun.summary && (
				<p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
					{agentRun.summary}
				</p>
			)}

			{/* Error message */}
			{agentRun.errorMessage && (
				<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 mb-3">
					<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
					<span>{agentRun.errorMessage}</span>
				</div>
			)}

			{/* See Progress link - show when agent is active */}
			{agentRun.externalAgentId && (agentRun.status === "creating" || agentRun.status === "running") && (
				<a
					href={`https://cursor.com/agents/${agentRun.externalAgentId}`}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-3"
				>
					<Eye className="w-4 h-4" />
					See Progress
					<ExternalLink className="w-3 h-3" />
				</a>
			)}

			{/* PR link */}
			{agentRun.prUrl && (
				<div className="flex items-center justify-between">
					<a
						href={agentRun.prUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
					>
						<GitPullRequest className="w-4 h-4" />
						PR #{agentRun.prNumber}
						<ExternalLink className="w-3 h-3" />
					</a>
					{getPrStatusBadge()}
				</div>
			)}

			{/* Retry button for failed runs */}
			{agentRun.status === "failed" && onRetry && (
				<Button
					variant="outline"
					size="sm"
					onClick={onRetry}
					className="mt-3 w-full"
				>
					<RefreshCw className="w-4 h-4 mr-1" />
					Retry
				</Button>
			)}
		</div>
	);
}
