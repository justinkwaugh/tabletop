import { svelte } from '@sveltejs/vite-plugin-svelte'
import { configDefaults, defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig, projectRoot } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        root: projectRoot(import.meta.url),
        plugins: [svelte({ hot: false })],
        test: { exclude: [...configDefaults.exclude, '**/*.svelte.spec.ts'] }
    })
)
