import { defineProject } from 'vitest/config'

export const VitestConfig = defineProject({
    // Vite 8 resolves an SSR-externalized CSS @import as a relative file (vitejs/vite#23096).
    ssr: { noExternal: ['tailwindcss'] },
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: [
            '**/node_modules/**',
            '**/esm/**',
            '**/dist/**',
            '**/build/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/{karma,rollup,rolldown,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
        ]
    }
})
