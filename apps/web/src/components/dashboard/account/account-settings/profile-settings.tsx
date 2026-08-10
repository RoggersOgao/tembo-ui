// app/(dashboard)/settings/page.tsx
"use client";

import { motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";
import { CgProfile } from "react-icons/cg";
import { GoTrash } from "react-icons/go";
import { IoMdNotificationsOutline } from "react-icons/io";
import { MdOutlineSecurity, MdOutlineSocialDistance } from "react-icons/md";
import { cn } from "@workspace/ui/lib/utils";
import ProfileForm from "./profile-form";
import ProfileNotifications from "./notifications";
import ProfileSocial from "./profile-social";
import ProfileSecurity from "./profile-security";
import DeleteAccount from "./delete-profile";

import { Button } from "@workspace/ui/components/button";
import { TopNav } from "./profile-top-nav";



const sections = [
    {
        id: "profile",
        label: "Profile",
        icon: <CgProfile className="w-5 h-5" />,
        component: <ProfileForm />,
        description: "Manage your personal information and profile photo",
    },
    {
        id: "notifications",
        label: "Notifications",
        icon: <IoMdNotificationsOutline className="w-5 h-5" />,
        component: <ProfileNotifications />,
        description: "Configure your email notification preferences",
    },
    {
        id: "accounts",
        label: "Social Accounts",
        icon: <MdOutlineSocialDistance className="w-5 h-5" />,
        component: <ProfileSocial />,
        description: "Connect your social media accounts",
    },
    {
        id: "security",
        label: "Security",
        icon: <MdOutlineSecurity className="w-5 h-5" />,
        component: <ProfileSecurity />,
        description: "Update your password and security settings",
    },
    {
        id: "delete",
        label: "Delete Account",
        icon: <GoTrash className="w-5 h-5" />,
        component: <DeleteAccount />,
        description: "Permanently delete your account and all associated data",
    },
];

const pageVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
        },
    },
    exit: {
        opacity: 0,
        y: 20,
        transition: { duration: 0.3 },
    },
};

export default function AccountSettingsPage() {
    const [activeSection, setActiveSection] = useState<string>("profile");

    // Persist active section in localStorage
    useEffect(() => {
        const savedSection = localStorage.getItem("activeSettingsSection");
        if (savedSection && sections.some((s) => s.id === savedSection)) {
            setActiveSection(savedSection);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("activeSettingsSection", activeSection);
    }, [activeSection]);

    const currentSection = sections.find((s) => s.id === activeSection);
    const ComponentToRender = currentSection?.component;

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
            {/* Hero Header */}
            <div className="relative overflow-hidden border-b border-border/40 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
                <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center md:text-left"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Account Settings
                        </h1>
                        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto md:mx-0">
                            Manage your account preferences, security, and connected services
                        </p>
                    </motion.div>
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                    {/* Sidebar Navigation */}
                    <motion.aside
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="lg:w-80 shrink-0"
                    >
                        <div className="sticky top-24 space-y-6">
                            {/* Mobile Dropdown */}
                            <div className="lg:hidden">
                                <TopNav
                                    sections={sections}
                                    activeSection={activeSection}
                                    onSectionChange={setActiveSection}
                                />
                            </div>

                            {/* Desktop Navigation */}
                            <div className="hidden lg:block">
                                <div className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm">
                                    <div className="p-4 border-b">
                                        <h2 className="font-semibold text-lg">Settings</h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Manage your account preferences
                                        </p>
                                    </div>
                                    <nav className="p-2">
                                        {sections.map((section, idx) => (
                                            <motion.button
                                                key={section.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                onClick={() => setActiveSection(section.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                                    activeSection === section.id
                                                        ? "bg-primary text-primary-foreground shadow-md scale-[1.02]"
                                                        : "text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-0.5"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "transition-colors",
                                                        activeSection === section.id
                                                            ? "text-primary-foreground"
                                                            : "text-muted-foreground group-hover:text-foreground"
                                                    )}
                                                >
                                                    {section.icon}
                                                </span>
                                                <span className="flex-1 text-left">{section.label}</span>
                                                {activeSection === section.id && (
                                                    <motion.div
                                                        layoutId="activeIndicator"
                                                        className="w-1.5 h-1.5 rounded-full bg-primary-foreground"
                                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                    />
                                                )}
                                            </motion.button>
                                        ))}
                                    </nav>
                                </div>

                                {/* Help Card */}
                                <div className="mt-6 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                                    <h3 className="font-semibold text-sm">Need help?</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Our support team is here to assist you with any questions.
                                    </p>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="mt-3 p-0 h-auto text-xs font-medium"
                                        asChild
                                    >
                                        <a href="/support">Contact Support →</a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.aside>

                    {/* Main Content */}
                    <motion.main
                        key={activeSection}
                        variants={pageVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="flex-1 min-w-0"
                    >
                        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                            {/* Section Header */}
                            <div className="px-6 py-5 border-b bg-gradient-to-r from-background to-background/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        {currentSection?.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold tracking-tight">
                                            {currentSection?.label}
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            {currentSection?.description}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Component */}
                            <div className="p-6 md:p-8">{ComponentToRender}</div>
                        </div>
                    </motion.main>
                </div>
            </div>
        </div>
    );
}