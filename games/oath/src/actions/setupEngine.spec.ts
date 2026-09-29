import { servedJson } from '../testing/projection.js'
import { vaultOf, engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { GameStatus, assertExists, type Game } from '@tabletop/common'
import { GameResult } from '@tabletop/common'
import { Search, SearchSource } from '../actions/search.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { CompleteRest } from '../actions/completeRest.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { IMPERIAL_COLOR, Region, TOTAL_FAVOR } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { type OathVault } from '../model/vault.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { expectFullFavorComplement } from '../testing/census.js'
import { expectOneWarbandColorPerSite, warbandCensus } from '../testing/census.js'
import { CHANCELLOR_WARBANDS, EXILE_WARBANDS } from '../model/setup.js'
import { SetupVariant } from '../data/worldDeck.js'
import { testGame } from '../testing/game.js'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const PLAYERS = ['p1', 'p2', 'p3']

/** Starts through the engine rather than the initializer, so the first state's `enter()` runs. */
function startGame() {
    // Pinned to Curated because MASTER_SEED's deal depends on the deck variant.
    const game = testGame(PLAYERS, { status: GameStatus.WaitingToStart, config: { setupVariant: SetupVariant.Curated } })
    const { startedGame, initialState } = engine.startGame(game, { masterSeed: MASTER_SEED })

    const vault = vaultOf(initialState)
    return { game: startedGame, state: initialState, vault }
}

function runSetup() {
    return walkSetup(startGame())
}

/** R-1.13, R-4.1.4 — under Supremacy nothing in the Wake is mandatory. */
function wake(game: Game, state: OathProjectedState, vault: OathVault, playerId: string) {
    if (state.machineState !== MachineState.WakePhase) {
        expect(state.machineState).toBe(MachineState.ActPhase)
        return state
    }
    return engine.runNext(buildAction(ResolveWake, { playerId, favorSteps: [] }), state, game)
        .updatedState
}

function walkSetup({
    game,
    state,
    vault
}: {
    game: Game
    state: OathProjectedState
    vault: OathVault
}) {
    const chancellorId = state.chancellorPlayerId
    assertExists(chancellorId, 'setup names a Chancellor')
    let current = state

    for (const playerId of current.turnManager.turnOrder) {
        const hydrated = new HydratedOathGameState(current)
        const hand = hydrated.getPlayerState(playerId).knownHand()
        current = engine.runNext(buildAction(SetupChoice, {
            playerId,
            // R-1.23.1 — only the Chancellor is bound to the top Cradle site.
            siteId: playerId === chancellorId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1],
            adviserCardId: hand[0],
            discardOrder: [hand[1], hand[2]]
        }), current, game).updatedState
    }

    return { game, state: current, vault, chancellorId }
}

describe('setup through GameEngine.run() (R-1.19–R-1.23.3)', () => {
    it('R-1.19, R-1.20 — the deal is in the state startGame() hands out', () => {
        const { state } = startGame()
        expect(state.machineState).toBe(MachineState.Setup)
        const initial = new HydratedOathGameState(state)

        for (const player of initial.players) {
            expect(player.handIds).toHaveLength(3)
        }
        for (const region of Object.values(Region)) {
            expect(initial.discardPileCounts[region]).toBe(1)
        }
        // R-1.22, R-8.8 — no Visions are dealt at setup.
        expect(initial.visionsDrawn).toBe(0)
    })

    it('R-1.23 — the game opens waiting on the Chancellor’s SetupChoice, and nothing else', () => {
        const { game, state } = startGame()
        const chancellorId = state.chancellorPlayerId
        assertExists(chancellorId, 'setup names a Chancellor')
        const exile = state.turnManager.turnOrder[1]
        expect(state.activePlayerIds).toEqual([chancellorId])
        expect(engine.getValidActionTypesForPlayer(game, state, chancellorId)).toEqual([
            ActionType.SetupChoice
        ])
        expect(engine.getValidActionTypesForPlayer(game, state, exile)).toEqual([])
    })

    it('R-1.23 — every pawn is placed and the machine hands over to the Wake Phase', () => {
        const { state, chancellorId } = runSetup()
        const after = new HydratedOathGameState(state)

        for (const player of after.players) {
            expect(player.siteId).toBeDefined()
            assertExists(player.siteId, 'every pawn is placed')
            expect(after.isSiteFaceup(player.siteId)).toBe(true)
            expect(player.handIds).toEqual([])
            expect(player.advisers).toHaveLength(1)
            expect(player.advisers[0].faceUp).toBe(false)
        }
        expect(after.getPlayerState(chancellorId).siteId).toBe(TOP_CRADLE_SLOT)
        // R-4.1.4 — the seed's top Cradle site is Salt Flats, an Opportunity site, so the Wake waits.
        expect(state.machineState).toBe(MachineState.WakePhase)
        expect(state.activePlayerIds).toEqual([chancellorId])
        expect(after.siteCardAt(TOP_CRADLE_SLOT)).toBe('site.salt-flats')
    })

    it('R-1.23.3, R-10.5 — setup discards land in the vault, in the next region’s pile', () => {
        const { state } = runSetup()
        const after = new HydratedOathGameState(state)

        const inVault = Object.values(vaultOf(state).discardPiles).flat().length
        const published = Object.values(Region).reduce(
            (n, region) => n + after.discardPileCounts[region],
            0
        )
        // R-1.19, R-1.23.3
        expect(published).toBe(3 + 2 * PLAYERS.length)
        expect(inVault).toBe(published)
    })

    it('R-9.4 — no card in the vault is named anywhere in public state', () => {
        const { state } = runSetup()
        const json = servedJson(state)
        const vault = vaultOf(state)
        const leaked = [
            ...vault.worldDeck,
            ...Object.values(vault.discardPiles).flat(),
            ...Object.values(vault.siteFacedown),
            ...Object.values(vault.relicFacedown),
            ...vault.relicDeck,
            ...vault.siteDeck
        ].filter((cardId) => json.includes(`"${cardId}"`))
        expect(leaked).toEqual([])
    })

    it('R-1.4, R-1.8, R-1.9 — favor and warbands survive setup intact', () => {
        const { state } = runSetup()
        const after = new HydratedOathGameState(state)

        expectFullFavorComplement(after)
        expectOneWarbandColorPerSite(after)

        const census = warbandCensus(after)
        expect(census[IMPERIAL_COLOR]).toBe(CHANCELLOR_WARBANDS)
        expect(
            Object.entries(census)
                .filter(([color]) => color !== IMPERIAL_COLOR)
                .map(([, n]) => n)
        ).toEqual(Array(PLAYERS.length - 1).fill(EXILE_WARBANDS))
    })

    it('R-5.1 — a real Search runs on the board setup produced, off the real world deck', () => {
        const { game, state: afterSetup, vault, chancellorId } = runSetup()

        const state = wake(game, afterSetup, vault, chancellorId)
        expect(state.machineState).toBe(MachineState.ActPhase)

        const deckBefore = vaultOf(state).worldDeck.length
        let result = engine.runNext(buildAction(Search, {
            playerId: chancellorId,
            drawFrom: SearchSource.WorldDeck,
            // R-X.3 — a world deck draw takes cards out of the vault.
            revealsInfo: true
        }), state, game)
        const after = new HydratedOathGameState(result.updatedState)

        expect(vaultOf(result.updatedState).worldDeck.length).toBeLessThan(deckBefore)
        expect(after.getPlayerState(chancellorId).knownHand().length).toBeGreaterThan(0)
        // R-5.1.1 — the Visions Drawn track is on 0, so the Search costs 2.
        expect(after.getPlayerState(chancellorId).supply).toBe(5)
        expect(result.updatedState.machineState).toBe(MachineState.Searching)
    })

    it('R-1.4 — favor is conserved through setup and into the first action', () => {
        const { game, state, vault, chancellorId } = runSetup()
        expectFullFavorComplement(new HydratedOathGameState(state))
        const woke = wake(game, state, vault, chancellorId)
        expectFullFavorComplement(new HydratedOathGameState(woke))
        expect(TOTAL_FAVOR).toBe(36)
    })
})

describe('the full exit criterion — setup to victory through the engine', () => {
    it('ends by the Stable Regime Win when the end die passes (R-3.3)', () => {
        const { state, chancellorId, warbandsBefore } = playFullGame(20260827)

        // R-3.3 — on this seed the end die first passes after round seven.
        expect(state.round).toBe(7)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.oathkeeperPlayerId).toBe(chancellorId)
        expect(state.winningPlayerIds).toEqual([chancellorId])
        expect(state.activePlayerIds).toEqual([])
        expectGameConserved(state, warbandsBefore)
    })

    it('ends by War Exhaustion when the die never passes (R-3.4)', () => {
        const { state, chancellorId, warbandsBefore } = playFullGame(seedReachingTheEighthRound())

        expect(state.round).toBe(8)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        // R-3.4.1 — the Empire holds the title, so R-3.4.2's Usurper branch never applies.
        expect(state.oathkeeperPlayerId).toBe(chancellorId)
        expect(state.winningPlayerIds).toEqual([chancellorId])
        expectGameConserved(state, warbandsBefore)
    })
})

function expectGameConserved(state: OathProjectedState, warbandsBefore: Record<string, number>) {
    const hydrated = new HydratedOathGameState(state)
    expect(warbandCensus(hydrated)).toEqual(warbandsBefore)
    expectFullFavorComplement(hydrated)
    expectOneWarbandColorPerSite(hydrated)
}

/** R-3.3 — `seed` fixes the end die, and so the round the game ends on. */
function playFullGame(seed: number) {
    const started = startGame()
    started.state.prng = { seed, invocations: 0 }
    started.state.protectedPrng = { seed, invocations: 0 }
    const { game, state: afterSetup, vault, chancellorId } = walkSetup(started)
    let state = afterSetup

    expect(state.machineState).toBe(MachineState.WakePhase)
    expect(state.round).toBe(1)
    expect(state.oathkeeperPlayerId).toBe(chancellorId)

    const warbandsBefore = warbandCensus(new HydratedOathGameState(state))
    const order = state.turnManager.turnOrder
    let searched = false

    for (let round = 1; round <= 8 && !state.result; round++) {
        for (const playerId of order) {
            if (state.result) break
            expect(state.activePlayerIds).toEqual([playerId])

            state = wake(game, state, vault, playerId)

            // R-4.2 — one real Search, so the game is played rather than passed.
            if (!searched && playerId === chancellorId) {
                state = engine.runNext(buildAction(Search, {
                    playerId,
                    drawFrom: SearchSource.WorldDeck,
                    revealsInfo: true
                }), state, game).updatedState
                const hand = new HydratedOathGameState(state).getPlayerState(playerId).knownHand()
                expect(hand.length).toBeGreaterThan(0)
                state = engine.runNext(buildAction(SearchResolve, {
                    playerId,
                    keptCardId: hand[0],
                    discardOrder: hand.slice(1),
                    play: SearchPlay.Discard,
                    index: state.actionCount
                }), state, game).updatedState
                searched = true
            }

            // R-4.2 allows a turn of zero actions, then R-4.3's Rest.
            state = engine.runNext(buildAction(EndActPhase, {
                playerId
            }), state, game).updatedState
            state = engine.runNext(buildAction(CompleteRest, {
                playerId
            }), state, game).updatedState
        }
    }

    return { state, chancellorId, warbandsBefore }
}

/** R-3.3 — about one seed in five fails all three end rolls. */
function seedReachingTheEighthRound(): number {
    for (let seed = 1; seed < 500; seed++) {
        if (playFullGame(seed).state.round === 8) return seed
    }
    throw Error('no seed found whose end die fails through the seventh round')
}
