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
	Sparkles,
	Tornado,
	Zap,
} from "lucide-react";
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
						Build your product
						<br />
						<span className="text-teal-700">while you sleep</span>
					</motion.h1>

					{/* Subheadline */}
					<motion.p
						variants={fadeInUp}
						className="text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed"
					>
						Product development stops the moment we leave our desks. Whirl
						brings discussions, decisions, and context into one place and
						automatically feeds them to an AI agent.
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

						{/* Content preview */}
						<div className="aspect-[16/9] bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-8">
							<div className="text-center">
								<div className="w-16 h-16 rounded-2xl bg-teal-700 flex items-center justify-center mx-auto mb-4">
									<Tornado className="w-8 h-8 text-white" />
								</div>
								<p className="text-stone-400 text-lg font-medium">
									Product preview coming soon
								</p>
								<p className="text-stone-300 text-sm mt-1">
									We&apos;re building something special
								</p>
							</div>
						</div>
					</div>

					{/* Floating elements */}
					<motion.div
						className="absolute -top-4 -right-4 md:top-8 md:-right-8 p-3 rounded-lg bg-white border border-stone-200 shadow-lg hidden sm:block"
						animate={{ y: [0, -8, 0] }}
						transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
					>
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
								<CheckCircle2 className="w-4 h-4 text-green-600" />
							</div>
							<div>
								<p className="text-sm font-medium text-stone-700">
									Feature shipped
								</p>
								<p className="text-xs text-stone-400">while you were asleep</p>
							</div>
						</div>
					</motion.div>

					<motion.div
						className="absolute -bottom-4 -left-4 md:bottom-8 md:-left-8 p-3 rounded-lg bg-white border border-stone-200 shadow-lg hidden sm:block"
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
									Agent working
								</p>
								<p className="text-xs text-stone-400">3 tasks in progress</p>
							</div>
						</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// Problem Section
function ProblemSection() {
	const scatteredTools = [
		{ name: "Slack threads", icon: MessageSquare },
		{ name: "Notion docs", icon: FileText },
		{ name: "Jira tickets", icon: FileText },
		{ name: "Google Docs", icon: FileText },
		{ name: "Email chains", icon: MessageSquare },
	];

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
						When you stop working,
						<br />
						everything stops.
					</motion.h2>
					<motion.p
						variants={fadeInUp}
						className="text-lg text-stone-500 mb-12 leading-relaxed"
					>
						Every night, every weekend, every lunch break—your product sits
						idle. AI tools exist, but they need constant input. Context is
						scattered. You&apos;re the bottleneck, and when you step away,
						progress stops completely.
					</motion.p>
				</motion.div>

				{/* Scattered tools visualization */}
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-16"
				>
					{scatteredTools.map((tool) => (
						<motion.div
							key={tool.name}
							variants={fadeInUp}
							className="p-4 rounded-lg border border-stone-200 bg-stone-50/50 text-center"
						>
							<tool.icon className="w-5 h-5 text-stone-400 mx-auto mb-2" />
							<span className="text-sm text-stone-500">{tool.name}</span>
						</motion.div>
					))}
				</motion.div>

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
							The Babysitting Problem
						</h3>
						<p className="text-stone-500 leading-relaxed">
							You can&apos;t step away. Every AI task turns into a
							back-and-forth. &ldquo;What&apos;s the API format?&rdquo;
							&ldquo;Where&apos;s that config file?&rdquo; &ldquo;What did the
							team decide about auth?&rdquo; You&apos;re always in the loop.
						</p>
					</motion.div>
					<motion.div
						variants={fadeInUp}
						className="p-6 rounded-xl border border-stone-200 bg-white"
					>
						<h3 className="text-lg font-semibold text-stone-900 mb-3">
							Context Isn&apos;t Structured
						</h3>
						<p className="text-stone-500 leading-relaxed">
							AI is incredible at navigating codebases. But your product
							context? It&apos;s scattered across tools in formats AI can&apos;t
							easily traverse. That&apos;s the missing piece.
						</p>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// Insight Section
function InsightSection() {
	return (
		<section className="py-16 bg-teal-700">
			<div className="max-w-4xl mx-auto px-6">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="text-center"
				>
					<p className="text-teal-200 text-sm font-medium mb-3">The Insight</p>
					<h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
						AI agents are great at navigating codebases.
						<br />
						What if your product context worked the same way?
					</h2>
					<p className="text-teal-100 text-lg max-w-2xl mx-auto">
						Whirl structures your specs, decisions, and docs like a
						filesystem—so agents like Claude can read your product context as
						effectively as they read code.
					</p>
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
			title: "Context as a Filesystem",
			description:
				"Your specs, Slack decisions, and docs become a structured workspace—like a codebase for your product. Agents read context as fluently as they read code.",
			icon: Layers,
		},
		{
			number: "02",
			title: "Queue Up Work",
			description:
				"Break down what you want built into tasks. Add context, specs, constraints. Then hand it off—agents take it from here.",
			icon: MessageSquare,
		},
		{
			number: "03",
			title: "Agents Work While You Don't",
			description:
				"Close your laptop. Agents keep shipping through the night, the weekend, your vacation. No babysitting required.",
			icon: Bot,
		},
		{
			number: "04",
			title: "Wake Up to Progress",
			description:
				"Morning coffee hits different when there's completed work waiting for review. Your downtime became productive time.",
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
						what matters.
					</motion.p>
				</motion.div>

				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					variants={staggerContainer}
					className="grid md:grid-cols-3 gap-6"
				>
					<motion.div
						variants={fadeInUp}
						className="p-6 rounded-xl border border-stone-200 bg-stone-50/50"
					>
						<div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center mb-4">
							<GitBranch className="w-5 h-5 text-teal-600" />
						</div>
						<h3 className="text-lg font-semibold text-stone-900 mb-2">
							Early Stage
						</h3>
						<p className="text-sm text-stone-500 leading-relaxed">
							We&apos;re in active development. Joining the waitlist means
							you&apos;ll get early access and help shape what we build.
						</p>
					</motion.div>

					<motion.div
						variants={fadeInUp}
						className="p-6 rounded-xl border border-stone-200 bg-stone-50/50"
					>
						<div className="w-10 h-10 rounded-lg bg-terracotta/10 flex items-center justify-center mb-4">
							<MessageSquare className="w-5 h-5 text-terracotta" />
						</div>
						<h3 className="text-lg font-semibold text-stone-900 mb-2">
							Built With You
						</h3>
						<p className="text-sm text-stone-500 leading-relaxed">
							We&apos;re talking to early users every week. Your feedback
							directly influences our roadmap and priorities.
						</p>
					</motion.div>

					<motion.div
						variants={fadeInUp}
						className="p-6 rounded-xl border border-stone-200 bg-stone-50/50"
					>
						<div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
							<Sparkles className="w-5 h-5 text-amber-600" />
						</div>
						<h3 className="text-lg font-semibold text-stone-900 mb-2">
							Free for Early Users
						</h3>
						<p className="text-sm text-stone-500 leading-relaxed">
							Early access users will get extended free access as a thank you
							for helping us build something great.
						</p>
					</motion.div>
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
			<InsightSection />
			<SolutionSection />
			<VisionSection />
			<CTA />
			<Footer />
		</div>
	);
}
