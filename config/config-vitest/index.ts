import { defineProject } from 'vitest/config'

export const VitestConfig = defineProject({
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: [
            '**/node_modules/**',
            '**/esm/**',
            '**/dist/**',
            '**/build/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
        ]
    }
})
