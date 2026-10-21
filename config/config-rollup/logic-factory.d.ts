import type { Plugin } from 'rollup'

export function collectibleChunkProblem(chunk: {
    imports: readonly string[]
    dynamicImports: readonly string[]
}): string | undefined
export function collectibleLogic(): Plugin
export function buildLogicFactorySource(esmFilename: string): Promise<string>
