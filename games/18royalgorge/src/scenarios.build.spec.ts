import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { startingPositionFile } from '@tabletop/common/testing'
import { TrackConstruction, presidentOf, trainsOwnedBy } from '@tabletop/18xx'
import { autorouter, botMove, Random } from '../test/bot.js'
import { givePrivate, kit, type Table } from '../test/kit.js'
import { bridgeLeaseOwed } from './bridgeLease.js'
import { canPayDebt, treatySigned } from './debt.js'
import { shippableGold } from './gold.js'
import {
    CoalCreekId,
    CoalDepotId,
    DocHollidayId,
    GhostTownId,
    GoldMinerId,
    JewelerId,
    MetalsInvestorId,
    MintWorkerId,
    NuggetId,
    OilFieldsId,
    PrisonId,
    SfId,
    SilverMinesId,
    StCloudId,
    SteelDepotId,
    SulphurSpringsId,
    VgcId
} from './ids.js'
import {
    CoalCreekLocationId,
    GoldMines,
    GorgeTownId,
    MapRoyalGorge,
    SulphurSpringsLocationId
} from './map.js'
import { LastTrainReason } from './operating.js'
import { privatePlayerHolder } from './privateHoldings.js'
import { evaluateMetalPurchase } from './privatePowers.js'
import { RouteRulesRoyalGorge, stCloudLocation } from './routes.js'
import type { StateRoyalGorge } from './state.js'
import { GreenGorgeTileIds, TileSetRoyalGorge, mapStateRoyalGorge } from './tiles.js'
import { TrackRulesRoyalGorge } from './track.js'
import { BrownFivePhaseId, colorPhase } from './trains.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../18royalgorge-ui/src/scenarios/', import.meta.url)

// The first of the seeded games to reach the position within a harness-sized history.
function playUntil(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    limit = 3000,
    seeds = 60
) {
    for (let tried = seed; tried < seed + seeds; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        for (let count = 0; count < limit && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

function save(slug: string, game: Table) {
    mkdirSync(folder, { recursive: true })
    // Each scenario is its own local game.
    const id = `scenario-18royalgorge-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

/** The operating company of a step, whichever step it is in. */
function operating(game: Table): string {
    const state = game.state
    return (
        state.trackStep?.companyId ??
        state.routeStep?.companyId ??
        state.trainPurchaseStep?.companyId ??
        ''
    )
}

type Move = ReturnType<typeof botMove>

/** A move's text field, if it has one. */
function moveField(move: Move, name: string): string {
    const value: unknown = Reflect.get(move.fields, name)
    return typeof value === 'string' ? value : ''
}

/**
 * The position just before the first bot move `wanted` picks out, given the state that move
 * leads to, in the first seeded game to reach one.
 */
function playUntilBefore(
    players: number,
    seed: number,
    wanted: (game: Table, move: Move, after: StateRoyalGorge) => boolean,
    limit = 3000,
    seeds = 60
) {
    for (let tried = seed; tried < seed + seeds; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        for (let count = 0; count < limit; count++) {
            if (game.state.machineState === 'GameOver') break
            const move = botMove(game, random)
            const before = structuredClone(game.state)
            game.act(move.type, move.fields, move.playerId)
            const after = game.state
            game.state = before
            if (wanted(game, move, after)) return game
            game.state = after
        }
    }
    throw new Error('The position never came')
}

/** Saves a position arranged in code, which starts its history afresh. */
function saveArranged(slug: string, game: Table, arrange: (state: StateRoyalGorge) => void) {
    mkdirSync(folder, { recursive: true })
    const state = structuredClone(game.state)
    arrange(state)
    const { fileName, contents } = startingPositionFile({
        slug: `18royalgorge-${slug}`,
        name: slug.replace(/-/g, ' '),
        game: game.game,
        state
    })
    writeFileSync(new URL(fileName.replace(/^18royalgorge-/, ''), folder), contents)
}

/** Whether a check holds once the position is arranged, leaving the table as it was. */
function arrangedHolds(
    game: Table,
    arrange: (state: StateRoyalGorge) => void,
    check: (game: Table) => boolean
): boolean {
    const before = game.state
    const state = structuredClone(before)
    arrange(state)
    game.state = state
    try {
        return check(game)
    } finally {
        game.state = before
    }
}

const railroad = (companyId: string) => ({ kind: 'company' as const, companyId })
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

/** The operating company's best run, as the autorouter finds it. */
function bestRun(game: Table) {
    return autorouter.solve(game.hydrated, RouteRulesRoyalGorge, operating(game), {
        timeLimitMs: 150
    }).result.routes
}
const passes = (routes: ReturnType<typeof bestRun>, locationId: string) =>
    routes.some(
        (route) =>
            route.start.locationId === locationId ||
            route.paths.some((path) => path.locationId === locationId)
    )
const stopsAt = (routes: ReturnType<typeof bestRun>, locationId: string) =>
    routes.some((route) => route.visits.some((visit) => visit.locationId === locationId))

/** A run about to be made, no train yet lengthened, by a company with `trains` trains. */
function runOpen(game: Table, trains = 1): boolean {
    return (
        game.state.machineState === 'RunningTrains' &&
        !game.state.trainExtensions.length &&
        trainsOwnedBy(game.state, railroad(operating(game))).length >= trains
    )
}

/** Before the first 5+, while the brown-row privates are still open. */
const privatesOpen = (state: StateRoyalGorge) =>
    colorPhase(state.phaseId) !== 'Silver' && state.phaseId !== BrownFivePhaseId

/** A gold shipment the operating company may make, none made yet this turn. */
function shipmentOpen(game: Table): boolean {
    return (
        game.state.machineState === 'DistributingEarnings' &&
        !game.state.goldShipment &&
        game.valid().includes('ShipGold')
    )
}

const tileAt = (state: StateRoyalGorge, locationId: string) =>
    mapStateRoyalGorge(state).tile(locationId)

/** The players other than one, in seat order. */
const othersThan = (state: StateRoyalGorge, playerId: string | undefined) =>
    state.players.map((entry) => entry.playerId).filter((id) => id !== playerId)

/** A stock turn whose player may buy CF&I or VGC shares at the Metals Investor's or Mint Worker's discount. */
function metalPurchaseOpen(game: Table): boolean {
    if (game.state.machineState !== 'StockRound') return false
    const state = game.hydrated
    const started = state.companies.filter(
        (company) => company.kind === 'major' && company.started
    ).length
    return (
        started >= 2 &&
        [MetalsInvestorId, MintWorkerId].some(
            (id) => privatePlayerHolder(state, id) === game.player
        ) &&
        game.valid().includes('BuyMetalShares')
    )
}

/** A green-or-later track step after a lay, its yellow column fixed and another colour still open. */
function steelChoiceOpen(game: Table): boolean {
    const state = game.state
    return (
        state.machineState === 'LayingTrack' &&
        colorPhase(state.phaseId) !== 'Yellow' &&
        state.steelTurn?.companyId === operating(game) &&
        Object.keys(state.steelTurn.columns).length > 0 &&
        game.valid().includes('ChooseSteel')
    )
}

/** Earnings after a run past a mine still holding gold. */
function goldShippable(game: Table): boolean {
    return (
        game.state.machineState === 'DistributingEarnings' &&
        shippableGold(game.hydrated, operating(game)).length > 0 &&
        game.valid().includes('ShipGold')
    )
}

/** A Treaty debtor buying trains with the cash for a debt token. */
function debtPayable(game: Table): boolean {
    const state = game.state
    return (
        state.machineState === 'BuyingTrains' &&
        treatySigned(state.phaseId) &&
        Object.keys(state.debts).length > 0 &&
        canPayDebt(game.hydrated, operating(game)) &&
        game.valid().includes('PayDebt')
    )
}

/** The Hanging Bridge Lease's railroad after a run through the gorge. */
function leaseOwed(game: Table): boolean {
    return (
        game.state.machineState === 'DistributingEarnings' &&
        bridgeLeaseOwed(game.hydrated, operating(game)) > 0
    )
}

/** The lessee about to run, whose best run would go through the gorge on the lease. */
function leaseWorthUsing(game: Table): boolean {
    if (game.state.machineState !== 'RunningTrains' || !game.valid().includes('UseBridgeLease'))
        return false
    return arrangedHolds(
        game,
        (state) => {
            state.bridgeLeaseInUse = true
        },
        (game) => passes(bestRun(game), GorgeTownId)
    )
}

/** A run that the Track Engineer or coal may lengthen first. */
function extensionOpen(game: Table): boolean {
    return game.state.machineState === 'RunningTrains' && game.valid().includes('ExtendTrain')
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('18RoyalGorge harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes a discounted metal purchase', { timeout: 600_000 }, () => {
        save('metal-shares-stock-round', playUntil(4, 1, metalPurchaseOpen))
    })

    it('writes a steel column choice', { timeout: 600_000 }, () => {
        save('steel-choice', playUntil(4, 38, steelChoiceOpen))
    })

    it('writes a gold shipment', { timeout: 600_000 }, () => {
        save('gold-shipping', playUntil(4, 9, goldShippable))
    })

    it('writes a Treaty debt payment', { timeout: 600_000 }, () => {
        save('treaty-debts', playUntil(4, 57, debtPayable))
    })

    // Lease runs through the gorge are rare in bot games; three-player games find them soonest.
    it('writes a Hanging Bridge Lease payment', { timeout: 1_200_000 }, () => {
        save('bridge-lease', playUntil(3, 9, leaseOwed, 3000, 120))
    })

    it('writes a Hanging Bridge Lease choice', { timeout: 1_200_000 }, () => {
        save('bridge-lease-choice', playUntil(3, 9, leaseWorthUsing, 3000, 120))
    })

    it('writes a lengthened train', { timeout: 600_000 }, () => {
        save('train-extension', playUntil(4, 21, extensionOpen))
    })

    it('writes a finished game', { timeout: 600_000 }, () => {
        save(
            'finished-game',
            playUntil(
                4,
                49,
                (game) =>
                    game.state.machineState === 'GameOver' &&
                    game.state.gameEnding?.reason === LastTrainReason,
                6000
            )
        )
    })
})

// Each private's effect, seen as it happens: the private handed to the owner that uses it, in a
// seeded bot game at the moment it acts. Their histories start afresh.
// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('18RoyalGorge private scenarios', () => {
    it('writes the St. Cloud Hotel', { timeout: 600_000 }, () => {
        const game = playUntil(
            4,
            1,
            (game) => runOpen(game) && stopsAt(bestRun(game), stCloudLocation(game.state.phaseId))
        )
        saveArranged('st-cloud-hotel', game, (state) =>
            givePrivate(state, StCloudId, railroad(operating(game)))
        )
    })

    it('writes a ghost town placement', { timeout: 600_000 }, () => {
        const game = playUntil(
            4,
            1,
            (game) =>
                shipmentOpen(game) &&
                privatesOpen(game.state) &&
                shippableGold(game.hydrated, operating(game)).some(
                    (locationId) => game.state.goldCubes[locationId] === 1
                )
        )
        saveArranged('ghost-town', game, (state) =>
            givePrivate(state, GhostTownId, railroad(operating(game)))
        )
    })

    it('writes a run past a ghost town', { timeout: 600_000 }, () => {
        let site = ''
        const game = playUntil(4, 1, (game) => {
            if (!runOpen(game) || !privatesOpen(game.state)) return false
            const routes = bestRun(game)
            site = Object.keys(GoldMines).find((locationId) => passes(routes, locationId)) ?? ''
            return !!site
        })
        saveArranged('ghost-town-run', game, (state) => {
            givePrivate(state, GhostTownId, railroad(operating(game)))
            const { [site]: _emptied, ...cubes } = state.goldCubes
            state.goldCubes = cubes
            state.ghostTowns = [site]
        })
    })

    it('writes Coal Creek', { timeout: 600_000 }, () => {
        const game = playUntil(
            4,
            1,
            (game) =>
                runOpen(game) &&
                privatesOpen(game.state) &&
                passes(bestRun(game), CoalCreekLocationId)
        )
        saveArranged('coal-creek', game, (state) => {
            givePrivate(state, CoalCreekId, railroad(operating(game)))
            state.coalCreekCubes = 2
            state.coalCreekSupply = 10
        })
    })

    it('writes the Coal Depot', { timeout: 600_000 }, () => {
        const game = playUntil(4, 3, (game) => runOpen(game, 2) && privatesOpen(game.state))
        saveArranged('coal-depot', game, (state) => {
            givePrivate(state, CoalDepotId, railroad(operating(game)))
            state.coalDepotCubes = 4
        })
    })

    it('writes the Prison Labor Force', { timeout: 600_000 }, () => {
        const game = playUntilBefore(4, 1, (game, move) => {
            if (move.type !== 'LayTile' || !privatesOpen(game.state)) return false
            const locationId = moveField(move, 'locationId')
            return (
                (MapRoyalGorge.location(locationId).terrain?.cost ?? 0) > 0 &&
                !tileAt(game.state, locationId).placement
            )
        })
        saveArranged('prison-labor', game, (state) =>
            givePrivate(state, PrisonId, railroad(operating(game)))
        )
    })

    it('writes the Steel Depot', { timeout: 600_000 }, () => {
        const game = playUntilBefore(4, 5, (game, move) => {
            if (move.type !== 'LayTile' || !privatesOpen(game.state)) return false
            const definitionId = moveField(move, 'definitionId')
            return (
                !game.state.trackStep?.lays.length &&
                colorPhase(game.state.phaseId) === 'Green' &&
                TileSetRoyalGorge.definitions.find((tile) => tile.id === definitionId)?.face
                    .color === 'yellow'
            )
        })
        saveArranged('steel-depot', game, (state) => {
            givePrivate(state, SteelDepotId, railroad(operating(game)))
            state.depotSteel = 5
        })
    })

    it('writes Sulphur Springs', { timeout: 600_000 }, () => {
        const game = playUntil(
            4,
            1,
            (game) =>
                game.state.machineState === 'LayingTrack' &&
                !game.state.trackStep?.lays.length &&
                privatesOpen(game.state) &&
                !!tileAt(game.state, SulphurSpringsLocationId).placement,
            3000,
            200
        )
        saveArranged('sulphur-springs', game, (state) =>
            givePrivate(state, SulphurSpringsId, railroad(operating(game)))
        )
    })

    it('writes the Gold Nugget', { timeout: 600_000 }, () => {
        const game = playUntil(4, 15, (game) => shipmentOpen(game) && privatesOpen(game.state))
        saveArranged('gold-nugget', game, (state) =>
            givePrivate(state, NuggetId, railroad(operating(game)))
        )
    })

    it('writes Doc Holliday', { timeout: 600_000 }, () => {
        const game = playUntil(
            4,
            57,
            (game) =>
                game.state.machineState === 'BuyingTrains' &&
                operating(game) === SfId &&
                !!game.state.debts[SfId] &&
                canPayDebt(game.hydrated, SfId) &&
                game.valid().includes('PayDebt')
        )
        saveArranged('doc-holliday', game, (state) => {
            const president = presidentOf(state, SfId)
            const [doc] = othersThan(
                state,
                president?.kind === 'player' ? president.playerId : undefined
            )
            givePrivate(state, DocHollidayId, player(doc))
        })
    })

    it('writes the U.S. Mint Worker', { timeout: 600_000 }, () => {
        const arrange = (game: Table) => (state: StateRoyalGorge) =>
            givePrivate(state, MintWorkerId, player(game.player))
        const game = playUntil(
            4,
            1,
            (game) =>
                game.state.machineState === 'StockRound' &&
                colorPhase(game.state.phaseId) !== 'Yellow' &&
                privatesOpen(game.state) &&
                arrangedHolds(
                    game,
                    arrange(game),
                    (game) =>
                        !!evaluateMetalPurchase(game.hydrated, game.player, MintWorkerId, VgcId, 2)
                            .purchases
                )
        )
        saveArranged('mint-worker', game, arrange(game))
    })

    it('writes the brown gorge upgrade', { timeout: 1_200_000 }, () => {
        const game = playUntil(
            4,
            1,
            (game) =>
                game.state.machineState === 'LayingTrack' &&
                !game.state.trackStep?.lays.length &&
                colorPhase(game.state.phaseId) === 'Brown' &&
                tileAt(game.state, GorgeTownId).placement?.definitionId ===
                    GreenGorgeTileIds[GorgeTownId] &&
                new TrackConstruction(game.hydrated, TrackRulesRoyalGorge).choices(GorgeTownId)
                    .length > 0,
            3000,
            120
        )
        save('brown-gorge', game)
    })

    it('writes the private incomes', { timeout: 600_000 }, () => {
        const game = playUntilBefore(4, 1, (game, move, after) => {
            const set = after.operatingSet
            const was = game.state.operatingSet
            return (
                !!set &&
                move.type === 'FinishOperatingTurn' &&
                (was?.number !== set.number || was.roundNumber !== set.roundNumber) &&
                colorPhase(after.phaseId) === 'Brown'
            )
        })
        saveArranged('private-income', game, (state) => {
            const [first, second, third] = state.players.map((entry) => entry.playerId)
            givePrivate(state, OilFieldsId, player(first))
            givePrivate(state, SilverMinesId, player(second))
            givePrivate(state, SulphurSpringsId, player(third))
            // Sulphur Springs pays its player once its town has a tile (B2).
            if (!tileAt(state, SulphurSpringsLocationId).placement) {
                const [piece] = TileSetRoyalGorge.availablePieces(state.tileInventory, '18xx:3')
                state.tileInventory = TileSetRoyalGorge.replace(state.tileInventory, {
                    locationId: SulphurSpringsLocationId,
                    placement: { pieceId: piece.id, definitionId: '18xx:3', rotation: 0 },
                    returnPrevious: false
                })
            }
        })
    })

    it(
        'writes the set’s end, with the Local Jeweler and the Gold Miner',
        { timeout: 600_000 },
        () => {
            const game = playUntilBefore(
                4,
                1,
                (game, _move, after) =>
                    game.state.machineState !== 'StockRound' &&
                    after.machineState === 'StockRound' &&
                    colorPhase(after.phaseId) === 'Green' &&
                    game.state.goldShipped > 0
            )
            saveArranged('set-end', game, (state) => {
                const [first, second] = state.players.map((entry) => entry.playerId)
                givePrivate(state, JewelerId, player(first))
                state.jewelerCash = 15
                givePrivate(state, GoldMinerId, player(second))
            })
        }
    )
})
