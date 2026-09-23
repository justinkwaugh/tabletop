import { createHash } from 'node:crypto'
import { PlayerStatus, type GameDefinition } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { startFromPublicSeed } from '@tabletop/18xx/scenarios'

function sortedKeys(_key: string, value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(
        Object.entries(value).sort(([first], [second]) => first.localeCompare(second))
    )
}

export function openingPositionDigest(
    definition: GameDefinition<EighteenXXState, HydratedEighteenXXState>,
    playerCount: number,
    seed: number
): string {
    const runtime = definition.runtime
    const game = runtime.initializer.initializeGame(
        {
            id: 'opening-position',
            typeId: definition.info.id,
            ownerId: 'p1',
            seed,
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index + 1}`,
                name: `p${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    const { id, protectedPrng, masterSeed, ...position } = startFromPublicSeed(runtime, game)
    return createHash('sha256')
        .update(JSON.stringify(position, sortedKeys))
        .digest('hex')
        .slice(0, 16)
}
