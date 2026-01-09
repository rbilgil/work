"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import {
	ArrowRight,
	Bot,
	CheckCircle2,
	Clock,
	GitBranch,
	Layers,
	MessageSquare,
	Moon,
	Play,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

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
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-500 flex items-center justify-center">
						<Sparkles className="w-5 h-5 text-white" />
					</div>
					<span className="text-xl font-bold text-white">Whirl</span>
				</Link>
				<div className="hidden md:flex items-center gap-8">
					<a
						href="#features"
						className="text-sm text-white/70 hover:text-white transition-colors"
					>
						Features
					</a>
					<a
						href="#how-it-works"
						className="text-sm text-white/70 hover:text-white transition-colors"
					>
						How It Works
					</a>
					<a
						href="#demo"
						className="text-sm text-white/70 hover:text-white transition-colors"
					>
						Demo
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
						href="/sign-in"
						className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block"
					>
						Sign In
					</Link>
					<Link
						href="/sign-up"
						className="px-4 py-2 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-colors"
					>
						Get Started
					</Link>
				</div>
			</div>
		</motion.nav>
	);
}

// Hero Section
function Hero() {
	return (
		<section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
			{/* Background gradient orbs */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-500/30 rounded-full blur-[120px] animate-pulse-glow" />
				<div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: "-2s" }} />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "-4s" }} />
			</div>

			{/* Grid pattern overlay */}
			<div className="absolute inset-0 grid-pattern opacity-50" />

			{/* Floating elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<motion.div
					className="absolute top-1/4 left-[15%] w-16 h-16 rounded-2xl glass flex items-center justify-center"
					animate={{ y: [0, -20, 0] }}
					transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
				>
					<Bot className="w-8 h-8 text-purple-400" />
				</motion.div>
				<motion.div
					className="absolute top-1/3 right-[20%] w-14 h-14 rounded-xl glass flex items-center justify-center"
					animate={{ y: [0, -15, 0] }}
					transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
				>
					<GitBranch className="w-6 h-6 text-cyan-400" />
				</motion.div>
				<motion.div
					className="absolute bottom-1/3 left-[20%] w-12 h-12 rounded-lg glass flex items-center justify-center"
					animate={{ y: [0, -18, 0] }}
					transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
				>
					<Zap className="w-5 h-5 text-yellow-400" />
				</motion.div>
				<motion.div
					className="absolute bottom-1/4 right-[15%] w-14 h-14 rounded-xl glass flex items-center justify-center"
					animate={{ y: [0, -12, 0] }}
					transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
				>
					<Moon className="w-6 h-6 text-indigo-400" />
				</motion.div>
			</div>

			<div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
				<motion.div
					initial="hidden"
					animate="visible"
					variants={staggerContainer}
				>
					{/* Badge */}
					<motion.div
						variants={fadeInUp}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
					>
						<span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
						<span className="text-sm text-white/80">
							Now in Early Access
						</span>
					</motion.div>

					{/* Headline */}
					<motion.h1
						variants={fadeInUp}
						className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
					>
						<span className="text-white">Your product</span>
						<br />
						<span className="gradient-text text-shadow-glow">
							builds itself
						</span>
					</motion.h1>

					{/* Subheadline */}
					<motion.p
						variants={fadeInUp}
						className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
					>
						Whirl is where AI agents and humans collaborate seamlessly.
						Your product gets built, iterated, and shipped—even while you sleep.
					</motion.p>

					{/* CTA Buttons */}
					<motion.div
						variants={fadeInUp}
						className="flex flex-col sm:flex-row items-center justify-center gap-4"
					>
						<Link
							href="/sign-up"
							className="group px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white font-medium text-lg flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105"
						>
							Start Building Free
							<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
						</Link>
						<a
							href="#demo"
							className="px-8 py-4 rounded-full glass text-white font-medium text-lg flex items-center gap-2 hover:bg-white/10 transition-all"
						>
							<Play className="w-5 h-5" />
							Watch Demo
						</a>
					</motion.div>

					{/* Stats */}
					<motion.div
						variants={fadeInUp}
						className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
					>
						{[
							{ value: "10x", label: "Faster Iterations" },
							{ value: "24/7", label: "Agent Availability" },
							{ value: "∞", label: "Possibilities" },
						].map((stat) => (
							<div key={stat.label} className="text-center">
								<div className="text-3xl font-bold gradient-text">
									{stat.value}
								</div>
								<div className="text-sm text-white/50 mt-1">{stat.label}</div>
							</div>
						))}
					</motion.div>
				</motion.div>
			</div>

			{/* Scroll indicator */}
			<motion.div
				className="absolute bottom-8 left-1/2 -translate-x-1/2"
				animate={{ y: [0, 10, 0] }}
				transition={{ duration: 2, repeat: Infinity }}
			>
				<div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
					<div className="w-1.5 h-3 rounded-full bg-white/40" />
				</div>
			</motion.div>
		</section>
	);
}

// Logos/Trust Section
function TrustSection() {
	const companies = [
		"Vercel",
		"Stripe",
		"Linear",
		"Notion",
		"Figma",
		"Supabase",
	];

	return (
		<section className="py-20 border-y border-white/5">
			<div className="max-w-7xl mx-auto px-6">
				<motion.p
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					className="text-center text-sm text-white/40 mb-8"
				>
					Trusted by engineers at
				</motion.p>
				<motion.div
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ delay: 0.2 }}
					className="flex flex-wrap items-center justify-center gap-12"
				>
					{companies.map((company) => (
						<span
							key={company}
							className="text-xl font-semibold text-white/20 hover:text-white/40 transition-colors"
						>
							{company}
						</span>
					))}
				</motion.div>
			</div>
		</section>
	);
}

// Features Section
function Features() {
	const features = [
		{
			icon: Bot,
			title: "Autonomous Agents",
			description:
				"AI agents that understand context, break down tasks, and execute autonomously with human-in-the-loop oversight.",
			gradient: "from-purple-500 to-indigo-500",
		},
		{
			icon: MessageSquare,
			title: "Natural Collaboration",
			description:
				"Chat-based interface where you discuss, plan, and iterate. Your conversations become actionable tasks.",
			gradient: "from-indigo-500 to-cyan-500",
		},
		{
			icon: Layers,
			title: "Context-Aware",
			description:
				"Agents learn from your docs, code, and conversations. They understand your product deeply.",
			gradient: "from-cyan-500 to-teal-500",
		},
		{
			icon: Clock,
			title: "24/7 Productivity",
			description:
				"Queue work before you sleep. Wake up to PRs, designs, and solutions ready for review.",
			gradient: "from-teal-500 to-green-500",
		},
		{
			icon: GitBranch,
			title: "Version Everything",
			description:
				"Every agent action is tracked, reversible, and reviewable. Full transparency into what changed.",
			gradient: "from-green-500 to-emerald-500",
		},
		{
			icon: Users,
			title: "Team Multiplier",
			description:
				"Scale your team's output without scaling headcount. Each engineer becomes a team lead.",
			gradient: "from-emerald-500 to-cyan-500",
		},
	];

	return (
		<section id="features" className="py-32 relative">
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-500/10 rounded-full blur-[150px]" />
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
						Features
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white mb-4"
					>
						The future of product development
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						Everything you need to build products faster with AI-powered
						automation and seamless human oversight.
					</motion.p>
				</motion.div>

				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, margin: "-50px" }}
					variants={staggerContainer}
					className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
				>
					{features.map((feature) => (
						<motion.div
							key={feature.title}
							variants={fadeInUp}
							className="group relative p-8 rounded-2xl glass hover:bg-white/[0.08] transition-all duration-300"
						>
							<div
								className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
							>
								<feature.icon className="w-6 h-6 text-white" />
							</div>
							<h3 className="text-xl font-semibold text-white mb-3">
								{feature.title}
							</h3>
							<p className="text-white/50 leading-relaxed">
								{feature.description}
							</p>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}

// How It Works
function HowItWorks() {
	const steps = [
		{
			number: "01",
			title: "Describe Your Vision",
			description:
				"Start a workspace and describe what you want to build. Share docs, links, and context.",
		},
		{
			number: "02",
			title: "Break Down Tasks",
			description:
				"AI helps decompose your vision into actionable tasks with clear acceptance criteria.",
		},
		{
			number: "03",
			title: "Assign to Agents",
			description:
				"Queue tasks for AI agents. They work autonomously, asking for input when needed.",
		},
		{
			number: "04",
			title: "Review & Ship",
			description:
				"Review agent work, provide feedback, and ship with confidence. Iterate rapidly.",
		},
	];

	return (
		<section id="how-it-works" className="py-32 relative">
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
						How It Works
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white mb-4"
					>
						Simple yet powerful
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						From idea to production in four steps. Let AI handle the heavy
						lifting while you focus on what matters.
					</motion.p>
				</motion.div>

				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
					{steps.map((step, index) => (
						<motion.div
							key={step.number}
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: index * 0.15 }}
							className="relative"
						>
							{/* Connector line */}
							{index < steps.length - 1 && (
								<div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-white/20 to-transparent z-0" />
							)}
							<div className="relative z-10">
								<span className="text-6xl font-bold gradient-text opacity-50">
									{step.number}
								</span>
								<h3 className="text-xl font-semibold text-white mt-4 mb-2">
									{step.title}
								</h3>
								<p className="text-white/50">{step.description}</p>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

// Video Demo Section
function VideoDemo() {
	const containerRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start end", "end start"],
	});
	const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
	const scale = useTransform(scrollYProgress, [0, 0.5], [0.9, 1]);

	return (
		<section id="demo" className="py-32 relative" ref={containerRef}>
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 rounded-full blur-[180px]" />
			</div>

			<div className="max-w-6xl mx-auto px-6 relative z-10">
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="text-center mb-12"
				>
					<motion.span
						variants={fadeInUp}
						className="inline-block px-4 py-1.5 rounded-full glass text-sm text-white/60 mb-4"
					>
						See It In Action
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white mb-4"
					>
						Watch the magic happen
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						See how teams are shipping 10x faster with Whirl&apos;s AI-powered
						workflow.
					</motion.p>
				</motion.div>

				<motion.div style={{ y, scale }} className="relative">
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.8 }}
						className="relative aspect-video rounded-2xl overflow-hidden glass glow-purple"
					>
						{/* Video placeholder */}
						<div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-indigo-900/50 to-cyan-900/50 flex items-center justify-center">
							<div className="text-center">
								<button
									type="button"
									className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 group"
								>
									<Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
								</button>
								<p className="text-white/60 mt-4">Product demo coming soon</p>
							</div>
						</div>

						{/* Fake video UI overlay for visual interest */}
						<div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
						<div className="absolute bottom-4 left-4 right-4 flex items-center gap-4">
							<div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
								<div className="w-1/3 h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full" />
							</div>
							<span className="text-sm text-white/60 font-mono">3:42</span>
						</div>
					</motion.div>

					{/* Floating UI elements around video */}
					<motion.div
						className="absolute -top-6 -right-6 p-4 rounded-xl glass hidden lg:block"
						animate={{ y: [0, -10, 0] }}
						transition={{ duration: 4, repeat: Infinity }}
					>
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
								<CheckCircle2 className="w-4 h-4 text-green-400" />
							</div>
							<div>
								<p className="text-sm text-white font-medium">PR Merged</p>
								<p className="text-xs text-white/50">By Agent-Alpha</p>
							</div>
						</div>
					</motion.div>

					<motion.div
						className="absolute -bottom-6 -left-6 p-4 rounded-xl glass hidden lg:block"
						animate={{ y: [0, 10, 0] }}
						transition={{ duration: 5, repeat: Infinity, delay: 1 }}
					>
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
								<Bot className="w-4 h-4 text-purple-400" />
							</div>
							<div>
								<p className="text-sm text-white font-medium">3 tasks queued</p>
								<p className="text-xs text-white/50">Processing overnight</p>
							</div>
						</div>
					</motion.div>
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
				"Whirl has completely transformed how our team ships features. We went from 2-week sprints to shipping daily.",
			author: "Sarah Chen",
			role: "VP Engineering",
			company: "TechFlow",
			avatar: "SC",
		},
		{
			quote:
				"The AI agents feel like having senior engineers on call 24/7. They understand context and deliver quality work.",
			author: "Marcus Johnson",
			role: "Founder",
			company: "Rapidify",
			avatar: "MJ",
		},
		{
			quote:
				"Finally, a tool that doesn't just automate—it thinks. Our small team now competes with companies 10x our size.",
			author: "Elena Rodriguez",
			role: "CTO",
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
						Testimonials
					</motion.span>
					<motion.h2
						variants={fadeInUp}
						className="text-4xl sm:text-5xl font-bold text-white"
					>
						Loved by builders
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
			description: "For individuals and small projects",
			features: [
				"1 workspace",
				"100 agent tasks/month",
				"Basic integrations",
				"Community support",
			],
			cta: "Get Started",
			highlighted: false,
		},
		{
			name: "Pro",
			price: "$49",
			period: "/month",
			description: "For teams shipping fast",
			features: [
				"Unlimited workspaces",
				"Unlimited agent tasks",
				"Priority processing",
				"Advanced integrations",
				"Email support",
				"Custom prompts",
			],
			cta: "Start Free Trial",
			highlighted: true,
		},
		{
			name: "Enterprise",
			price: "Custom",
			description: "For organizations at scale",
			features: [
				"Everything in Pro",
				"SSO & SAML",
				"Dedicated agents",
				"SLA guarantee",
				"Custom training",
				"Dedicated support",
			],
			cta: "Contact Sales",
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
						Simple, transparent pricing
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-white/50 max-w-2xl mx-auto"
					>
						Start free, scale as you grow. No hidden fees, no surprises.
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
								href="/sign-up"
								className={`block w-full py-3 rounded-full text-center font-medium transition-all ${
									plan.highlighted
										? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
										: "glass text-white hover:bg-white/10"
								}`}
							>
								{plan.cta}
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
						className="text-xl text-white/50 mb-10 max-w-2xl mx-auto"
					>
						Join thousands of teams who are building the future with AI-powered
						product development.
					</motion.p>
					<motion.div variants={fadeInUp}>
						<Link
							href="/sign-up"
							className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white font-medium text-lg hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105"
						>
							Get Started Free
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
							<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-500 flex items-center justify-center">
								<Sparkles className="w-5 h-5 text-white" />
							</div>
							<span className="text-xl font-bold text-white">Whirl</span>
						</Link>
						<p className="text-white/50 mb-4 max-w-sm">
							The AI-powered platform for product teams who want to build
							faster, ship more, and sleep better.
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
									href="#features"
									className="text-white/50 hover:text-white transition-colors"
								>
									Features
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
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Roadmap
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
									Careers
								</a>
							</li>
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Contact
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
							<li>
								<a
									href="#"
									className="text-white/50 hover:text-white transition-colors"
								>
									Security
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
			<TrustSection />
			<Features />
			<HowItWorks />
			<VideoDemo />
			<Testimonials />
			<Pricing />
			<CTA />
			<Footer />
		</div>
	);
}
