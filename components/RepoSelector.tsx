"use client";

import { useAction } from "convex/react";
import { Check, ChevronsUpDown, GitBranch, Loader2, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface Repo {
	id: number;
	fullName: string;
	owner: string;
	name: string;
	defaultBranch: string;
	private: boolean;
}

interface RepoSelectorProps {
	organizationId: Id<"organizations">;
	onSelect: (repo: { owner: string; name: string; defaultBranch: string }) => void;
	selectedRepo?: { owner: string; name: string } | null;
}

export default function RepoSelector({
	organizationId,
	onSelect,
	selectedRepo,
}: RepoSelectorProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [repos, setRepos] = useState<Repo[]>([]);
	const [loading, setLoading] = useState(false);
	const [initialLoading, setInitialLoading] = useState(true);

	const fetchGitHubRepos = useAction(api.integrations.fetchGitHubRepos);

	const loadRepos = useCallback(
		async (searchQuery?: string) => {
			setLoading(true);
			try {
				const result = await fetchGitHubRepos({
					organizationId,
					search: searchQuery,
				});
				setRepos(result);
			} catch (error) {
				console.error("Failed to fetch repos:", error);
				setRepos([]);
			} finally {
				setLoading(false);
				setInitialLoading(false);
			}
		},
		[fetchGitHubRepos, organizationId],
	);

	// Load initial repos when popover opens
	useEffect(() => {
		if (open && initialLoading) {
			loadRepos();
		}
	}, [open, initialLoading, loadRepos]);

	// Debounced search
	useEffect(() => {
		if (!open) return;

		const timer = setTimeout(() => {
			if (search.length >= 2) {
				loadRepos(search);
			} else if (search.length === 0) {
				loadRepos();
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [search, open, loadRepos]);

	const handleSelect = (repo: Repo) => {
		onSelect({
			owner: repo.owner,
			name: repo.name,
			defaultBranch: repo.defaultBranch,
		});
		setOpen(false);
	};

	const selectedValue = selectedRepo
		? `${selectedRepo.owner}/${selectedRepo.name}`
		: null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between font-normal"
				>
					{selectedValue ? (
						<span className="flex items-center gap-2">
							<GitBranch className="h-4 w-4 text-green-500" />
							<span className="font-mono text-sm">{selectedValue}</span>
						</span>
					) : (
						<span className="text-muted-foreground">Select a repository...</span>
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search repositories..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						{loading ? (
							<div className="flex items-center justify-center py-6">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						) : repos.length === 0 ? (
							<CommandEmpty>
								{search.length >= 2
									? "No repositories found."
									: "Type to search repositories..."}
							</CommandEmpty>
						) : (
							<CommandGroup>
								{repos.map((repo) => (
									<CommandItem
										key={repo.id}
										value={repo.fullName}
										onSelect={() => handleSelect(repo)}
										className="cursor-pointer"
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												selectedValue === repo.fullName
													? "opacity-100"
													: "opacity-0",
											)}
										/>
										<div className="flex flex-1 items-center justify-between">
											<div className="flex flex-col">
												<span className="font-mono text-sm">{repo.fullName}</span>
												<span className="text-xs text-muted-foreground">
													{repo.defaultBranch}
												</span>
											</div>
											{repo.private && (
												<Lock className="h-3 w-3 text-muted-foreground" />
											)}
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
