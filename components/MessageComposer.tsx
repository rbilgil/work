import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
	onSend: (content: string) => Promise<void>;
	placeholder?: string;
}

export default function MessageComposer({
	onSend,
	placeholder = "Type a message...",
}: MessageComposerProps) {
	const [content, setContent] = useState("");
	const [sending, setSending] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || sending) return;

		setSending(true);
		try {
			await onSend(content);
			setContent("");
		} finally {
			setSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="p-4 border-t border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-950"
		>
			<div className="flex gap-2">
				<Textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="resize-none min-h-[60px] max-h-[200px]"
					rows={2}
				/>
				<Button
					type="submit"
					disabled={!content.trim() || sending}
					size="icon"
					className="flex-shrink-0 h-[60px] w-10"
				>
					<Send className="w-4 h-4" />
				</Button>
			</div>
			<p className="text-xs text-slate-400 mt-1">
				Press Enter to send, Shift+Enter for new line
			</p>
		</form>
	);
}
