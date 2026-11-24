import { assertExists, GameEngine, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionCardKinds } from '../data/cards.js'
import { Charters, Mandates, type WritId } from '../data/writs.js'
import {
    FeudumGameState,
    FeudumGameStateValidator,
    HydratedFeudumGameState
} from '../model/gameState.js'
import { HydratedFeudumPlayerState } from '../model/playerState.js'
import { withoutConcealed } from '../testing/protected.js'
import { canonicalState, testGame } from '../testing/state.js'
import { ActionType } from './actions.js'
import { FeudumApiActions } from './apiActions.js'
import { FeudumRuntime } from './runtime.js'

const projector = FeudumRuntime.visibility.state
const spectator = { kind: 'spectator' } as const
const CURSOR = { seed: 7, invocations: 3 }
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const DRAWER = 'p2'
const OWNER_KNOWN = ['hand', 'committedPouch', 'writs', 'sealedCharters', 'deckKnowledge']

function asPlayer(playerId: string) {
    return { kind: 'player', playerId } as const
}

function perspectives(state: FeudumGameState): Visibility.Perspective[] {
    return [spectator, ...state.players.map((player) => asPlayer(player.playerId))]
}

function seat(state: FeudumGameState, playerId: string) {
    const row = state.players.find((player) => player.playerId === playerId)
    assertExists(row, `No seat ${playerId}`)
    return row
}

/** A table with something in every concealed field: each seat holds its own distinct writs. */
function tableInPlay(numPlayers = 4): FeudumGameState {
    const state = canonicalState(numPlayers)
    const writIds: WritId[] = [...Mandates, ...Charters].map((writ) => writ.id)
    state.masterSeed = MASTER_SEED
    state.protectedPrng = CURSOR
    state.players.forEach((player, index) => {
        const [unsealed, sealed, known] = writIds.slice(index * 3, index * 3 + 3)
        player.hand = [ActionCardKinds[index]]
        player.handCount = 1
        player.committedPouch = index % 2 === 0 ? 'saltpeter' : 'sulfur'
        player.writs = [unsealed]
        player.sealedCharters = [sealed]
        player.sealedCharterCount = 1
        player.writCount = 2
        player.deckKnowledge = [{ slot: index, writId: known }]
    })
    state.flow.writDraw = { drawnCount: 2, keep: 1, source: 'explore', shovelsOffered: false }
    seat(state, DRAWER).writsDrawn = writIds.slice(-2)
    return state
}

function project(state: FeudumGameState, perspective: Visibility.Perspective) {
    return projector.project(state, perspective, { config: {} })
}

describe('R-5.1 the registered visibility', () => {
    it('R-5.1 registers a state projector and an action projector for every Action', () => {
        expect(FeudumRuntime.visibility.state).toBeDefined()
        for (const type of Object.values(ActionType)) {
            expect(FeudumApiActions[type]).toBeDefined()
        }
    })

    it('R-5.1 a game started on this runtime is protected, so the engine guards execution', () => {
        const engine = new GameEngine(FeudumRuntime)
        const { startedGame } = engine.startGame(testGame(3), { masterSeed: '0'.repeat(32) })
        expect(startedGame.protectedInformation).toBe(true)
        expect(Visibility.getGameVisibility(startedGame, FeudumRuntime)).toBe(
            FeudumRuntime.visibility
        )
    })
})

describe('the projection of a player and a spectator', () => {
    it('R-5.1, R-5-H1 omits exactly the concealed fields, at 2 to 5 players', () => {
        for (const numPlayers of [2, 3, 4, 5]) {
            const state = tableInPlay(numPlayers)
            for (const perspective of perspectives(state)) {
                expect(project(state, perspective)).toStrictEqual(
                    withoutConcealed(state, perspective)
                )
            }
        }
    })

    it('R-5-H1, R-1.4-H2 the vault and the master seed reach no one, the cursor is neutral', () => {
        const state = tableInPlay()
        for (const perspective of perspectives(state)) {
            const projected = project(state, perspective)
            expect(projected).not.toHaveProperty('vault')
            expect(projected).not.toHaveProperty('masterSeed')
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        }
    })

    it('R-3.1, R-4.4.4, R-4.4.1 shows a seat its own hand, writs and knowledge, no one else', () => {
        const state = tableInPlay()
        const owned = seat(state, 'p1')
        const projected = project(state, asPlayer('p1'))
        for (const player of projected.players) {
            if (player.playerId === 'p1') {
                expect(player.hand).toEqual(owned.hand)
                expect(player.committedPouch).toEqual(owned.committedPouch)
                expect(player.writs).toEqual(owned.writs)
                expect(player.sealedCharters).toEqual(owned.sealedCharters)
                expect(player.deckKnowledge).toEqual(owned.deckKnowledge)
            } else {
                for (const field of OWNER_KNOWN) {
                    expect(player).not.toHaveProperty(field)
                }
            }
        }
        for (const player of project(state, spectator).players) {
            for (const field of OWNER_KNOWN) {
                expect(player).not.toHaveProperty(field)
            }
        }
    })

    it('R-3.1-H1 a seat that committed no pouch good looks the same to the table as one that did', () => {
        const state = tableInPlay()
        const without = structuredClone(state)
        seat(without, 'p1').committedPouch = undefined
        for (const perspective of [spectator, asPlayer('p2'), asPlayer('p3')]) {
            expect(project(state, perspective)).toStrictEqual(project(without, perspective))
        }
        const committed = seat(state, 'p1').committedPouch
        expect(committed).toBeDefined()
        const told = project(state, asPlayer('p1')).players.find((row) => row.playerId === 'p1')
        const none = project(without, asPlayer('p1')).players.find((row) => row.playerId === 'p1')
        expect(told?.committedPouch).toBe(committed)
        expect(none).not.toHaveProperty('committedPouch')
    })

    it('R-3.10, R-4.4.1 shows a pending draw to its drawer; the table sees the counts', () => {
        const state = tableInPlay()
        const pending = state.flow.writDraw
        expect(project(state, asPlayer(DRAWER)).flow.writDraw).toEqual(pending)
        const drawer = project(state, asPlayer(DRAWER)).players.find(
            (row) => row.playerId === DRAWER
        )
        expect(drawer?.writsDrawn).toEqual(seat(state, DRAWER).writsDrawn)
        for (const perspective of [asPlayer('p1'), spectator]) {
            const { writDraw } = project(state, perspective).flow
            const seen = project(state, perspective).players.find((row) => row.playerId === DRAWER)
            expect(seen).not.toHaveProperty('writsDrawn')
            expect(writDraw).toMatchObject({ drawnCount: 2, keep: 1 })
        }
    })

    it('R-5.1, R-5-H1, R-4.4.4 keeps every public count', () => {
        const state = tableInPlay()
        seat(state, 'p1').sealCount = 2
        for (const perspective of perspectives(state)) {
            const projected = project(state, perspective)
            expect(projected.writDeck).toEqual(state.writDeck)
            expect(projected.publicDeckWrits).toEqual(state.publicDeckWrits)
            expect(projected.supply.sealPileCount).toBe(state.supply.sealPileCount)
            expect(projected.regionStacks).toEqual(state.regionStacks)
            projected.players.forEach((player, index) => {
                const canonical = state.players[index]
                expect(player.handCount).toBe(canonical.handCount)
                expect(player.writCount).toBe(canonical.writCount)
                expect(player.sealedCharterCount).toBe(canonical.sealedCharterCount)
                expect(player.sealCount).toBe(canonical.sealCount)
            })
        }
    })

    it('R-5.4-H1 the haversack counts stay public', () => {
        const state = tableInPlay()
        for (const perspective of perspectives(state)) {
            expect(project(state, perspective).supply.haversack).toEqual(state.supply.haversack)
        }
    })

    it('R-5.1, R-5-H1, R-1.4-H2 names no concealed writ, seal or stacked landscape', () => {
        const state = tableInPlay()
        const writsOf = (row: FeudumGameState['players'][number]) => [
            ...row.writs,
            ...row.sealedCharters,
            ...row.deckKnowledge.map(({ writId }) => writId)
        ]
        const known: string[] = writsOf(seat(state, 'p1'))
        const writs: string[] = [
            ...state.vault.writDeck.map(({ writId }) => writId),
            ...state.players.flatMap(writsOf),
            ...(seat(state, DRAWER).writsDrawn ?? [])
        ]
        const concealed = [
            ...writs.filter((writId) => !known.includes(writId)),
            ...state.vault.sealPile,
            MASTER_SEED
        ]
        expect(concealed.length).toBeGreaterThan(state.vault.sealPile.length)

        const text = JSON.stringify(project(state, asPlayer('p1')))
        for (const value of concealed) {
            expect(text).not.toContain(`"${value}"`)
        }
        expect(project(state, spectator).tileLandscapes).toEqual({})
    })

    it('R-5.1 does not change the canonical state', () => {
        const state = tableInPlay()
        const before = structuredClone(state)
        project(state, spectator)
        expect(state).toStrictEqual(before)
    })
})

describe('hydrating a projection', () => {
    it('R-5-H1 hydrates for every seat and a spectator, and round-trips exactly', () => {
        for (const numPlayers of [2, 3, 4, 5]) {
            const state = tableInPlay(numPlayers)
            for (const perspective of perspectives(state)) {
                const projected = project(state, perspective)
                const hydrated = new HydratedFeudumGameState(JSON.parse(JSON.stringify(projected)))
                expect(hydrated.dehydrate()).toStrictEqual(projected)
                expect(hydrated.numPlayers).toBe(numPlayers)
            }
        }
    })

    it('R-5-H1 canonical and projected input share one validator, and it still rejects', () => {
        const state = tableInPlay()
        expect(new HydratedFeudumGameState(state).dehydrate()).toStrictEqual(state)
        const projected = project(state, spectator)
        expect(() => new HydratedFeudumGameState(projected)).not.toThrow()
        const broken = JSON.parse(JSON.stringify({ ...projected, epoch: 9 }))
        expect(() => new HydratedFeudumGameState(broken)).toThrow()
    })

    it('R-5-H1 the strict schemas stay strict: a projection is not a complete state', () => {
        const projected = project(tableInPlay(), spectator)
        expect(FeudumGameStateValidator.Check(projected)).toBe(false)
    })

    it('R-5-H1 fills no secret: what was omitted stays absent', () => {
        const hydrated = new HydratedFeudumGameState(project(tableInPlay(), asPlayer('p1')))
        expect(hydrated.vault).toBeUndefined()
        expect(hydrated.masterSeed).toBeUndefined()
        expect(hydrated.getPlayerState('p2').hand).toBeUndefined()
        expect(hydrated.getPlayerState(DRAWER).writsDrawn).toBeUndefined()
    })

    it('R-5-H1 a concealed read fails, so guarded execution defers to the host', () => {
        const hydrated = new HydratedFeudumGameState(project(tableInPlay(), asPlayer('p1')))
        expect(() => hydrated.requireVault()).toThrow('requires the concealed vault')
    })

    it('R-3.1, R-4.4.4, R-4.4.1 a seat reads its own owner-known fields, not another seat', () => {
        const state = tableInPlay()
        const hydrated = new HydratedFeudumGameState(project(state, asPlayer('p1')))
        const own = hydrated.getPlayerState('p1')
        const other = hydrated.getPlayerState('p2')
        const owned = seat(state, 'p1')

        expect(own).toBeInstanceOf(HydratedFeudumPlayerState)
        expect(own.requireHand()).toEqual(owned.hand)
        expect(own.requireWrits()).toEqual(owned.writs)
        expect(own.requireSealedCharters()).toEqual(owned.sealedCharters)
        expect(own.requireDeckKnowledge()).toEqual(owned.deckKnowledge)

        expect(() => other.requireHand()).toThrow('owner-known')
        expect(() => other.requireWrits()).toThrow('owner-known')
        expect(() => other.requireSealedCharters()).toThrow('owner-known')
        expect(() => other.requireDeckKnowledge()).toThrow('owner-known')
    })
})
