import { useMutation } from "convex/react";
import {
	ExternalLink,
	Mail,
	FileSpreadsheet,
	Figma,
	FileText,
	Link as LinkIcon,
	Trash2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface LinkItemProps {
	link: {
		_id: Id<"workspace_links">;
		url: string;
		title: string;
		type: "email" | "spreadsheet" | "figma" | "document" | "other";
	};
}

const typeIcons = {
	email: Mail,
	spreadsheet: FileSpreadsheet,
	figma: Figma,
	document: FileText,
	other: LinkIcon,
};

export default function LinkItem({ link }: LinkItemProps) {
	const deleteLink = useMutation(api.workspaces.deleteLink);

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		await deleteLink({ id: link._id });
	};

	const Icon = typeIcons[link.type];

	return (
		<div className="group flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
			<Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
			<a
				href={link.url}
				target="_blank"
				rel="noopener noreferrer"
				className="flex-1 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 truncate flex items-center gap-1"
			>
				{link.title}
				<ExternalLink className="w-3 h-3 opacity-50" />
			</a>
			<button
				type="button"
				onClick={handleDelete}
				className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
				title="Delete link"
			>
				<Trash2 className="w-3.5 h-3.5" />
			</button>
		</div>
	);
}
