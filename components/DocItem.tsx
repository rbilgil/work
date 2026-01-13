import { useAction, useMutation } from "convex/react";
import { ExternalLink, FileText, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface DocItemProps {
	doc: {
		_id: Id<"workspace_docs">;
		title: string;
		content: string;
		sourceUrl?: string;
		sourceType?: "notion" | "manual";
		lastFetchedAt?: number;
	};
}

export default function DocItem({ doc }: DocItemProps) {
	const [viewOpen, setViewOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [title, setTitle] = useState(doc.title);
	const [content, setContent] = useState(doc.content);
	const [refreshing, setRefreshing] = useState(false);

	const updateDoc = useMutation(api.workspaces.updateDoc);
	const deleteDoc = useMutation(api.workspaces.deleteDoc);
	const refreshNotionDoc = useAction(api.notionApi.refreshNotionDoc);

	const isNotionDoc = doc.sourceType === "notion";

	const handleRefresh = async () => {
		if (!isNotionDoc) return;
		setRefreshing(true);
		try {
			const result = await refreshNotionDoc({ docId: doc._id });
			if (!result.success) {
				alert(result.error);
			}
		} catch (error) {
			console.error("Failed to refresh:", error);
			alert("Failed to refresh document");
		} finally {
			setRefreshing(false);
		}
	};

	const handleSave = async () => {
		await updateDoc({ id: doc._id, title, content });
		setEditing(false);
	};

	const handleDelete = async () => {
		if (confirm("Delete this document?")) {
			await deleteDoc({ id: doc._id });
			setViewOpen(false);
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={() => setViewOpen(true)}
				className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 py-1 px-2 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left w-full"
			>
				<FileText className="w-3.5 h-3.5 flex-shrink-0" />
				<span className="truncate">{doc.title}</span>
				{isNotionDoc && (
					<span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400 flex-shrink-0">
						Notion
					</span>
				)}
			</button>

			<Dialog open={viewOpen} onOpenChange={setViewOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
					<DialogHeader>
						{editing ? (
							<Input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="text-lg font-semibold"
							/>
						) : (
							<div className="flex items-center gap-2">
								<DialogTitle>{doc.title}</DialogTitle>
								{isNotionDoc && (
									<span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
										Notion
									</span>
								)}
							</div>
						)}
						{isNotionDoc && doc.sourceUrl && (
							<div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
								<a
									href={doc.sourceUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-blue-500 flex items-center gap-1"
								>
									Open in Notion <ExternalLink className="w-3 h-3" />
								</a>
								{doc.lastFetchedAt && (
									<span>
										• Last synced:{" "}
										{new Date(doc.lastFetchedAt).toLocaleDateString()}
									</span>
								)}
							</div>
						)}
					</DialogHeader>
					<div className="flex-1 overflow-y-auto">
						{editing ? (
							<Textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								className="min-h-[300px] resize-none"
								placeholder="Write your document content here..."
							/>
						) : (
							<div className="prose prose-xs dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-semibold prose-p:text-xs prose-p:leading-relaxed prose-li:text-xs prose-code:text-xs prose-pre:text-xs">
								{doc.content ? (
									<ReactMarkdown>{doc.content}</ReactMarkdown>
								) : (
									<span className="text-slate-400 text-xs">No content yet</span>
								)}
							</div>
						)}
					</div>
					<div className="flex justify-between pt-4 border-t">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDelete}
							className="text-red-600 hover:text-red-700"
						>
							<Trash2 className="w-4 h-4 mr-1" />
							Delete
						</Button>
						<div className="flex gap-2">
							{isNotionDoc && !editing && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleRefresh}
									disabled={refreshing}
								>
									{refreshing ? (
										<Loader2 className="w-4 h-4 mr-1 animate-spin" />
									) : (
										<RefreshCw className="w-4 h-4 mr-1" />
									)}
									Refresh
								</Button>
							)}
							{editing ? (
								<>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setEditing(false);
											setTitle(doc.title);
											setContent(doc.content);
										}}
									>
										Cancel
									</Button>
									<Button size="sm" onClick={handleSave}>
										Save
									</Button>
								</>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setEditing(true)}
								>
									Edit
								</Button>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
