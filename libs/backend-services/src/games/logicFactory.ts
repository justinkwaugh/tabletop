import { pathToFileURL } from 'node:url'
import type { GameDefinition } from '@tabletop/common'
import { evaluateLogicFactory } from '@tabletop/common/node/collectible-factory'

function hasDefinition(value: unknown): value is { Definition: GameDefinition } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'Definition' in value &&
        typeof value.Definition === 'object' &&
        value.Definition !== null &&
        'info' in value.Definition &&
        'runtime' in value.Definition
    )
}

// Evaluates a logic artifact's CommonJS factory outside Node's module cache, so the Definition
// it returns can be collected once nothing refers to it.
export function evaluateLogicDefinition(source: string, filename: string): GameDefinition {
    const loaded = evaluateLogicFactory(source, filename)
    if (!hasDefinition(loaded)) throw new Error(`Logic artifact ${filename} has no Definition`)
    return loaded.Definition
}

// Imports an ESM logic bundle. Node never releases an imported module, so a title loaded this way
// stays resident until the process ends; `tabletop-deploy migrate-logic-artifacts` adds the
// factory to artifacts published before it existed.
export async function importLogicModule(
    filename: string,
    packageId: string
): Promise<GameDefinition> {
    console.warn(
        `Logic artifact for ${packageId} has no collectible factory; importing ${filename} for the life of the process`
    )
    const loaded: unknown = await import(pathToFileURL(filename).href)
    if (!hasDefinition(loaded)) throw new Error(`Logic module ${filename} has no Definition`)
    return loaded.Definition
}
