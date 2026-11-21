import { defineProject } from 'vitest/config'

// Runs only the harness scenario builder: SCENARIOS=all pnpm exec vitest run --config scripts/scenarios.config.ts
export default defineProject({ test: { include: ['scripts/scenarios.build.spec.ts'] } })
