import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SiteManifest as PackageManifest } from '@tabletop/games-config'
import svelte from 'rollup-plugin-svelte'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import url from '@rollup/plugin-url'
import terser from '@rollup/plugin-terser'
import brotli from 'rollup-plugin-brotli'
import postcss from 'rollup-plugin-postcss'

const assetExtensions = [
    '**/*.svg',
    '**/*.png',
    '**/*.gif',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.webp',
    '**/*.woff',
    '**/*.woff2',
    '**/*.ttf',
    '**/*.otf',
    '**/*.eot',
    '**/*.gltf',
    '**/*.bin',
    '**/*.glb'
]

const toPath = (value) => (value instanceof URL ? fileURLToPath(value) : value)

const resolveManifestUiVersion = (manifestPath, gameId) => {
    if (manifestPath) {
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Site manifest not found at ${manifestPath}`)
        }
        const raw = fs.readFileSync(manifestPath, 'utf8')
        const manifest = JSON.parse(raw)
        const entry = manifest?.games?.[gameId]
        return entry?.uiVersion ?? null
    }

    const entry = PackageManifest?.games?.[gameId]
    return entry?.uiVersion ?? null
}

const analyzeBundle = (enabled) => ({
    name: 'analyze-bundle',
    generateBundle(
        _options,
        bundle
    ) {
        if (!enabled) return

        const stats = {}

        for (const [fileName, output] of Object.entries(bundle)) {
            if (output.type !== 'chunk' || !output.modules) continue

            const modules = Object.entries(output.modules)
                .map(([id, moduleInfo]) => ({ id, renderedLength: moduleInfo.renderedLength ?? 0 }))
                .sort((a, b) => b.renderedLength - a.renderedLength)

            stats[fileName] = {
                total: modules.reduce((sum, moduleInfo) => sum + moduleInfo.renderedLength, 0),
                topModules: modules.slice(0, 50)
            }
        }

        this.emitFile({
            type: 'asset',
            fileName: 'rollup-stats.json',
            source: JSON.stringify(stats, null, 2)
        })
    }
})

const createResolveJsExtensions = (packageRoot) => ({
    name: 'resolve-js-extensions',
    resolveId(source, importer) {
        if (source.startsWith('\0')) return null

        const normalizedSource = source.split('?')[0]
        const isJs = normalizedSource.endsWith('.js')
        const isSvelte = normalizedSource.endsWith('.svelte')
        const hasExtension = path.extname(normalizedSource) !== ''
        const isExtensionless = !hasExtension
        const isRelativeOrLib =
            normalizedSource.startsWith('$lib/') ||
            normalizedSource === '$lib' ||
            normalizedSource.startsWith('.')

        if (!isRelativeOrLib) return null
        if (!isJs && !isSvelte && !isExtensionless) return null

        const withoutExt = isExtensionless
            ? normalizedSource
            : isJs
              ? normalizedSource.slice(0, -3)
              : normalizedSource.slice(0, -7)
        let basePath = null

        if (normalizedSource === '$lib') {
            basePath = path.join(packageRoot, 'src/lib/index')
        } else if (normalizedSource.startsWith('$lib/')) {
            basePath = path.join(packageRoot, 'src/lib', withoutExt.slice('$lib/'.length))
        } else if (normalizedSource.startsWith('.')) {
            if (!importer) return null
            basePath = path.resolve(path.dirname(importer), withoutExt)
        }

        if (!basePath) return null

        const candidates = isSvelte
            ? [`${basePath}.svelte`, `${basePath}.svelte.ts`]
            : [
                  `${basePath}.ts`,
                  `${basePath}.svelte.ts`,
                  `${basePath}.js`,
                  `${basePath}.svelte`
              ]

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate
            }
        }

        return null
    }
})

const createLibAlias = (packageRoot) => ({
    name: 'lib-alias',
    resolveId(source) {
        const normalizedSource = source.split('?')[0]
        if (normalizedSource === '$lib') {
            return path.join(packageRoot, 'src/lib')
        }

        if (normalizedSource.startsWith('$lib/')) {
            return path.join(packageRoot, 'src/lib', normalizedSource.slice('$lib/'.length))
        }

        return null
    }
})

export const createGameUiRollupConfig = ({ packageRootUrl }) => {
    if (!packageRootUrl) {
        throw new Error('createGameUiRollupConfig requires packageRootUrl')
    }

    const packageRoot = toPath(packageRootUrl)
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    )
    const packageName = packageJson.name ?? ''
    const packageVersion = packageJson.version ?? '0.0.0'
    const gameId = packageName.replace(/^@[^/]+\//, '').replace(/-ui$/, '')
    const manifestPath = process.env.TABLETOP_SITE_MANIFEST_PATH
    const manifestUiVersion = resolveManifestUiVersion(manifestPath, gameId)
    const uiVersion = process.env.ROLLUP_UI_VERSION ?? manifestUiVersion ?? packageVersion
    const publicAssetsPath = `/games/${gameId}/${uiVersion}/assets/`
    const analyze = process.env.ROLLUP_ANALYZE === '1'
    const minify = process.env.ROLLUP_TERSER === '1'

    return {
        input: path.join(packageRoot, 'src/lib/index.ts'),
        output: {
            dir: path.join(packageRoot, 'public'),
            format: 'es'
        },
        plugins: [
            createResolveJsExtensions(packageRoot),
            createLibAlias(packageRoot),
            typescript({ tsconfig: path.join(packageRoot, 'tsconfig.rollup.json') }),
            commonjs(),
            svelte({
                extensions: ['.svelte.ts', '.svelte'],
                emitCss: false,
                preprocess: vitePreprocess({ script: true }),
                onwarn: (warning, handler) => {
                    if (warning.code === 'a11y-distracting-elements') return
                    handler(warning)
                },
                compilerOptions: {
                    generate: 'client'
                }
            }),
            resolve({
                browser: true,
                dedupe: ['svelte'],
                exportConditions: ['svelte'],
                extensions: ['.ts', '.js', '.mjs', '.svelte']
            }),
            postcss({ inject: true }),
            url({
                include: assetExtensions,
                destDir: path.join(packageRoot, 'public/assets'),
                publicPath: publicAssetsPath,
                fileName: '[name]-[hash][extname]',
                limit: 0
            }),
            analyzeBundle(analyze),
            ...(minify ? [terser()] : []),
            brotli()
        ]
    }
}
