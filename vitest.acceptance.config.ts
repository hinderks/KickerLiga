// Acceptance tests for the specs in specs/, run against the demo database.
// The environment comes only from .env.demo (scripts/demo-db.ts). envDir
// points to a folder without .env files, so .env.local with the course
// database is never loaded here.

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { loadDemoEnv } from './scripts/demo-db.ts'

const root = fileURLToPath(new URL('.', import.meta.url))
const demo = loadDemoEnv(root)

export default defineConfig({
  envDir: 'tests/acceptance',
  test: {
    include: ['tests/acceptance/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: demo.apiUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: demo.publishableKey,
      KL_DEMO_PROJECT_REF: demo.projectRef,
    },
    fileParallelism: false,
    chaiConfig: { truncateThreshold: 0 },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
