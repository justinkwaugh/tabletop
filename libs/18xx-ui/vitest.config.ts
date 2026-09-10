import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(mergeConfig(VitestConfig, { plugins: [svelte({ hot: false })] }))
