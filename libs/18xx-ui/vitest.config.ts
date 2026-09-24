import { svelte } from '@sveltejs/vite-plugin-svelte'
import { configDefaults, defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [svelte({ hot: false })],
        test: { exclude: [...configDefaults.exclude, '**/*.svelte.spec.ts'] }
    })
)
