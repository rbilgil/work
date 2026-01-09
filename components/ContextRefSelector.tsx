"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
	FileText,
	Link as LinkIcon,
	Loader2,
	MessageSquare,
	Plus,
	Search,
	Sparkles,
	X,
} from "lucide-react";

interface ContextRef {
	refType: "doc" | "message" | "link";
	refId: string;
	title?: string;
}

interface ContextRefSelectorProps {
	workspaceId: Id<"workspaces">;
	todoId?: Id<"workspace_todos">;
	todoTitle?: string;
	selectedRefs: ContextRef[];
	onRefsChange: (refs: ContextRef[]) => void;
	compact?: boolean;
}

interface Suggestion {
	refType: "doc" | "message" | "link";
	refId: string;
	title: string;
	relevanceScore: number;
	reason: string;
}

export default function ContextRefSelector({
	workspaceId,
	todoId,
	todoTitle,
	selectedRefs,
	onRefsChange,
	compact = false,
}: ContextRefSelectorProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const [showAllItems, setShowAllItems] = useState(false);

	const suggestContext = useAction(api.todoContextAi.suggestContextForTodo);

	// Get workspace content for manual selection
	const docs = useQuery(api.workspaces.listDocs, { workspaceId });
	const links = useQuery(api.workspaces.listLinks, { workspaceId });
	const messages = useQuery(api.workspaces.listMessages, { workspaceId });

	// Auto-suggest context when title changes
	useEffect(() => {
		if (todoTitle && todoTitle.length > 5) {
			const debounceTimer = setTimeout(async () => {
				setLoadingSuggestions(true);
				try {
					const result = await suggestContext({
						workspaceId,
						todoTitle,
					});
					setSuggestions(result.suggestions);
				} catch (error) {
					console.error("Error getting suggestions:", error);
				} finally {
					setLoadingSuggestions(false);
				}
			}, 500);
			return () => clearTimeout(debounceTimer);
		}
	}, [todoTitle, workspaceId, suggestContext]);

	const isSelected = (refType: string, refId: string) => {
		return selectedRefs.some(
			(ref) => ref.refType === refType && ref.refId === refId,
		);
	};

	const toggleRef = (refType: "doc" | "message" | "link", refId: string, title?: string) => {
		if (isSelected(refType, refId)) {
			onRefsChange(
				selectedRefs.filter(
					(ref) => !(ref.refType === refType && ref.refId === refId),
				),
			);
		} else {
			onRefsChange([...selectedRefs, { refType, refId, title }]);
		}
	};

	const removeRef = (refType: string, refId: string) => {
		onRefsChange(
			selectedRefs.filter(
				(ref) => !(ref.refType === refType && ref.refId === refId),
			),
		);
	};

	const getRefIcon = (refType: string) => {
		switch (refType) {
			case "doc":
				return <FileText className="w-4 h-4 text-blue-500" />;
			case "message":
				return <MessageSquare className="w-4 h-4 text-green-500" />;
			case "link":
				return <LinkIcon className="w-4 h-4 text-purple-500" />;
			default:
				return null;
		}
	};

	// Filter items based on search
	const filteredDocs = docs?.filter(
		(doc) =>
			doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			doc.content?.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const filteredLinks = links?.filter(
		(link) =>
			link.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			link.url.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const filteredMessages = messages?.filter((msg) =>
		msg.content.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	if (compact) {
		return (
			<div className="flex flex-col gap-2">
				{/* Selected refs as chips */}
				{selectedRefs.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{selectedRefs.map((ref) => (
							<span
								key={`${ref.refType}-${ref.refId}`}
								className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-full"
							>
								{getRefIcon(ref.refType)}
								<span className="max-w-[100px] truncate">
									{ref.title || ref.refId.slice(0, 8)}
								</span>
								<button
									onClick={() => removeRef(ref.refType, ref.refId)}
									className="ml-0.5 hover:text-red-500"
								>
									<X className="w-3 h-3" />
								</button>
							</span>
						))}
					</div>
				)}

				{/* Add context button */}
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" size="sm" className="w-fit">
							<Plus className="w-4 h-4 mr-1" />
							Link Context
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-80 p-0" align="start">
						<div className="p-2 border-b">
							<div className="relative">
								<Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
								<Input
									placeholder="Search context..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-8"
								/>
							</div>
						</div>
						<ScrollArea className="h-64">
							<div className="p-2">
								{/* AI Suggestions */}
								{suggestions.length > 0 && (
									<>
										<div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500">
											<Sparkles className="w-3 h-3" />
											Suggested
										</div>
										{suggestions.map((suggestion) => (
											<div
												key={`suggestion-${suggestion.refType}-${suggestion.refId}`}
												className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
												onClick={() =>
													toggleRef(
														suggestion.refType,
														suggestion.refId,
														suggestion.title,
													)
												}
											>
												<Checkbox
													checked={isSelected(
														suggestion.refType,
														suggestion.refId,
													)}
												/>
												{getRefIcon(suggestion.refType)}
												<div className="flex-1 min-w-0">
													<p className="text-sm truncate">
														{suggestion.title}
													</p>
													<p className="text-xs text-slate-500 truncate">
														{suggestion.reason}
													</p>
												</div>
											</div>
										))}
										<Separator className="my-2" />
									</>
								)}

								{loadingSuggestions && (
									<div className="flex items-center justify-center py-4">
										<Loader2 className="w-4 h-4 animate-spin mr-2" />
										<span className="text-sm text-slate-500">
											Finding relevant context...
										</span>
									</div>
								)}

								{/* Documents */}
								{filteredDocs && filteredDocs.length > 0 && (
									<>
										<div className="px-2 py-1 text-xs font-medium text-slate-500">
											Documents
										</div>
										{filteredDocs.slice(0, 5).map((doc) => (
											<div
												key={`doc-${doc._id}`}
												className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
												onClick={() => toggleRef("doc", doc._id, doc.title)}
											>
												<Checkbox checked={isSelected("doc", doc._id)} />
												{getRefIcon("doc")}
												<span className="text-sm truncate">{doc.title}</span>
											</div>
										))}
									</>
								)}

								{/* Links */}
								{filteredLinks && filteredLinks.length > 0 && (
									<>
										<div className="px-2 py-1 text-xs font-medium text-slate-500 mt-2">
											Links
										</div>
										{filteredLinks.slice(0, 5).map((link) => (
											<div
												key={`link-${link._id}`}
												className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
												onClick={() =>
													toggleRef("link", link._id, link.title || link.url)
												}
											>
												<Checkbox checked={isSelected("link", link._id)} />
												{getRefIcon("link")}
												<span className="text-sm truncate">
													{link.title || link.url}
												</span>
											</div>
										))}
									</>
								)}

								{/* Messages */}
								{filteredMessages && filteredMessages.length > 0 && (
									<>
										<div className="px-2 py-1 text-xs font-medium text-slate-500 mt-2">
											Messages
										</div>
										{filteredMessages.slice(0, 5).map((msg) => (
											<div
												key={`msg-${msg._id}`}
												className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
												onClick={() =>
													toggleRef(
														"message",
														msg._id,
														msg.content.slice(0, 50),
													)
												}
											>
												<Checkbox checked={isSelected("message", msg._id)} />
												{getRefIcon("message")}
												<span className="text-sm truncate">
													{msg.content.slice(0, 50)}
													{msg.content.length > 50 ? "..." : ""}
												</span>
											</div>
										))}
									</>
								)}

								{!loadingSuggestions &&
									!filteredDocs?.length &&
									!filteredLinks?.length &&
									!filteredMessages?.length && (
										<p className="text-sm text-slate-500 text-center py-4">
											No context items found
										</p>
									)}
							</div>
						</ScrollArea>
					</PopoverContent>
				</Popover>
			</div>
		);
	}

	// Full view for detail modal
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h4 className="font-medium text-sm">Linked Context</h4>
				{loadingSuggestions && (
					<span className="flex items-center gap-1 text-xs text-slate-500">
						<Loader2 className="w-3 h-3 animate-spin" />
						Analyzing...
					</span>
				)}
			</div>

			{/* Selected refs */}
			{selectedRefs.length > 0 && (
				<div className="flex flex-col gap-1">
					{selectedRefs.map((ref) => (
						<div
							key={`${ref.refType}-${ref.refId}`}
							className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
						>
							<div className="flex items-center gap-2">
								{getRefIcon(ref.refType)}
								<span className="text-sm">
									{ref.title || ref.refId.slice(0, 20)}
								</span>
							</div>
							<button
								onClick={() => removeRef(ref.refType, ref.refId)}
								className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
					))}
				</div>
			)}

			{/* AI Suggestions */}
			{suggestions.length > 0 && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1 text-xs font-medium text-slate-500">
						<Sparkles className="w-3 h-3" />
						AI Suggestions
					</div>
					{suggestions
						.filter((s) => !isSelected(s.refType, s.refId))
						.map((suggestion) => (
							<div
								key={`suggestion-${suggestion.refType}-${suggestion.refId}`}
								className="flex items-center justify-between px-3 py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
								onClick={() =>
									toggleRef(suggestion.refType, suggestion.refId, suggestion.title)
								}
							>
								<div className="flex items-center gap-2">
									{getRefIcon(suggestion.refType)}
									<div>
										<p className="text-sm">{suggestion.title}</p>
										<p className="text-xs text-slate-500">{suggestion.reason}</p>
									</div>
								</div>
								<Button variant="ghost" size="sm">
									<Plus className="w-4 h-4" />
								</Button>
							</div>
						))}
				</div>
			)}

			{/* Add more button */}
			<Popover open={showAllItems} onOpenChange={setShowAllItems}>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="w-fit">
						<Plus className="w-4 h-4 mr-1" />
						Add Context
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-96 p-0" align="start">
					<div className="p-3 border-b">
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
							<Input
								placeholder="Search documents, links, messages..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
					</div>
					<ScrollArea className="h-80">
						<div className="p-2">
							{/* Documents */}
							{filteredDocs && filteredDocs.length > 0 && (
								<div className="mb-4">
									<div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
										<FileText className="w-3 h-3" />
										Documents ({filteredDocs.length})
									</div>
									{filteredDocs.map((doc) => (
										<div
											key={`doc-${doc._id}`}
											className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group"
											onClick={() => toggleRef("doc", doc._id, doc.title)}
										>
											<Checkbox
												checked={isSelected("doc", doc._id)}
												className="data-[state=checked]:bg-blue-500"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">
													{doc.title}
												</p>
												{doc.content && (
													<p className="text-xs text-slate-500 truncate">
														{doc.content.slice(0, 80)}
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							)}

							{/* Links */}
							{filteredLinks && filteredLinks.length > 0 && (
								<div className="mb-4">
									<div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
										<LinkIcon className="w-3 h-3" />
										Links ({filteredLinks.length})
									</div>
									{filteredLinks.map((link) => (
										<div
											key={`link-${link._id}`}
											className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group"
											onClick={() =>
												toggleRef("link", link._id, link.title || link.url)
											}
										>
											<Checkbox
												checked={isSelected("link", link._id)}
												className="data-[state=checked]:bg-purple-500"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">
													{link.title || link.url}
												</p>
												<p className="text-xs text-slate-500 truncate">
													{link.url}
												</p>
											</div>
										</div>
									))}
								</div>
							)}

							{/* Messages */}
							{filteredMessages && filteredMessages.length > 0 && (
								<div className="mb-4">
									<div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
										<MessageSquare className="w-3 h-3" />
										Messages ({filteredMessages.length})
									</div>
									{filteredMessages.map((msg) => (
										<div
											key={`msg-${msg._id}`}
											className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group"
											onClick={() =>
												toggleRef("message", msg._id, msg.content.slice(0, 50))
											}
										>
											<Checkbox
												checked={isSelected("message", msg._id)}
												className="data-[state=checked]:bg-green-500"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm truncate">{msg.content}</p>
												<p className="text-xs text-slate-500">
													{new Date(msg.createdAt).toLocaleDateString()}
												</p>
											</div>
										</div>
									))}
								</div>
							)}

							{!filteredDocs?.length &&
								!filteredLinks?.length &&
								!filteredMessages?.length && (
									<div className="text-center py-8">
										<p className="text-sm text-slate-500">
											{searchQuery
												? "No matching items found"
												: "No context items in this workspace"}
										</p>
									</div>
								)}
						</div>
					</ScrollArea>
				</PopoverContent>
			</Popover>
		</div>
	);
}
