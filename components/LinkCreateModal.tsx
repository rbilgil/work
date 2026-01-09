import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

interface LinkCreateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workspaceId: Id<"workspaces">;
}

type LinkType = "email" | "spreadsheet" | "figma" | "document" | "other";

export default function LinkCreateModal({
	open,
	onOpenChange,
	workspaceId,
}: LinkCreateModalProps) {
	const [url, setUrl] = useState("");
	const [title, setTitle] = useState("");
	const [type, setType] = useState<LinkType>("other");
	const [creating, setCreating] = useState(false);

	const createLink = useMutation(api.workspaces.createLink);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!url.trim() || !title.trim() || creating) return;

		setCreating(true);
		try {
			await createLink({
				workspaceId,
				url: url.trim(),
				title: title.trim(),
				type,
			});
			setUrl("");
			setTitle("");
			setType("other");
			onOpenChange(false);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add Link</DialogTitle>
					<DialogDescription>
						Link to external resources like emails, spreadsheets, or Figma
						files.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label htmlFor="link-url" className="text-sm font-medium">
							URL
						</label>
						<Input
							id="link-url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://..."
							type="url"
							autoFocus
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="link-title" className="text-sm font-medium">
							Title
						</label>
						<Input
							id="link-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g., Design mockups"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="link-type" className="text-sm font-medium">
							Type
						</label>
						<Select
							value={type}
							onValueChange={(v) => setType(v as LinkType)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="email">Email</SelectItem>
								<SelectItem value="spreadsheet">Spreadsheet</SelectItem>
								<SelectItem value="figma">Figma</SelectItem>
								<SelectItem value="document">Document</SelectItem>
								<SelectItem value="other">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!url.trim() || !title.trim() || creating}
						>
							{creating ? "Adding..." : "Add Link"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
