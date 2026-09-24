import { assert, assertExists, deepFreeze } from '@tabletop/common'
import { Clone } from 'typebox/value'
import type { TileDefinition } from './tile.js'
import { assertTileTopology } from './validation.js'

export class TileCatalog {
    private readonly definitions = new Map<string, TileDefinition>()

    constructor(definitions: readonly TileDefinition[]) {
        for (const definition of definitions) {
            assert(
                !this.definitions.has(definition.id),
                `Duplicate tile definition ID: ${definition.id}`
            )
            assertTileTopology(definition.face)
            const entry = Clone(definition)
            deepFreeze(entry)
            this.definitions.set(entry.id, entry)
        }
    }

    get(id: string): TileDefinition {
        const definition = this.definitions.get(id)
        assertExists(definition, `Unknown tile definition: ${id}`)
        return definition
    }

    entries(): readonly TileDefinition[] {
        return Array.from(this.definitions.values())
    }

    findByPrintedNumber(number: string): readonly TileDefinition[] {
        return this.entries().filter(
            (definition) =>
                definition.printedNumber === number || definition.aliases.includes(number)
        )
    }
}
