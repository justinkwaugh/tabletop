import { EighteenSeventeenGameConfig } from './definition/gameConfig.js'
import { assert, assertExists, shuffle, type Prng } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    closePrivate,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import {
    BasePrivateIds,
    CityTilePrivates,
    EighteenSeventeenPrivateCatalog,
    VolatilityPrivateIds
} from './privates.js'
import { eighteenSeventeenOptions, pyramidOf, type Pyramid } from './state.js'
import { createEighteenSeventeenStockMarket } from './stockMarket.js'
import { createEighteenSeventeenPosition } from './position.js'

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
export const EighteenSeventeenSeedMoney = 200

// The bank subsidises privates sold below face value from its seed money; once that is spent,
// bidding opens at face value. Under Volatility the subsidy has no limit.
function seedMoney(state: SelectionAuctionState): number {
    assert(
        'seedMoney' in state && typeof state.seedMoney === 'number',
        'The opening auction has seed money'
    )
    return state.seedMoney
}

function requirePyramid(state: SelectionAuctionState): Pyramid {
    const pyramid = pyramidOf(state)
    assertExists(pyramid, 'The Volatility auction has its pyramid')
    return pyramid
}

const liveLots = (row: readonly (string | null)[]) =>
    row.flatMap((lotId) => (lotId === null ? [] : [lotId]))

function clearSlots(state: SelectionAuctionState, lotIds: readonly string[]): void {
    for (const row of requirePyramid(state))
        row.forEach((lotId, index) => {
            if (lotId !== null && lotIds.includes(lotId)) row[index] = null
        })
}

/** A sale removes a neighbour in its row that is left without a live neighbour of its own. */
function isolatedNeighbours(pyramid: Pyramid, soldLotId: string): string[] {
    const row = pyramid.find((tier) => tier.includes(soldLotId))
    assertExists(row, 'A sold lot is in the pyramid')
    const sold = row.indexOf(soldLotId)
    const live = (index: number) => index !== sold && !!row[index]
    return [-1, 1].flatMap((step) => {
        const lotId = row[sold + step]
        return lotId && live(sold + step) && !live(sold + 2 * step) ? [lotId] : []
    })
}

export const EighteenSeventeenAuctionRules: SelectionAuctionRules = {
    lots: (state) => EighteenSeventeenPrivateCatalog.lots(state),
    nominationLotIds(state) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        const pyramid = pyramidOf(state)
        if (!pyramid) return state.selectionAuction.remainingLotIds
        // Only the lowest tier with lots left is open.
        return pyramid.map(liveLots).findLast((lotIds) => lotIds.length) ?? []
    },
    tiers: (state) => pyramidOf(state)?.map(liveLots),
    passingWhileNominating: (state) => !eighteenSeventeenOptions(state).volatility,
    openingBid: (state, lotId) =>
        eighteenSeventeenOptions(state).volatility
            ? 0
            : Math.max(0, EighteenSeventeenPrivateCatalog.faceValue(lotId) - seedMoney(state)),
    increment: 5,
    award(state, award) {
        awardPrivate(state, award)
        if (eighteenSeventeenOptions(state).volatility) {
            clearSlots(state, [award.lotId])
            return
        }
        const subsidy = Math.max(
            0,
            EighteenSeventeenPrivateCatalog.faceValue(award.lotId) - award.price
        )
        Object.assign(state, { seedMoney: seedMoney(state) - subsidy })
    },
    lotsRemovedBy: (state, award) => {
        const pyramid = pyramidOf(state)
        return pyramid ? isolatedNeighbours(pyramid, award.lotId) : []
    },
    nominationFollowsWinner: (state) => eighteenSeventeenOptions(state).volatility,
    closeUnsold(state, lotIds) {
        for (const id of lotIds) closePrivate(state, id)
        if (pyramidOf(state)) clearSlots(state, lotIds)
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
}: OpeningSetup): Opening {
    const options = EighteenSeventeenGameConfig.options(config)
    assert(
        players.length >= 3 && players.length <= 12,
        '1817 supports three through twelve players'
    )
    const capital = EighteenSeventeenStartingCash[players.length]
    const volatility = options.volatility ? volatilityOpening(prng) : undefined
    const position: InitialPosition = {
        ...createEighteenSeventeenPosition(
            players.map((player) => ({ playerId: player.playerId, amount: capital })),
            volatility?.privateIds ?? BasePrivateIds
        ),
        stockMarket: createEighteenSeventeenStockMarket()
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
