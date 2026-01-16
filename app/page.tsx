"use client";

import { motion } from "framer-motion";
import {
	ArrowRight,
	Bot,
	CheckCircle2,
	FileText,
	GitBranch,
	Layers,
	MessageSquare,
	Play,
	Sparkles,
	Tornado,
	Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Animation variants
const fadeInUp = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.1 },
	},
};

// Navigation
function Navigation() {
	return (
		<motion.nav
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.6 }}
			className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#FAFAF8]/80 backdrop-blur-md border-b border-stone-200/50"
		>
			<div className="max-w-5xl mx-auto flex items-center justify-between">
				<Link href="/" className="flex items-center gap-2.5">
					<div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center">
						<Tornado className="w-4.5 h-4.5 text-white" />
					</div>
					<span className="text-lg font-semibold text-stone-900 tracking-tight">
						Whirl
					</span>
				</Link>
				<div className="hidden md:flex items-center gap-8">
					<a
						href="#problem"
						className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
					>
						The Problem
					</a>
					<a
						href="#solution"
						className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
					>
						How It Works
					</a>
					<a
						href="#vision"
						className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
					>
						Vision
					</a>
				</div>
				<Link
					href="/waitlist"
					className="px-4 py-2 text-sm font-medium rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors"
				>
					Join Waitlist
				</Link>
			</div>
		</motion.nav>
	);
}

// Hero Section
function Hero() {
	return (
		<section className="relative min-h-[90vh] flex flex-col justify-center pt-24 pb-16">
			{/* Subtle background pattern */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-20 right-[10%] w-72 h-72 bg-teal-100 rounded-full blur-3xl opacity-40" />
				<div className="absolute bottom-20 left-[10%] w-96 h-96 bg-orange-100 rounded-full blur-3xl opacity-30" />
			</div>

			<div className="relative z-10 max-w-5xl mx-auto px-6">
				<motion.div
					initial="hidden"
					animate="visible"
					variants={staggerContainer}
					className="text-center"
				>
					{/* Badge */}
					<motion.div
						variants={fadeInUp}
						className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-8"
					>
						<Sparkles className="w-3.5 h-3.5 text-teal-600" />
						<span className="text-sm font-medium text-teal-700">
							Coming Soon
						</span>
					</motion.div>

					{/* Headline */}
					<motion.h1
						variants={fadeInUp}
						className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-stone-900 mb-6 leading-[1.1]"
					>
						Your product builds itself
						<br />
						<span className="text-teal-700">while you sleep</span>
					</motion.h1>

					{/* Subheadline */}
					<motion.p
						variants={fadeInUp}
						className="text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed"
					>
						Stop being the bottleneck. Whirl unifies your team&apos;s discussions, 
						decisions, and context, giving autonomous AI agents everything 
						they need to keep shipping 24/7.
					</motion.p>

					{/* CTA */}
					<motion.div
						variants={fadeInUp}
						className="flex flex-col sm:flex-row items-center justify-center gap-4"
					>
						<Link
							href="/waitlist"
							className="group px-6 py-3.5 rounded-full bg-terracotta text-white font-medium flex items-center gap-2 hover:bg-terracotta-dark transition-all duration-200 shadow-sm hover:shadow-md"
						>
							Request Early Access
							<ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
						</Link>
						<span className="text-sm text-stone-400">
							Be first in line when we launch
						</span>
					</motion.div>
				</motion.div>

				{/* Product Preview */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, delay: 0.4 }}
					className="mt-16 relative"
				>
					<div className="relative max-w-4xl mx-auto rounded-xl overflow-hidden border border-stone-200 bg-white shadow-2xl shadow-stone-200/50">
						{/* Window chrome */}
						<div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200">
							<div className="flex gap-1.5">
								<div className="w-3 h-3 rounded-full bg-stone-300" />
								<div className="w-3 h-3 rounded-full bg-stone-300" />
								<div className="w-3 h-3 rounded-full bg-stone-300" />
							</div>
							<div className="flex-1 flex justify-center">
								<div className="px-4 py-1 rounded-md bg-stone-100 text-xs text-stone-400">
									whirl.sh
								</div>
							</div>
						</div>

						{/* Video placeholder */}
						<div className="aspect-[16/9] bg-gradient-to-br from-stone-900 to-stone-800 flex items-center justify-center relative overflow-hidden group cursor-pointer">
							{/* Subtle pattern overlay */}
							<div className="absolute inset-0 opacity-5">
								<div className="absolute inset-0" style={{
									backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
									backgroundSize: '24px 24px'
								}} />
							</div>

							{/* Play button */}
							<motion.div
								className="relative z-10 w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-all duration-300"
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.95 }}
							>
								<div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
									<Play className="w-7 h-7 text-stone-900 ml-1" fill="currentColor" />
								</div>
							</motion.div>

							{/* Video label */}
							<div className="absolute bottom-4 left-4 flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
								<span className="text-white/60 text-sm font-medium">Watch Demo</span>
							</div>

							{/* Duration badge */}
							<div className="absolute bottom-4 right-4">
								<span className="text-white/40 text-sm font-mono">2:34</span>
							</div>
						</div>
					</div>

					{/* Floating elements */}
					<div className="absolute top-[15%] -right-4 lg:-right-56 xl:-right-64 hidden md:block">
						<motion.div
							className="p-3 rounded-lg bg-white border border-stone-200 shadow-lg"
							animate={{ y: [0, -8, 0] }}
							transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
						>
							<div className="flex items-center gap-2.5">
								<div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
									<CheckCircle2 className="w-4 h-4 text-green-600" />
								</div>
								<div>
									<p className="text-sm font-medium text-stone-700">
										PRs ready for review
									</p>
									<p className="text-xs text-stone-400">while you were asleep</p>
								</div>
							</div>
						</motion.div>
					</div>

					<div className="absolute bottom-[10%] -left-4 lg:-left-56 xl:-left-64 hidden md:block">
						<motion.div
							className="p-3 rounded-lg bg-white border border-stone-200 shadow-lg"
							animate={{ y: [0, 8, 0] }}
							transition={{
								duration: 5,
								repeat: Infinity,
								ease: "easeInOut",
								delay: 1,
							}}
						>
							<div className="flex items-center gap-2.5">
								<div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
									<Bot className="w-4 h-4 text-teal-600" />
								</div>
								<div>
									<p className="text-sm font-medium text-stone-700">
										Agents working 24/7
									</p>
									<p className="text-xs text-stone-400">
										0 tickets left in Backlog
									</p>
								</div>
							</div>
						</motion.div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// Tool Icons (inline SVGs for tools without public assets)
const NotionIcon = () => (
	<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
		<path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
	</svg>
);

const GoogleDocsIcon = () => (
	<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
		<path d="M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z" />
	</svg>
);

const GmailIcon = () => (
	<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
		<path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
	</svg>
);

// Scattered Tools Visualization
function ScatteredToolsViz() {
	const tools = [
		{
			name: "Slack",
			bgColor: "#FDF2F4",
			x: "8%",
			y: "15%",
			delay: 0,
			iconSrc: "/slack.svg",
		},
		{
			name: "Notion",
			bgColor: "#F5F5F5",
			x: "75%",
			y: "8%",
			delay: 0.5,
			Icon: NotionIcon,
			color: "#000000",
		},
		{
			name: "Linear",
			bgColor: "#18181B",
			x: "85%",
			y: "55%",
			delay: 1,
			iconSrc: "/linear-icon.svg",
			darkBg: true,
		},
		{
			name: "Docs",
			bgColor: "#EBF3FE",
			x: "15%",
			y: "65%",
			delay: 1.5,
			Icon: GoogleDocsIcon,
			color: "#4285F4",
		},
		{
			name: "Email",
			bgColor: "#FEF1F0",
			x: "50%",
			y: "75%",
			delay: 2,
			Icon: GmailIcon,
			color: "#EA4335",
		},
		{
			name: "Figma",
			bgColor: "#F6EFFE",
			x: "45%",
			y: "5%",
			delay: 0.8,
			iconSrc: "/figma.svg",
		},
	];

	return (
		<div className="relative h-64 sm:h-80 mb-16">
			{/* Connecting lines SVG */}
			<svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
				<motion.line
					x1="15%"
					y1="25%"
					x2="50%"
					y2="15%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.5 }}
					transition={{ duration: 1.5, delay: 0.2 }}
				/>
				<motion.line
					x1="55%"
					y1="15%"
					x2="80%"
					y2="18%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.5 }}
					transition={{ duration: 1.5, delay: 0.4 }}
				/>
				<motion.line
					x1="82%"
					y1="25%"
					x2="88%"
					y2="55%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.5 }}
					transition={{ duration: 1.5, delay: 0.6 }}
				/>
				<motion.line
					x1="85%"
					y1="65%"
					x2="55%"
					y2="80%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.5 }}
					transition={{ duration: 1.5, delay: 0.8 }}
				/>
				<motion.line
					x1="45%"
					y1="80%"
					x2="20%"
					y2="70%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.5 }}
					transition={{ duration: 1.5, delay: 1 }}
				/>
				<motion.line
					x1="18%"
					y1="60%"
					x2="15%"
					y2="30%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.5 }}
					transition={{ duration: 1.5, delay: 1.2 }}
				/>
				{/* Cross lines for chaos */}
				<motion.line
					x1="20%"
					y1="25%"
					x2="80%"
					y2="60%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.3 }}
					transition={{ duration: 2, delay: 1.5 }}
				/>
				<motion.line
					x1="50%"
					y1="15%"
					x2="25%"
					y2="70%"
					stroke="#d4d4d4"
					strokeWidth="1"
					strokeDasharray="4 4"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 0.3 }}
					transition={{ duration: 2, delay: 1.7 }}
				/>
			</svg>

			{/* Floating tool cards */}
			{tools.map((tool, i) => (
				<motion.div
					key={tool.name}
					className={`absolute px-3 py-2 rounded-full shadow-lg border cursor-pointer ${tool.darkBg ? "border-stone-700" : "border-stone-200"}`}
					style={{
						left: tool.x,
						top: tool.y,
						backgroundColor: tool.bgColor,
						zIndex: 10,
					}}
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{
						opacity: 1,
						scale: 1,
						y: [0, -8, 0, 5, 0],
						x: [0, 3, -3, 2, 0],
					}}
					transition={{
						opacity: { duration: 0.5, delay: tool.delay },
						scale: { duration: 0.5, delay: tool.delay },
						y: {
							duration: 4 + i * 0.5,
							repeat: Infinity,
							ease: "easeInOut",
							delay: tool.delay,
						},
						x: {
							duration: 5 + i * 0.3,
							repeat: Infinity,
							ease: "easeInOut",
							delay: tool.delay,
						},
					}}
					whileHover={{
						scale: 1.1,
						boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
					}}
				>
					<div
						className="flex items-center gap-2"
						style={{ color: tool.color }}
					>
						{tool.iconSrc ? (
							<Image
								src={tool.iconSrc}
								alt={tool.name}
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						) : tool.Icon ? (
							<tool.Icon />
						) : null}
						<span
							className={`text-sm font-medium ${tool.darkBg ? "text-white" : "text-stone-700"}`}
						>
							{tool.name}
						</span>
					</div>
				</motion.div>
			))}

			{/* Center question mark or confused state */}
			<motion.div
				className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center z-20"
				animate={{
					rotate: [0, 5, -5, 0],
					scale: [1, 1.05, 1],
				}}
				transition={{
					duration: 3,
					repeat: Infinity,
					ease: "easeInOut",
				}}
			>
				<span className="text-2xl text-stone-400">?</span>
			</motion.div>
		</div>
	);
}

// Problem Section
function ProblemSection() {
	return (
		<section id="problem" className="py-24 bg-white">
			<div className="max-w-5xl mx-auto px-6">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-100px" }}
					variants={staggerContainer}
					className="max-w-3xl"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block text-sm font-medium text-teal-600 mb-4"
					>
						The Problem
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-3xl sm:text-4xl font-bold text-stone-900 mb-6 leading-tight"
					>
						The world doesn&apos;t wait.
						<br />
						Why should your product?
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-stone-500 mb-12 leading-relaxed"
					>
						Every night, every weekend, every lunch break—your progress hits
						a wall. AI tools exist, but they&apos;re stuck waiting for your input. 
						Context is buried in Slack and docs. You&apos;re the only bridge between 
						the plan and the code.
					</motion.p>
				</motion.div>

				{/* Scattered tools visualization */}
				<ScatteredToolsViz />

				{/* Pain points */}
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid md:grid-cols-2 gap-6"
				>
					<motion.div
						variants={fadeInUp}
						className="p-6 rounded-xl border border-stone-200 bg-white"
					>
						<h3 className="text-lg font-semibold text-stone-900 mb-3">
							AI shouldn&apos;t need a babysitter
						</h3>
						<p className="text-stone-500 leading-relaxed">
							Most AI agents turn into a constant back-and-forth. You spend 
							more time managing the prompt than you would have spent doing the work.
						</p>
					</motion.div>
					<motion.div
						variants={fadeInUp}
						className="p-6 rounded-xl border border-stone-200 bg-white"
					>
						<h3 className="text-lg font-semibold text-stone-900 mb-3">
							Your context is a ghost town
						</h3>
						<p className="text-stone-500 leading-relaxed">
							Crucial product decisions are scattered across a dozen tools in 
							formats that AI can&apos;t navigate or understand.
						</p>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// Solution Section
function SolutionSection() {
	const steps = [
		{
			number: "01",
			title: "Context as Infrastructure",
			description:
				"Your specs, Slack threads, and documentation become a structured workspace—a living codebase for your product requirements.",
			icon: Layers,
		},
		{
			number: "02",
			title: "Define the Mission",
			description:
				"Queue up high-level objectives. Attach relevant context and constraints. Set the direction and let Whirl handle the orchestration.",
			icon: MessageSquare,
		},
		{
			number: "03",
			title: "Autonomous Execution",
			description:
				"Close your laptop and walk away. Our agents keep shipping through the night, through the weekend, and through your vacation.",
			icon: Bot,
		},
		{
			number: "04",
			title: "The Ultimate Morning Routine",
			description:
				"Morning coffee hits different when there's completed work, fresh PRs, and resolved tickets waiting for your review.",
			icon: Zap,
		},
	];

	return (
		<section id="solution" className="py-24 bg-stone-50">
			<div className="max-w-5xl mx-auto px-6">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-100px" }}
					variants={staggerContainer}
					className="max-w-3xl mb-16"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block text-sm font-medium text-teal-600 mb-4"
					>
						How It Works
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-3xl sm:text-4xl font-bold text-stone-900 mb-6 leading-tight"
					>
						Reclaim the hours
						<br />
						you&apos;re not at your desk.
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-stone-500 leading-relaxed"
					>
						Whirl unifies your product context so AI agents can work
						autonomously—turning nights, weekends, and downtime into productive
						hours.
					</motion.p>
				</motion.div>

				<div className="grid sm:grid-cols-2 gap-6">
					{steps.map((step, index) => (
						<motion.div
							key={step.number}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: index * 0.1 }}
							className="relative p-6 rounded-xl bg-white border border-stone-200"
						>
							<div className="flex items-start gap-4">
								<div className="flex-shrink-0 w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
									<step.icon className="w-5 h-5 text-teal-600" />
								</div>
								<div>
									<span className="text-xs font-mono text-stone-400 mb-1 block">
										{step.number}
									</span>
									<h3 className="text-lg font-semibold text-stone-900 mb-2">
										{step.title}
									</h3>
									<p className="text-sm text-stone-500 leading-relaxed">
										{step.description}
									</p>
								</div>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

// Vision Section (replacing testimonials with honest vision)
function VisionSection() {
	return (
		<section id="vision" className="py-24 bg-white">
			<div className="max-w-5xl mx-auto px-6">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-100px" }}
					variants={staggerContainer}
					className="max-w-3xl mx-auto text-center"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block text-sm font-medium text-teal-600 mb-4"
					>
						Our Vision
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-3xl sm:text-4xl font-bold text-stone-900 mb-6 leading-tight"
					>
						Your product should build itself
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-stone-500 leading-relaxed mb-12"
					>
						We believe the future of building software is autonomous agents that
						truly understand your product. Not assistants that need constant
						prompting—but teammates that can ship real work while you focus on
						the important decisions.
					</motion.p>
				</motion.div>
			</div>
		</section>
	);
}

// CTA Section
function CTA() {
	return (
		<section className="py-24 bg-stone-900">
			<div className="max-w-3xl mx-auto px-6 text-center">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
				>
					<motion.h2
						variants={fadeInUp}
						className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight"
					>
						Wake up to a better product.
					</motion.h2>
					<motion.p variants={fadeInUp} className="text-lg text-stone-400 mb-8">
						Join the waitlist. Turn your downtime into your most productive
						hours.
					</motion.p>
					<motion.div variants={fadeInUp}>
						<Link
							href="/waitlist"
							className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-all duration-200"
						>
							Request Early Access
							<ArrowRight className="w-4 h-4" />
						</Link>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// Footer
function Footer() {
	return (
		<footer className="py-12 bg-stone-50 border-t border-stone-200">
			<div className="max-w-5xl mx-auto px-6">
				<div className="flex flex-col sm:flex-row items-center justify-between gap-6">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center">
							<Tornado className="w-4 h-4 text-white" />
						</div>
						<span className="text-lg font-semibold text-stone-900 tracking-tight">
							Whirl
						</span>
					</div>
					<p className="text-sm text-stone-400">
						&copy; {new Date().getFullYear()} Whirl. Building the future of
						product development.
					</p>
				</div>
			</div>
		</footer>
	);
}

// Main Page Component
export default function LandingPage() {
	return (
		<div className="min-h-screen bg-[#FAFAF8] text-stone-900">
			<Navigation />
			<Hero />
			<ProblemSection />
			<SolutionSection />
			<VisionSection />
			<CTA />
			<Footer />
		</div>
	);
}
