import path from 'node:path'
import { compile, compileModule, preprocess } from 'svelte/compiler'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const SVELTE_MODULE = /\.svelte(\.[^./\\]+)*\.(js|ts)$/
const SVELTE_COMPONENT = /\.svelte$/

// A component's map names it relative to the working directory (Svelte) and to its own directory
// (vitePreprocess), but Rolldown resolves both against the module, so it gets its full path.
const sourcedFrom = (map, id) => ({ ...map, sources: map.sources.map(() => id) })

// The host page loads only the artifact's JavaScript, so components inject their own styles.
export const svelteComponents = ({ cssHash }) => {
    const preprocessors = vitePreprocess({ script: true })

    return {
        name: 'svelte',
        transform: {
            filter: { id: [SVELTE_MODULE, SVELTE_COMPONENT] },
            async handler(code, id) {
                if (SVELTE_MODULE.test(id)) {
                    const compiled = compileModule(code, { filename: id, generate: 'client' })
                    for (const warning of compiled.warnings) this.warn(warning)
                    return { code: compiled.js.code, map: compiled.js.map, moduleType: 'js' }
                }

                // A relative filename keeps the ids Svelte hashes from it the same in every checkout.
                const filename = path.relative(process.cwd(), id)
                const processed = await preprocess(code, preprocessors, { filename })
                for (const dependency of processed.dependencies ?? []) this.addWatchFile(dependency)
                const compiled = compile(processed.code, {
                    filename,
                    generate: 'client',
                    css: 'injected',
                    cssHash,
                    sourcemap: processed.map
                })
                for (const warning of compiled.warnings) {
                    if (warning.code !== 'css_unused_selector') this.warn(warning)
                }
                return {
                    code: compiled.js.code,
                    map: sourcedFrom(compiled.js.map, id),
                    moduleType: 'js'
                }
            }
        }
    }
}
