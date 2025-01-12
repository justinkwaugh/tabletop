/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
    test: {
        exclude: [
            '**/node_modules/**',
            '**/esm/**',
            '**/dist/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
        ]
    }
})
