import { useMutation } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface DocCreateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaceId: Id<"workspaces">;
}

export default function DocCreateModal({
	open,
	onOpenChange,
	workspaceId,
}: DocCreateModalProps) {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [creating, setCreating] = useState(false);

	const createDoc = useMutation(api.workspaces.createDoc);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || creating) return;

		setCreating(true);
		try {
			await createDoc({
				workspaceId,
				title: title.trim(),
				content: content.trim(),
			});
			setTitle("");
			setContent("");
			onOpenChange(false);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Create Document</DialogTitle>
					<DialogDescription>
						Add a document to this workspace for PRDs, RFCs, notes, etc.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label htmlFor="doc-title" className="text-sm font-medium">
							Title
						</label>
						<Input
							id="doc-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g., Product Requirements"
							autoFocus
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="doc-content" className="text-sm font-medium">
							Content
						</label>
						<Textarea
							id="doc-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Write your document content here... (Markdown supported)"
							rows={8}
						/>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!title.trim() || creating}>
							{creating ? "Creating..." : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
