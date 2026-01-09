import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";

interface WorkspaceCreateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const EMOJI_OPTIONS = ["📁", "🚀", "💡", "🎯", "📊", "🔧", "📝", "🎨"];

export default function WorkspaceCreateModal({
	open,
	onOpenChange,
}: WorkspaceCreateModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [icon, setIcon] = useState("");
	const [creating, setCreating] = useState(false);

	const createWorkspace = useMutation(api.workspaces.createWorkspace);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || creating) return;

		setCreating(true);
		try {
			await createWorkspace({
				name: name.trim(),
				description: description.trim() || undefined,
				icon: icon || undefined,
			});
			setName("");
			setDescription("");
			setIcon("");
			onOpenChange(false);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create Workspace</DialogTitle>
					<DialogDescription>
						Create a new unit of work to organize your discussions, docs, and
						tasks.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label htmlFor="name" className="text-sm font-medium">
							Name
						</label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Q1 Product Launch"
							autoFocus
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="description" className="text-sm font-medium">
							Description (optional)
						</label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="What is this workspace about?"
							rows={2}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium">Icon (optional)</label>
						<div className="flex gap-2 flex-wrap">
							{EMOJI_OPTIONS.map((emoji) => (
								<button
									key={emoji}
									type="button"
									onClick={() => setIcon(icon === emoji ? "" : emoji)}
									className={`w-9 h-9 text-lg rounded-md border transition-colors ${
										icon === emoji
											? "border-blue-500 bg-blue-50 dark:bg-blue-950"
											: "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
									}`}
								>
									{emoji}
								</button>
							))}
						</div>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!name.trim() || creating}>
							{creating ? "Creating..." : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
