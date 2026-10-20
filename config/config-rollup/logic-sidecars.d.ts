import type { GameDefinition } from '@tabletop/common'

export function collectibleChunkProblem(chunk: {
    imports: readonly string[]
    dynamicImports: readonly string[]
}): string | undefined
export function buildLogicFactorySource(esmFilename: string): Promise<string>
export function buildValidatorsSource(
    definition: GameDefinition,
    outputDir: string
): Promise<string>
