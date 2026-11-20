import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import {
    TrackConstruction,
    accessRightPurchase,
    getCompany,
    nextOperatingCompany,
    privateOwner,
    trainsOwnedBy
} from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { kit, openAuction, type Table } from '../test/kit.js'
import {
    AccessRightRules1828,
    CoalRightId,
    coalHolders,
    reachesCoalfields,
    tunnelHoldsCoal
} from './coal.js'
import { cobourgRuns } from './cobourg.js'
import { CobourgRailwayId, MhId } from './ids.js'
import { TunnelLocationId } from './map.js'
import { offeredMergers } from './merger.js'
import { mohawkOffers } from './mohawkOffers.js'
import { movableShellTrainIds } from './shells.js'
import { TrackRules1828 } from './track.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1828-ui/src/scenarios/', import.meta.url)

// The first of the seeded games to reach the position within a harness-sized history.
function playUntil(players: number, seed: number, done: (game: Table) => boolean, limit = 4000) {
    for (let tried = seed; tried < seed + 60; tried++) {
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
    const id = `scenario-1828-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

/** A stock turn on which the player may start a merger. */
function mergerOpen(game: Table): boolean {
    return (
        game.state.machineState === 'StockRound' &&
        !game.state.merger &&
        offeredMergers(game.hydrated, game.player).length > 0
    )
}

/** A merger waiting for a player's single share. */
function singleShareDecision(game: Table): boolean {
    return game.valid().includes('DecideMergerShare')
}

/** A system at the start of its train step, with a train it may move between its shells. */
function shellsOpen(game: Table): boolean {
    const companyId = game.state.trainPurchaseStep?.companyId
    return (
        game.state.machineState === 'BuyingTrains' &&
        !!companyId &&
        movableShellTrainIds(game.hydrated, companyId).length > 0
    )
}

/** The C&P's owner laying its tile. */
function cobourgLaying(game: Table): boolean {
    return (
        game.state.machineState === 'LayingTrack' &&
        game.state.trackStep?.companyId === CobourgRailwayId &&
        game.valid().includes('LayTile')
    )
}

/** A track step with the M&H still to exchange, its owner on or off turn. */
function mohawkExchangeOpen(game: Table, onTurn: boolean): boolean {
    const state = game.hydrated
    if (state.machineState !== 'LayingTrack' || getCompany(state, MhId).closed) return false
    const owner = privateOwner(state, MhId)
    if (owner?.kind !== 'player' || state.activePlayerIds.includes(owner.playerId) === !onTurn)
        return false
    const offers = mohawkOffers(state, owner.playerId)
    return offers.shares.some((offer) => offer.float) && offers.directorships.length > 0
}

/** A director able to buy their company a coal marker on the Coalfields. */
function coalForSale(game: Table): boolean {
    const companyId = nextOperatingCompany(game.hydrated)
    return (
        !!companyId &&
        game.valid().includes('BuyAccessRight') &&
        'price' in
            accessRightPurchase(
                game.hydrated,
                AccessRightRules1828,
                game.player,
                companyId,
                CoalRightId
            )
    )
}

/** A company able to build the tunnel and take the coal marker on it. */
function tunnelOpen(game: Table): boolean {
    return (
        game.state.machineState === 'LayingTrack' &&
        tunnelHoldsCoal(game.hydrated) &&
        game.state.trackStep?.companyId !== CobourgRailwayId &&
        game.valid().includes('LayTile') &&
        new TrackConstruction(game.hydrated, TrackRules1828).choices(TunnelLocationId).length > 0
    )
}

/** A company with a coal marker and trains, its track reaching the Coalfields. */
function runningWithCoal(game: Table): boolean {
    const state = game.hydrated
    const companyId = nextOperatingCompany(state)
    return (
        state.machineState === 'RunningTrains' &&
        !!companyId &&
        companyId !== CobourgRailwayId &&
        coalHolders(state).includes(companyId) &&
        trainsOwnedBy(state, { kind: 'company', companyId }).length > 0 &&
        reachesCoalfields(state, companyId)
    )
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1828 harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes the first stock round', () => {
        const game = kit.table(4, 1)
        openAuction(game)
        save('first-stock-round', game)
    })

    it('writes a merger to start', { timeout: 600_000 }, () => {
        save('merger', playUntil(4, 1, mergerOpen))
    })

    it('writes a single share to trade up', { timeout: 600_000 }, () => {
        save('merger-single-share', playUntil(4, 1, singleShareDecision))
    })

    it('writes a system arranging its shells', { timeout: 600_000 }, () => {
        save('system-shells', playUntil(4, 1, shellsOpen))
    })

    it('writes the C&P laying its tile', { timeout: 600_000 }, () => {
        save('cobourg-lay', playUntil(4, 1, cobourgLaying))
    })

    it('writes the C&P choosing its run', { timeout: 600_000 }, () => {
        save(
            'cobourg-run',
            playUntil(
                4,
                21,
                (game) =>
                    game.valid().includes('ChooseCobourgRun') &&
                    cobourgRuns(game.hydrated).length > 1
            )
        )
    })

    it('writes the M&H exchange on its owner’s operating turn', { timeout: 600_000 }, () => {
        save(
            'mohawk-on-turn',
            playUntil(4, 1, (game) => mohawkExchangeOpen(game, true))
        )
    })

    it('writes the M&H exchange off its owner’s turn', { timeout: 600_000 }, () => {
        save(
            'mohawk-off-turn',
            playUntil(4, 1, (game) => mohawkExchangeOpen(game, false))
        )
    })

    it('writes a coal marker for sale', { timeout: 600_000 }, () => {
        save('coal-marker-for-sale', playUntil(4, 1, coalForSale))
    })

    it('writes the tunnel open to build', { timeout: 600_000 }, () => {
        save('coal-tunnel', playUntil(4, 1, tunnelOpen))
    })

    it('writes a company running with coal', { timeout: 600_000 }, () => {
        save('coal-run', playUntil(4, 1, runningWithCoal))
    })

    it('writes a finished game', { timeout: 600_000 }, () => {
        save(
            'finished-game',
            playUntil(4, 1, (game) => game.state.machineState === 'GameOver', 8000)
        )
    })
})
