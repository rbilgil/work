import { useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface ContextSectionProps {
	title: string;
	icon: ReactNode;
	onAdd?: () => void;
	children: ReactNode;
	count?: number;
}

export default function ContextSection({
	title,
	icon,
	onAdd,
	children,
	count,
}: ContextSectionProps) {
	const [expanded, setExpanded] = useState(true);

	return (
		<div className="mb-4">
			<div className="flex items-center justify-between mb-2">
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
				>
					<ChevronDown
						className={cn(
							"w-4 h-4 transition-transform",
							!expanded && "-rotate-90",
						)}
					/>
					{icon}
					<span>{title}</span>
					{count !== undefined && count > 0 && (
						<span className="text-xs bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded">
							{count}
						</span>
					)}
				</button>
				{onAdd && (
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={onAdd}
						title={`Add ${title.toLowerCase()}`}
					>
						<Plus className="w-3.5 h-3.5" />
					</Button>
				)}
			</div>
			{expanded && <div className="flex flex-col gap-1 pl-6">{children}</div>}
		</div>
	);
}
