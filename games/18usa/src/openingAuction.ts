import { assert } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    closePrivate,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from '@tabletop/18xx'
import { EighteenUSAGameConfig } from './definition/gameConfig.js'
import { EighteenUSAState, type HydratedEighteenUSAState } from './state.js'
import {
    EighteenUSAPrivateCatalog,
    SubsidyPrivateIds,
    isSubsidyPrivate,
    selectPrivates
} from './privates.js'
import { PyramidSchemeId, CarnegieSteelId } from './privateHolders.js'
import { createEighteenUSAPosition } from './position.js'
import { MaximumPlayers, MinimumPlayers, startingCash } from './setup.js'
import { selectMetropolises } from './metropolis.js'
import { assignSubsidies, noSubsidyCityIds } from './subsidies.js'
import { assignRedAreaTokens } from './redAreas.js'
import { dealtRedAreaRevenues } from './map.js'
import { EighteenUSATileSet } from './tiles.js'
import { MetropolisCandidates } from './metropolis.js'
import { trainSupplyVariant } from './trains.js'

const StartingCash = Object.fromEntries(
    Array.from({ length: MaximumPlayers - MinimumPlayers + 1 }, (_, index) => [
        MinimumPlayers + index,
        startingCash(MinimumPlayers + index)
    ])
)
export const eighteenUSAStartingCash = startingCashByPlayerCount(StartingCash)

// The Pyramid Scheme may be bid for from $5 (P14).
const PyramidSchemeOpeningBid = 5

/**
 * Players nominate privates in turn and bid from half their face value, in $5 steps; there is
 * no seed money, so each winner pays the whole bid (§10).
 */
export const EighteenUSAAuctionRules: SelectionAuctionRules = {
    lots: (state: SelectionAuctionState) =>
        EighteenUSAPrivateCatalog.lots(state).filter((lot) => !isSubsidyPrivate(lot.id)),
    nominationLotIds(state) {
        const auction = state.selectionAuction
        return auction ? auction.remainingLotIds : []
    },
    passingWhileNominating: () => true,
    openingBid: (_state, lotId) =>
        lotId === PyramidSchemeId
            ? PyramidSchemeOpeningBid
            : Math.floor(EighteenUSAPrivateCatalog.faceValue(lotId) / 2),
    increment: 5,
    award: (state, award) => awardPrivate(state, award),
    closeUnsold(state, lotIds) {
        for (const id of lotIds) closePrivate(state, id)
    }
}

export function createEighteenUSAOpening({
    players,
    prng,
    startingPositions,
    config
}: OpeningSetup): Opening<typeof EighteenUSAState, HydratedEighteenUSAState> {
    const options = EighteenUSAGameConfig.options(config)
    assert(
        players.length >= MinimumPlayers && players.length <= MaximumPlayers,
        '18USA supports two through seven players'
    )
    const capital = startingCash(players.length)
    const privateIds = selectPrivates(players.length, prng)
    const metropolises = selectMetropolises(prng)
    const citySubsidies = assignSubsidies(prng)
    const redAreaTokens = assignRedAreaTokens(prng)
    const tileInventory = {
        ...EighteenUSATileSet.createInventory(
            metropolises.metropolisIds.map((locationId) => {
                const candidate = MetropolisCandidates.find(
                    (entry) => entry.locationId === locationId
                )
                assert(!!candidate, 'A chosen metropolis is a candidate')
                return {
                    locationId,
                    definitionId: candidate.yellowTileId,
                    rotation: candidate.rotation
                }
            })
        ),
        dealtRevenues: dealtRedAreaRevenues(redAreaTokens)
    }
    const position: InitialPosition = {
        ...createEighteenUSAPosition(
            players.map((player) => ({ playerId: player.playerId, amount: capital })),
            [...privateIds, ...Object.values(SubsidyPrivateIds)],
            tileInventory,
            trainSupplyVariant(players.length, options.seventeenTrains ? '1817' : 'standard')
        ),
        stockMarket: { stacks: [] }
    }
    const titleState = {
        redAreaTokens,
        metropolisIds: [...metropolises.metropolisIds],
        carnegieIds: privateIds.includes(CarnegieSteelId) ? [...metropolises.remainingIds] : [],
        citySubsidies,
        noSubsidyCityIds: noSubsidyCityIds(citySubsidies, privateIds),
        ...(options.seventeenTrains ? { seventeenTrains: true as const } : {}),
        ...(options.highStartPrices ? { highStartPrices: true as const } : {}),
        ...(options.noPresidentLimit ? { noPresidentLimit: true as const } : {})
    }
    return {
        position,
        titleState,
        begin: beginSelectionAuction(EighteenUSAAuctionRules, startingPositions)
    }
}
