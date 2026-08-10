"use client"
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  const date = new Date().getFullYear();
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gray-50 dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/features" className="hover:text-black dark:hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-black dark:hover:text-white">Pricing</Link></li>
              <li><Link href="/s3-compatibility" className="hover:text-black dark:hover:text-white">S3 Compatibility</Link></li>
              <li><Link href="/security" className="hover:text-black dark:hover:text-white">Security & Encryption</Link></li>
              <li><Link href="/changelog" className="hover:text-black dark:hover:text-white">Changelog</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Developers</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/docs" className="hover:text-black dark:hover:text-white">Documentation</Link></li>
              <li><Link href="/docs/api" className="hover:text-black dark:hover:text-white">API Reference</Link></li>
              <li><Link href="/docs/sdks" className="hover:text-black dark:hover:text-white">SDKs & CLI</Link></li>
              <li><Link href="/status" className="hover:text-black dark:hover:text-white">System Status</Link></li>
              <li><Link href="/community" className="hover:text-black dark:hover:text-white">Community Forum</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Solutions</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/solutions/backup" className="hover:text-black dark:hover:text-white">Backup & Archival</Link></li>
              <li><Link href="/solutions/media" className="hover:text-black dark:hover:text-white">Media Storage</Link></li>
              <li><Link href="/solutions/data-lakes" className="hover:text-black dark:hover:text-white">Data Lakes</Link></li>
              <li><Link href="/solutions/self-hosted" className="hover:text-black dark:hover:text-white">Self-Hosted Deployments</Link></li>
              <li><Link href="/migrate" className="hover:text-black dark:hover:text-white">Migrate from S3</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Tembo</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/about" className="hover:text-black dark:hover:text-white">About</Link></li>
              <li><Link href="/blog" className="hover:text-black dark:hover:text-white">Blog</Link></li>
              <li><Link href="/careers" className="hover:text-black dark:hover:text-white">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-black dark:hover:text-white">Contact</Link></li>
            </ul>
          </div>
        </div>

        <hr className="my-8 border-gray-200 dark:border-neutral-800" />

        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-4 text-sm text-neutral-800 dark:text-gray-400">
            <span>© {date} Tembo</span>
            <Link href="/privacy" className="hover:text-black dark:hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-black dark:hover:text-white">Terms</Link>
            <Link href="/sla" className="hover:text-black dark:hover:text-white">SLA</Link>
          </div>

          <div className="flex space-x-4 mt-4 md:mt-0">
            <a href="https://github.com/tembo" target="_blank" rel="noopener noreferrer"><Github size={20} className="cursor-pointer hover:text-black dark:hover:text-white" /></a>
            <a href="https://twitter.com/tembo" target="_blank" rel="noopener noreferrer"><Twitter size={20} className="cursor-pointer hover:text-black dark:hover:text-white" /></a>
            <a href="https://linkedin.com/company/tembo" target="_blank" rel="noopener noreferrer"><Linkedin size={20} className="cursor-pointer hover:text-black dark:hover:text-white" /></a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;