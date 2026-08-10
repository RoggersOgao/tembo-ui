// Core exports — framework-agnostic, safe for browser or server
export * from './core';

// Client exports — browser-only, no Node dependencies
export * from './client';

// NOTE: React exports and server exports are intentionally NOT re-exported here.
// Import them from their dedicated subpaths instead:
//   import { AnalyticsProvider } from '@repo/analytics/react';
//   import { createAnalyticsRouter } from '@repo/analytics/server';
// This keeps bullmq/ioredis/Express out of any bundle that imports the base package.