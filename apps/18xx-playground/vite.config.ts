import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

// Vite caches imports that fail while svelte-package rewrites a workspace dist folder, so restart after a rebuild settles.
const restartOnWorkspaceDistRebuild: Plugin = {
    name: 'restart-on-workspace-dist-rebuild',
    configureServer(server) {
        const roots = ['libs', 'games'].map((group) => fileURLToPath(new URL(`../../${group}/`, import.meta.url)))
        for (const root of roots) server.watcher.add(`${root}*/dist/**`)
        let timer: ReturnType<typeof setTimeout> | undefined
        const onChange = (file: string) => {
            if (!roots.some((root) => file.startsWith(root) && file.slice(root.length).split('/')[1] === 'dist')) return
            clearTimeout(timer)
            timer = setTimeout(() => {
                server.config.logger.info('workspace dist rebuilt, restarting dev server', { timestamp: true })
                server.restart()
            }, 1500)
        }
        for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, onChange)
    }
}

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), restartOnWorkspaceDistRebuild],
        server: { host: '0.0.0.0', port: 4188, fs: { allow: ['../..'] } }
    })
)
