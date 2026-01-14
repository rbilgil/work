import { useQuery } from "convex/react";
import { Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface WorkspaceSidebarProps {
	organizationId: Id<"organizations">;
	selectedWorkspaceId: Id<"workspaces"> | null;
	onSelectWorkspace: (id: Id<"workspaces"> | null) => void;
	onNewWorkspace: () => void;
}

export default function WorkspaceSidebar({
	organizationId,
	selectedWorkspaceId,
	onSelectWorkspace,
	onNewWorkspace,
}: WorkspaceSidebarProps) {
	const workspaces = useQuery(api.workspaces.listWorkspaces, {
		organizationId,
	});

	return (
		<div className="p-4 flex flex-col gap-4 h-full bg-slate-50 dark:bg-slate-900">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
					Workspaces
				</h2>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onNewWorkspace}
					title="New Workspace"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>
			<div className="flex flex-col gap-1 overflow-y-auto">
				{workspaces?.map((workspace) => (
					<Button
						key={workspace._id}
						variant="ghost"
						size="sm"
						className={cn(
							"justify-start gap-2 font-normal",
							selectedWorkspaceId === workspace._id &&
								"bg-slate-200 dark:bg-slate-800 font-medium",
						)}
						onClick={() => onSelectWorkspace(workspace._id)}
					>
						{workspace.icon ? (
							<span className="text-base">{workspace.icon}</span>
						) : (
							<Briefcase className="w-4 h-4 opacity-70" />
						)}
						<span className="truncate">{workspace.name}</span>
					</Button>
				))}
				{workspaces?.length === 0 && (
					<p className="text-sm text-slate-500 px-2">
						No workspaces yet. Create one to get started!
					</p>
				)}
			</div>
		</div>
	);
}
