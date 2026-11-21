import { defineProject } from 'vitest/config'

// Runs only the harness scenario builder: SCENARIOS=all pnpm exec vitest run --config test/scenarios.config.ts
export default defineProject({ test: { include: ['test/scenarios.build.spec.ts'] } })
