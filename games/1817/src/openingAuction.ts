import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from './state.js'
import { EighteenSeventeenGameConfig } from './definition/gameConfig.js'
import { assert, assertExists, shuffle, type Prng } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    closePrivate,
    type InitialPosition,
    type LotTiers,
    type Opening,
    type OpeningSetup,
    startingCashByPlayerCount,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import {
    BasePrivateIds,
    CityTilePrivates,
    EighteenSeventeenPrivateCatalog,
    VolatilityPrivateIds
} from './privates.js'
import { eighteenSeventeenOptions, pyramidOf, seedMoneyLeft, type Pyramid } from './state.js'
import { createEighteenSeventeenPosition } from './position.js'

type OpeningState = SelectionAuctionState &
    Pick<EighteenSeventeenState, 'seedMoney' | 'pyramid' | 'volatility'>

export const EighteenSeventeenStartingCash: Readonly<Record<number, number>> = {
    3: 420,
    4: 315,
    5: 252,
    6: 210,
    7: 180,
    8: 158,
    9: 140,
    10: 126,
    11: 115,
    12: 105
}
export const eighteenSeventeenStartingCash = startingCashByPlayerCount(
    EighteenSeventeenStartingCash
)
export const EighteenSeventeenSeedMoney = 200

// The bank subsidises privates sold below face value from its seed money; once that is spent,
// bidding opens at face value. Under Volatility the subsidy has no limit.
function seedMoney(state: OpeningState): number {
    const amount = seedMoneyLeft(state)
    assertExists(amount, 'The opening auction has seed money')
    return amount
}

function requirePyramid(state: OpeningState): Pyramid {
    const pyramid = pyramidOf(state)
    assertExists(pyramid, 'The Volatility auction has its pyramid')
    return pyramid
}

function remainingLotFilter(state: OpeningState) {
    assertExists(state.selectionAuction, 'The pyramid belongs to the selection auction')
    const remaining = state.selectionAuction.remainingLotIds
    return (lotId: string | null | undefined): lotId is string =>
        !!lotId && remaining.includes(lotId)
}

/** A sale removes a neighbour in its row that is left without a live neighbour of its own. */
function isolatedNeighbours(state: OpeningState, soldLotId: string): string[] {
    const row = requirePyramid(state).find((tier) => tier.includes(soldLotId))
    assertExists(row, 'A sold lot is in the pyramid')
    const remaining = remainingLotFilter(state)
    const sold = row.indexOf(soldLotId)
    const unsold = (index: number) => index !== sold && remaining(row[index])
    return [-1, 1].flatMap((step) => {
        const lotId = row[sold + step]
        return lotId && unsold(sold + step) && !unsold(sold + 2 * step) ? [lotId] : []
    })
}

/** Sold and removed lots keep their slots; only the lowest tier with lots left is open. */
function pyramidTiers(state: OpeningState, pyramid: Pyramid): LotTiers {
    const remaining = remainingLotFilter(state)
    return {
        slots: pyramid,
        openTier(goneLotIds) {
            const tier = pyramid.findLastIndex((row) =>
                row.some((lotId) => remaining(lotId) && !goneLotIds.includes(lotId))
            )
            return tier < 0 ? undefined : tier
        }
    }
}

export const EighteenSeventeenAuctionRules: SelectionAuctionRules = {
    lots: (state: OpeningState) => EighteenSeventeenPrivateCatalog.lots(state),
    nominationLotIds(state: OpeningState) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        const pyramid = pyramidOf(state)
        if (!pyramid) return state.selectionAuction.remainingLotIds
        const tier = pyramidTiers(state, pyramid).openTier([])
        return tier === undefined ? [] : pyramid[tier].filter(remainingLotFilter(state))
    },
    tiers(state: OpeningState) {
        const pyramid = pyramidOf(state)
        return pyramid && pyramidTiers(state, pyramid)
    },
    passingWhileNominating: (state: OpeningState) => !eighteenSeventeenOptions(state).volatility,
    openingBid: (state: OpeningState, lotId) =>
        eighteenSeventeenOptions(state).volatility
            ? 0
            : Math.max(0, EighteenSeventeenPrivateCatalog.faceValue(lotId) - seedMoney(state)),
    increment: 5,
    award(state: OpeningState, award) {
        awardPrivate(state, award)
        if (eighteenSeventeenOptions(state).volatility) return
        const subsidy = Math.max(
            0,
            EighteenSeventeenPrivateCatalog.faceValue(award.lotId) - award.price
        )
        state.seedMoney = seedMoney(state) - subsidy
    },
    lotsRemovedBy: (state: OpeningState, award) =>
        pyramidOf(state) ? isolatedNeighbours(state, award.lotId) : [],
    nominationFollowsWinner: (state: OpeningState) => eighteenSeventeenOptions(state).volatility,
    closeUnsold(state: OpeningState, lotIds) {
        for (const id of lotIds) closePrivate(state, id)
    }
}

/**
 * Volatility keeps one city-tile private, drawn at random, and deals the 21 privates into tiers
 * of one to six, the city-tile private alone at the top.
 */
function volatilityOpening(prng: Prng): { privateIds: string[]; pyramid: Pyramid } {
    const cityTileIds = Object.keys(CityTilePrivates)
    const keptId = cityTileIds[prng.randInt(cityTileIds.length)]
    const others = [...BasePrivateIds, ...VolatilityPrivateIds].filter(
        (id) => !cityTileIds.includes(id)
    )
    shuffle(others, prng.random)
    const pyramid: Pyramid = [[keptId]]
    for (let start = 0, size = 2; start < others.length; start += size, size++)
        pyramid.push(others.slice(start, start + size))
    return { privateIds: [keptId, ...others], pyramid }
}

export function createEighteenSeventeenOpening({
    players,
    prng,
    startingPositions,
    config
}: OpeningSetup): Opening<typeof EighteenSeventeenState, HydratedEighteenSeventeenState> {
    const options = EighteenSeventeenGameConfig.options(config)
    assert(
        players.length >= 3 && players.length <= 12,
        '1817 supports three through twelve players'
    )
    const capital = eighteenSeventeenStartingCash({ playerCount: players.length, config })
    const volatility = options.volatility ? volatilityOpening(prng) : undefined
    const position: InitialPosition = {
        ...createEighteenSeventeenPosition(
            players.map((player) => ({ playerId: player.playerId, amount: capital })),
            volatility?.privateIds ?? BasePrivateIds
        ),
        stockMarket: { stacks: [] }
    }
    return {
        position,
        titleState: {
            ...(volatility
                ? { volatility: true, pyramid: volatility.pyramid }
                : { seedMoney: EighteenSeventeenSeedMoney }),
            ...(options.shortSqueeze ? { shortSqueeze: true } : {}),
            ...(options.fiveShorts ? { fiveShorts: true } : {}),
            ...(options.modernTrains ? { modernTrains: true } : {})
        },
        begin: beginSelectionAuction(EighteenSeventeenAuctionRules, startingPositions)
    }
}
