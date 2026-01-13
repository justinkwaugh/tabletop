// rollup.config.js
import path from 'node:path'
import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import url from '@rollup/plugin-url'

const libAlias = {
    name: 'lib-alias',
    resolveId(source: string) {
        if (source === '$lib') {
            return path.resolve('src/lib')
        }

        if (source.startsWith('$lib/')) {
            return path.resolve('src/lib', source.slice('$lib/'.length))
        }

        return null
    }
}

export default {
    input: 'src/lib/index.ts',
    output: {
        dir: 'public',
        format: 'es'
    },
    plugins: [
        libAlias,
        typescript({ tsconfig: './tsconfig.rollup.json' }),
        commonjs(),
        svelte({
            // By default, all ".svelte" files are compiled
            extensions: ['.svelte.ts', '.svelte'],

            // Emit CSS as "files" for other plugins to process. default is true
            emitCss: false,

            // Warnings are normally passed straight to Rollup. You can
            // optionally handle them here, for example to squelch
            // warnings with a particular code
            onwarn: (warning, handler) => {
                // e.g. don't warn on <marquee> elements, cos they're cool
                if (warning.code === 'a11y-distracting-elements') return

                // let Rollup handle all other warnings normally
                handler(warning)
            },

            // You can pass any of the Svelte compiler options
            compilerOptions: {
                generate: 'client'
            }
        }),
        // see NOTICE below
        resolve({
            browser: true,
            exportConditions: ['svelte'],
            extensions: ['.svelte', '.ts', '.js', '.mjs']
        }),
        url({
            // Files to process (include all common image formats)
            include: ['**/*.svg', '**/*.png', '**/*.gif', '**/*.jpg', '**/*.jpeg', '**/*.webp'],
            // Where to copy files (relative to the main output.dir)
            destDir: 'public/assets',
            // Public path in the bundled code (relative to your website's root)
            publicPath: '/assets/',
            // File name format once copied
            fileName: '[name]-[hash][extname]',
            // Set limit to 0 or a very small number to ensure files are always copied, not inlined as base64
            limit: 0
        })
    ]
}
