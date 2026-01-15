"use client";

import { motion } from "framer-motion";
import {
	ArrowRight,
	Bot,
	CheckCircle2,
	Clock,
	FileText,
	GitBranch,
	Layers,
	MessageSquare,
	Play,
	Tornado,
	Table,
	Ticket,
	Users,
	Zap,
	X,
	Check,
} from "lucide-react";
import Link from "next/link";

// Animation variants
const fadeInUp = {
	hidden: { opacity: 0, y: 30 },
	visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1 },
	},
};

const scaleIn = {
	hidden: { opacity: 0, scale: 0.9 },
	visible: { opacity: 1, scale: 1 },
};

// Navigation
function Navigation() {
	return (
		<motion.nav
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6 }}
			className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
		>
			<div className="max-w-7xl mx-auto flex items-center justify-between">
				<Link href="/" className="flex items-center gap-2">
					<div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
						<Tornado className="w-5 h-5 text-white" />
					</div>
					<span className="text-xl font-bold text-white">Whirl</span>
				</Link>
				<div className="hidden md:flex items-center gap-8">
					<a
						href="#problem"
						className="text-sm text-white/70 hover:text-white transition-colors"
					>
						The Problem
					</a>
					<a
						href="#solution"
						className="text-sm text-white/70 hover:text-white transition-colors"
					>
						How It Works
					</a>
					<a
						href="#pricing"
						className="text-sm text-white/70 hover:text-white transition-colors"
					>
						Pricing
					</a>
				</div>
				<div className="flex items-center gap-4">
					<Link
						href="/waitlist"
						className="px-4 py-2 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-colors"
					>
						Join Waitlist
					</Link>
				</div>
			</div>
		</motion.nav>
	);
}

// Hero Section with Demo at top
function Hero() {
	return (
		<section className="relative min-h-screen flex flex-col overflow-hidden pt-24 pb-8">
			{/* Background gradient orbs */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-500/30 rounded-full blur-[120px] animate-pulse-glow" />
				<div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: "-2s" }} />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "-4s" }} />
			</div>

			{/* Grid pattern overlay */}
			<div className="absolute inset-0 grid-pattern opacity-50" />

			<div className="relative z-10 max-w-7xl mx-auto px-6 flex-1 flex flex-col">
				<motion.div
					initial="hidden"
					animate="visible"
					variants={staggerContainer}
					className="text-center pt-8 mb-8"
				>
					{/* Badge */}
					<motion.div
						variants={fadeInUp}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
					>
						<span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
						<span className="text-sm text-white/80">
							Join the Waitlist
						</span>
					</motion.div>

					{/* Big Headline */}
					<motion.h1
						variants={fadeInUp}
						className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
					>
						<span className="gradient-text text-shadow-glow">
							Ship as fast as you
						</span>
						<br />
						<span className="gradient-text text-shadow-glow">
							make decisions
						</span>
					</motion.h1>

					{/* Subheadline */}
					<motion.p
						variants={fadeInUp}
						className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-6 leading-relaxed"
					>
						Stop scattering context across Slack, Notion, and tickets.
						Whirl brings everything together so AI agents can ship while you sleep.
					</motion.p>

					{/* CTA Buttons */}
					<motion.div
						variants={fadeInUp}
						className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
					>
						<Link
							href="/waitlist"
							className="group px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white font-medium text-lg flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105"
						>
							Join the Waitlist
							<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
						</Link>
					</motion.div>
				</motion.div>

				{/* Product Demo - Hero Position */}
				<motion.div
					initial={{ opacity: 0, y: 40 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.4 }}
					className="relative flex-1 min-h-0"
				>
					<div className="relative h-full max-w-5xl mx-auto rounded-2xl overflow-hidden glass glow-purple" style={{ minHeight: "320px" }}>
						{/* Video placeholder */}
						<div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-indigo-900/50 to-cyan-900/50 flex items-center justify-center">
							<div className="text-center">
								<button
									type="button"
									className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 group mb-3"
								>
									<Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
								</button>
								<p className="text-white font-medium">Product Demo</p>
								<p className="text-white/50 text-sm mt-1">Coming soon</p>
							</div>
						</div>

						{/* Fake video UI overlay */}
						<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
						<div className="absolute bottom-3 left-4 right-4 flex items-center gap-4">
							<div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
								<div className="w-0 h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full" />
							</div>
							<span className="text-sm text-white/60 font-mono">0:00</span>
						</div>
					</div>

					{/* Floating UI elements around video */}
					<motion.div
						className="absolute top-4 -right-2 p-3 rounded-xl glass hidden lg:block"
						animate={{ y: [0, -10, 0] }}
						transition={{ duration: 4, repeat: Infinity }}
					>
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
								<CheckCircle2 className="w-4 h-4 text-green-400" />
							</div>
							<div>
								<p className="text-sm text-white font-medium">Feature shipped</p>
								<p className="text-xs text-white/50">While you were asleep</p>
							</div>
						</div>
					</motion.div>

					<motion.div
						className="absolute bottom-4 -left-2 p-3 rounded-xl glass hidden lg:block"
						animate={{ y: [0, 10, 0] }}
						transition={{ duration: 5, repeat: Infinity, delay: 1 }}
					>
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
								<Bot className="w-4 h-4 text-purple-400" />
							</div>
							<div>
								<p className="text-sm text-white font-medium">Agent working</p>
								<p className="text-xs text-white/50">3 tasks in progress</p>
							</div>
						</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// The Problem Section
function ProblemSection() {
	const scatteredTools = [
		{ name: "Slack", icon: MessageSquare, color: "text-purple-400" },
		{ name: "Notion", icon: FileText, color: "text-orange-400" },
		{ name: "Jira", icon: Ticket, color: "text-blue-400" },
		{ name: "Docs", icon: FileText, color: "text-cyan-400" },
		{ name: "Sheets", icon: Table, color: "text-green-400" },
		{ name: "Email", icon: MessageSquare, color: "text-red-400" },
	];

	return (
		<section id="problem" className="py-32 relative">
			<div className="max-w-7xl mx-auto px-6">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-100px" }}
					variants={staggerContainer}
					className="text-center mb-16"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block px-4 py-1.5 rounded-full glass text-sm text-white/60 mb-4"
					>
						The Problem
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white mb-6"
					>
						Your context is everywhere.
						<br />
						<span className="text-white/40">Your agents can&apos;t find it.</span>
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						Product decisions live in Slack. Specs in Notion. Tasks in Jira.
						Data in spreadsheets. No human can keep up—and neither can AI.
					</motion.p>
				</motion.div>

				{/* Scattered tools visualization */}
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="relative max-w-4xl mx-auto mb-20"
				>
					<div className="aspect-[2/1] relative">
						{/* Chaotic scattered tools */}
						{scatteredTools.map((tool, i) => {
							const positions = [
								{ left: "10%", top: "15%", rotate: -5 },
								{ left: "45%", top: "5%", rotate: 3 },
								{ left: "75%", top: "20%", rotate: -3 },
								{ left: "15%", top: "60%", rotate: 4 },
								{ left: "50%", top: "65%", rotate: -6 },
								{ left: "80%", top: "55%", rotate: 2 },
							];
							const pos = positions[i];
							return (
								<motion.div
									key={tool.name}
									variants={fadeInUp}
									className="absolute glass p-4 rounded-xl"
									style={{
										left: pos.left,
										top: pos.top,
										transform: `rotate(${pos.rotate}deg)`,
									}}
								>
									<div className="flex items-center gap-3">
										<tool.icon className={`w-5 h-5 ${tool.color}`} />
										<span className="text-white/70 text-sm">{tool.name}</span>
									</div>
								</motion.div>
							);
						})}

						{/* Confused lines connecting them */}
						<svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.15 }}>
							<line x1="20%" y1="25%" x2="50%" y2="15%" stroke="white" strokeWidth="1" strokeDasharray="4" />
							<line x1="55%" y1="15%" x2="80%" y2="30%" stroke="white" strokeWidth="1" strokeDasharray="4" />
							<line x1="25%" y1="70%" x2="55%" y2="75%" stroke="white" strokeWidth="1" strokeDasharray="4" />
							<line x1="60%" y1="75%" x2="85%" y2="65%" stroke="white" strokeWidth="1" strokeDasharray="4" />
							<line x1="80%" y1="35%" x2="20%" y2="65%" stroke="white" strokeWidth="1" strokeDasharray="4" />
							<line x1="50%" y1="20%" x2="55%" y2="70%" stroke="white" strokeWidth="1" strokeDasharray="4" />
						</svg>
					</div>
				</motion.div>

				{/* Comparison */}
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto"
				>
					{/* Traditional Way */}
					<motion.div
						variants={scaleIn}
						className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20"
					>
						<div className="flex items-center gap-3 mb-6">
							<div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
								<X className="w-5 h-5 text-red-400" />
							</div>
							<h3 className="text-xl font-semibold text-white">Traditional Way</h3>
						</div>
						<ul className="space-y-4">
							{[
								"Context scattered across 6+ tools",
								"Hours spent searching for decisions",
								"AI can't access your full context",
								"Agents hallucinate without information",
								"You're the bottleneck for everything",
							].map((item) => (
								<li key={item} className="flex items-start gap-3 text-white/60">
									<X className="w-5 h-5 text-red-400/60 flex-shrink-0 mt-0.5" />
									{item}
								</li>
							))}
						</ul>
					</motion.div>

					{/* The Whirl Way */}
					<motion.div
						variants={scaleIn}
						className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20"
					>
						<div className="flex items-center gap-3 mb-6">
							<div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
								<Tornado className="w-5 h-5 text-white" />
							</div>
							<h3 className="text-xl font-semibold text-white">The Whirl Way</h3>
						</div>
						<ul className="space-y-4">
							{[
								"All context in one workspace",
								"Decisions captured in conversations",
								"Agents see everything they need",
								"Work continues while you sleep",
								"You focus only on decisions",
							].map((item) => (
								<li key={item} className="flex items-start gap-3 text-white/80">
									<Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
									{item}
								</li>
							))}
						</ul>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// How It Works / Solution Section
function SolutionSection() {
	const steps = [
		{
			number: "01",
			title: "Bring in the context",
			description:
				"Create a workspace. Drop in links, docs, and context. Chat about what you're building. Everything stays together.",
			icon: Layers,
		},
		{
			number: "02",
			title: "Break down the work",
			description:
				"Define tasks from your conversations. AI helps decompose them with the full context of your discussions.",
			icon: GitBranch,
		},
		{
			number: "03",
			title: "Agents take over",
			description:
				"Queue tasks for AI agents. They work autonomously with full context, asking you only when decisions are needed.",
			icon: Bot,
		},
		{
			number: "04",
			title: "Review and ship",
			description:
				"Wake up to completed work. Review, provide feedback, ship. Iterate at the speed of your decisions.",
			icon: Zap,
		},
	];

	return (
		<section id="solution" className="py-32 relative">
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[180px]" />
			</div>

			<div className="max-w-7xl mx-auto px-6 relative z-10">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-100px" }}
					variants={staggerContainer}
					className="text-center mb-16"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block px-4 py-1.5 rounded-full glass text-sm text-white/60 mb-4"
					>
						How It Works
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white mb-6"
					>
						One place for context.
						<br />
						<span className="gradient-text">Unlimited output.</span>
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						Whirl is the workspace where your thinking happens—and where agents
						turn that thinking into shipped product.
					</motion.p>
				</motion.div>

				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
					{steps.map((step, index) => (
						<motion.div
							key={step.number}
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: index * 0.1 }}
							className="relative p-6 rounded-2xl glass group hover:bg-white/[0.08] transition-all"
						>
							<div className="flex items-center gap-3 mb-4">
								<span className="text-3xl font-bold gradient-text opacity-60">
									{step.number}
								</span>
								<div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
									<step.icon className="w-5 h-5 text-white/60" />
								</div>
							</div>
							<h3 className="text-lg font-semibold text-white mb-2">
								{step.title}
							</h3>
							<p className="text-sm text-white/50 leading-relaxed">
								{step.description}
							</p>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

// Value Props Section
function ValueProps() {
	const props = [
		{
			icon: Clock,
			title: "24/7 Productivity",
			description:
				"Agents work while you're in meetings, eating dinner, or sleeping. Your product evolves around the clock.",
			stat: "24/7",
			statLabel: "Continuous progress",
		},
		{
			icon: MessageSquare,
			title: "Decisions, Not Tasks",
			description:
				"Stop doing the work. Start making the calls. Agents handle execution—you handle direction.",
			stat: "10x",
			statLabel: "More leverage",
		},
		{
			icon: Users,
			title: "Team of One, Output of Ten",
			description:
				"A solo founder with Whirl ships like a funded startup. A small team competes with enterprises.",
			stat: "∞",
			statLabel: "Scale potential",
		},
	];

	return (
		<section className="py-32 relative">
			<div className="max-w-7xl mx-auto px-6">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid md:grid-cols-3 gap-8"
				>
					{props.map((prop) => (
						<motion.div
							key={prop.title}
							variants={fadeInUp}
							className="text-center p-8"
						>
							<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
								<prop.icon className="w-8 h-8 text-white/80" />
							</div>
							<div className="text-4xl font-bold gradient-text mb-1">
								{prop.stat}
							</div>
							<div className="text-sm text-white/40 mb-4">{prop.statLabel}</div>
							<h3 className="text-xl font-semibold text-white mb-3">
								{prop.title}
							</h3>
							<p className="text-white/50">{prop.description}</p>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}

// Testimonials
function Testimonials() {
	const testimonials = [
		{
			quote:
				"I used to spend half my day context-switching between tools. Now I dump everything into Whirl and let agents figure it out.",
			author: "Sarah Chen",
			role: "Solo Founder",
			company: "Stealth Startup",
			avatar: "SC",
		},
		{
			quote:
				"We shipped our entire v2 while I was on vacation. Reviewed PRs from the beach. This is how software should be built.",
			author: "Marcus Johnson",
			role: "CTO",
			company: "Rapidify",
			avatar: "MJ",
		},
		{
			quote:
				"The insight isn't the AI—it's having all your context in one place. That's what makes agents actually useful.",
			author: "Elena Rodriguez",
			role: "VP Engineering",
			company: "ScaleUp",
			avatar: "ER",
		},
	];

	return (
		<section className="py-32 relative">
			<div className="max-w-7xl mx-auto px-6">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="text-center mb-16"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block px-4 py-1.5 rounded-full glass text-sm text-white/60 mb-4"
					>
						Early Users
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white"
					>
						Built by builders, for builders
					</motion.h2>
				</motion.div>

				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid md:grid-cols-3 gap-6"
				>
					{testimonials.map((testimonial) => (
						<motion.div
							key={testimonial.author}
							variants={fadeInUp}
							className="p-8 rounded-2xl glass"
						>
							<p className="text-white/80 leading-relaxed mb-6">
								&ldquo;{testimonial.quote}&rdquo;
							</p>
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-medium">
									{testimonial.avatar}
								</div>
								<div>
									<p className="text-white font-medium">{testimonial.author}</p>
									<p className="text-sm text-white/50">
										{testimonial.role}, {testimonial.company}
									</p>
								</div>
							</div>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}

// Pricing Section
function Pricing() {
	const plans = [
		{
			name: "Starter",
			price: "Free",
			description: "For individuals exploring a new way to work",
			features: [
				"1 workspace",
				"100 agent tasks/month",
				"Unlimited context",
				"Community support",
			],
			cta: "Get Started",
			highlighted: false,
		},
		{
			name: "Pro",
			price: "$49",
			period: "/month",
			description: "For builders shipping fast",
			features: [
				"Unlimited workspaces",
				"Unlimited agent tasks",
				"Priority processing",
				"Advanced integrations",
				"Email support",
			],
			cta: "Start Free Trial",
			highlighted: true,
		},
		{
			name: "Team",
			price: "$149",
			period: "/month",
			description: "For teams that ship together",
			features: [
				"Everything in Pro",
				"5 team members",
				"Shared workspaces",
				"Team analytics",
				"Priority support",
			],
			cta: "Start Free Trial",
			highlighted: false,
		},
	];

	return (
		<section id="pricing" className="py-32 relative">
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[180px]" />
				<div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[180px]" />
			</div>

			<div className="max-w-7xl mx-auto px-6 relative z-10">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="text-center mb-16"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block px-4 py-1.5 rounded-full glass text-sm text-white/60 mb-4"
					>
						Pricing
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white mb-4"
					>
						Start free. Scale when ready.
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						No credit card required. No time limit on free tier.
					</motion.p>
				</motion.div>

				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
				>
					{plans.map((plan) => (
						<motion.div
							key={plan.name}
							variants={scaleIn}
							className={`relative p-8 rounded-2xl ${
								plan.highlighted
									? "bg-gradient-to-b from-purple-500/20 to-cyan-500/20 border border-purple-500/30"
									: "glass"
							}`}
						>
							{plan.highlighted && (
								<div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-xs font-medium text-white">
									Most Popular
								</div>
							)}
							<h3 className="text-xl font-semibold text-white mb-2">
								{plan.name}
							</h3>
							<div className="mb-4">
								<span className="text-4xl font-bold text-white">{plan.price}</span>
								{plan.period && (
									<span className="text-white/50">{plan.period}</span>
								)}
							</div>
							<p className="text-white/50 mb-6">{plan.description}</p>
							<ul className="space-y-3 mb-8">
								{plan.features.map((feature) => (
									<li
										key={feature}
										className="flex items-center gap-3 text-white/70"
									>
										<CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
										{feature}
									</li>
								))}
							</ul>
							<Link
								href="/waitlist"
								className={`block w-full py-3 rounded-full text-center font-medium transition-all ${
									plan.highlighted
										? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
										: "glass text-white hover:bg-white/10"
								}`}
							>
								Join Waitlist
							</Link>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}

// CTA Section
function CTA() {
	return (
		<section className="py-32 relative">
			<div className="max-w-4xl mx-auto px-6 text-center">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
				>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6"
					>
						Ready to ship faster?
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-xl text-white/50 mb-4 max-w-2xl mx-auto"
					>
						Stop managing tools. Start making decisions.
					</motion.p>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/30 mb-10"
					>
						Your agents are waiting.
					</motion.p>
					<motion.div variants={fadeInUp}>
						<Link
							href="/waitlist"
							className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white font-medium text-lg hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105"
						>
							Join the Waitlist
							<ArrowRight className="w-5 h-5" />
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
		<footer className="py-16 border-t border-white/5">
			<div className="max-w-7xl mx-auto px-6">
				<div className="grid md:grid-cols-5 gap-12 mb-12">
					<div className="md:col-span-2">
						<Link href="/" className="flex items-center gap-2 mb-4">
							<div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
								<Tornado className="w-5 h-5 text-white" />
							</div>
							<span className="text-xl font-bold text-white">Whirl</span>
						</Link>
						<p className="text-white/50 mb-4 max-w-sm">
							The workspace where context meets execution.
							Ship as fast as you make decisions.
						</p>
						<p className="text-sm text-white/30">
							© 2025 Whirl. All rights reserved.
						</p>
					</div>
					<div>
						<h4 className="text-white font-medium mb-4">Product</h4>
						<ul className="space-y-3">
							<li>
								<a
									href="#solution"
									className="text-white/50 hover:text-white transition-colors"
								>
									How It Works
								</a>
							</li>
							<li>
								<a
									href="#pricing"
									className="text-white/50 hover:text-white transition-colors"
								>
									Pricing
								</a>
							</li>
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Changelog
								</a>
							</li>
						</ul>
					</div>
					<div>
						<h4 className="text-white font-medium mb-4">Company</h4>
						<ul className="space-y-3">
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									About
								</a>
							</li>
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Blog
								</a>
							</li>
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Twitter
								</a>
							</li>
						</ul>
					</div>
					<div>
						<h4 className="text-white font-medium mb-4">Legal</h4>
						<ul className="space-y-3">
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Privacy
								</a>
							</li>
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Terms
								</a>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</footer>
	);
}

// Main Page Component
export default function LandingPage() {
	return (
		<div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
			<Navigation />
			<Hero />
			<ProblemSection />
			<SolutionSection />
			<ValueProps />
			<Testimonials />
			<Pricing />
			<CTA />
			<Footer />
		</div>
	);
}
