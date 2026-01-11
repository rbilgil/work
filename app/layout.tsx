import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ConvexClientProvider } from "./ConvexClientProvider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Whirl - Your product builds itself",
	description:
		"Whirl is where AI agents and humans collaborate seamlessly. Your product gets built, iterated, and shipped—even while you sleep.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ClerkProvider
					signInUrl="/sign-in"
					signUpUrl="/sign-up"
					afterSignInUrl="/app"
					afterSignUpUrl="/app/onboarding"
					afterSignOutUrl="/"
				>
					<ConvexClientProvider>
						{children}
						<Toaster />
					</ConvexClientProvider>
				</ClerkProvider>
			</body>
		</html>
	);
}
