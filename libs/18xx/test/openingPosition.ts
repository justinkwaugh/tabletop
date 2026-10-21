import { createHash } from 'node:crypto'
import { PlayerStatus, type GameDefinition } from '@tabletop/common'
import {
    currentPrivateRevenue,
    type CompanyCharters,
    type EighteenXXState,
    type HydratedEighteenXXState,
    type TileSet
} from '@tabletop/18xx'
import { startFromPublicSeed } from '@tabletop/18xx/scenarios'

function sortedKeys(_key: string, value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(
        Object.entries(value).sort(([first], [second]) => first.localeCompare(second))
    )
}

/** The title's definitions that the shape digests were first recorded in carried in State. */
export type RecordedDefinitions = { charters: CompanyCharters; tileSet: TileSet }

export function openingPositionDigest(
    definition: GameDefinition<EighteenXXState, HydratedEighteenXXState>,
    recorded: RecordedDefinitions,
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
    return createHash('sha256')
        .update(
            JSON.stringify(
                seededPosition(startFromPublicSeed(runtime, game), recorded),
                sortedKeys
            )
        )
        .digest('hex')
        .slice(0, 16)
}

// The shape digests were first recorded in, so setup randomness stays comparable.
function seededPosition(
    {
        id,
        protectedPrng,
        masterSeed,
        stockMarket,
        certificates,
        trainInventory,
        ...position
    }: EighteenXXState,
    { charters, tileSet }: RecordedDefinitions
) {
    const limitedBank = position.cash.some(
        (cash) => cash.owner.kind === 'bank' && cash.amount !== 'unlimited'
    )
    return {
        ...position,
        bank: limitedBank ? { ...position.bank, unlimitedAfterExhaustion: true } : position.bank,
        companies: position.companies.map((company) => {
            const shareCount = company.shareCount ?? charters.shareCount(company.id)
            return {
                ...company,
                ...(shareCount ? { shareCount } : {}),
                ...(company.kind === 'private'
                    ? { privateRevenue: currentPrivateRevenue(position, charters, company.id) }
                    : {})
            }
        }),
        tileInventory: { tileSetId: tileSet.manifest.id, ...position.tileInventory },
        stockMarketStacks: stockMarket.stacks,
        example: 'finances',
        certificates: certificates.map(({ id, owner, poolId }) => ({
            id,
            retired: false,
            owner,
            poolId
        }))
    }
}
