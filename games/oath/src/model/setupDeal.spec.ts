import { getPrng, GameStatus } from '@tabletop/common'
import type { Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { createOathVault, type OathVault } from './vault.js'
import { drawFromBottomOfWorldDeck, drawFromWorldDeck } from './vault.js'
import { resolveSetupDeal, applySetupDeal } from './setup.js'
import { CardKind, Region } from './oathEnums.js'
import { HydratedOathGameState } from './gameState.js'
import { MachineState } from '../definition/states.js'
import { SETUP_HAND_SIZE, setupDrawTotal } from '../data/worldDeck.js'
import { servedJson } from '../testing/projection.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { OathTestEngine } from '../testing/engine.js'
import { OathRuntime } from '../definition/runtime.js'
import { testGame, setUpState } from '../testing/game.js'

/** R-1.19 to R-1.22 — the deal draws from the bottom of the world deck; Search draws from the top (R-10.6). */
describe('R-1.19–R-1.22 — the initial state is dealt', () => {
    it('R-1.20 — every player holds three cards before the first action', () => {
        const state = setUpState(3)
        for (const player of state.players) {
            expect(player.handIds).toHaveLength(SETUP_HAND_SIZE)
            expect(player.handCount).toBe(SETUP_HAND_SIZE)
        }
        const inDeck = new Set(state.requireVault().worldDeck)
        for (const player of state.players) {
            for (const cardId of player.knownHand()) expect(inDeck.has(cardId)).toBe(false)
        }
    })

    it('R-1.19 — one card seeds each discard pile, in the vault and in the public counts', () => {
        const state = setUpState(3)
        for (const region of Object.values(Region)) {
            expect(state.discardPileCounts[region]).toBe(1)
            expect(state.requireVault().discardPiles[region]).toHaveLength(1)
            expect(state.discardTopBackType?.[region]).toBeDefined()
        }
    })

    it('R-1.19, R-1.20 — the deal comes off the bottom, and only the deal', () => {
        const state = setUpState(4)
        const dealt = setupDrawTotal(4)
        const inDeck = new Set(state.requireVault().worldDeck)
        const outOfDeck = [
            ...state.players.flatMap((player) => player.knownHand()),
            ...Object.values(state.requireVault().discardPiles).flat()
        ]
        expect(outOfDeck).toHaveLength(dealt)
        expect(outOfDeck.some((cardId) => inDeck.has(cardId))).toBe(false)
    })

    it('R-1.22 — no Vision is drawn at setup, so the track stays on 0', () => {
        const state = setUpState(3)
        expect(state.visionsDrawn).toBe(0)
        for (const player of state.players) expect(player.visionIds).toEqual([])
    })

    it('R-9.4 — the top card’s back type is published and the deck is not exhausted', () => {
        const state = setUpState(3)
        expect(state.topCardBackType).toBe(state.requireVault().worldDeck[0].startsWith('vision.') ? CardKind.Vision : CardKind.Denizen)
        expect(state.worldDeckExhausted).toBe(false)
    })

    it('opens on SetupChoice: no pawn is placed and the Chancellor is waited on', () => {
        const state = setUpState(3)
        expect(state.machineState).toBe(MachineState.Setup)
        for (const player of state.players) expect(player.siteId).toBeUndefined()
    })

    it('R-9.4 — a dealt hand reaches nobody but its owner', () => {
        const state = setUpState(3)
        const spectatorJson = servedJson(state)
        for (const player of state.players) {
            for (const cardId of player.knownHand()) {
                expect(spectatorJson).not.toContain(`"${cardId}"`)
            }
        }
        const p1 = servedJson(state, { kind: 'player', playerId: 'p1' })
        for (const cardId of state.getPlayerState('p1').knownHand()) {
            expect(p1).toContain(`"${cardId}"`)
        }
        for (const cardId of state.getPlayerState('p2').knownHand()) {
            expect(p1).not.toContain(`"${cardId}"`)
        }
    })

    it('deals the same hands from the same seed', () => {
        const hands = (state: HydratedOathGameState) => state.players.map((p) => p.knownHand())
        expect(hands(setUpState(3, {}, 7))).toEqual(hands(setUpState(3, {}, 7)))
    })
})

function orderedDeck(size = 40): string[] {
    return Array.from({ length: size }, (_, i) => `denizen.order.card-${i}`)
}

function vaultWith(deck: string[]): OathVault {
    return createOathVault({ worldDeck: deck, composeWorldDeck: () => [...deck]}, getPrng(1))
}

describe('R-1.19, R-1.20 — setup draws from the bottom', () => {
    it('R-10.6 vs R-1.20 — the bottom draw and the top draw take opposite ends', () => {
        const deck = orderedDeck(10)
        const fromBottom = drawFromBottomOfWorldDeck(vaultWith(deck), 3)
        const fromTop = drawFromWorldDeck(vaultWith(deck), 3).drawn

        expect(fromBottom).toEqual(['denizen.order.card-9', 'denizen.order.card-8', 'denizen.order.card-7'])
        expect(fromTop).toEqual(['denizen.order.card-0', 'denizen.order.card-1', 'denizen.order.card-2'])
        expect(fromBottom).not.toEqual(fromTop)
    })

    it('R-1.19 — three cards off the bottom, one into each region’s pile', () => {
        const vault = vaultWith(orderedDeck(40))
        resolveSetupDeal(vault, ['p1', 'p2'])

        for (const region of Object.values(Region)) {
            expect(vault.discardPiles[region]).toHaveLength(1)
        }
        expect(
            Object.values(vault.discardPiles)
                .flat()
                .sort()
        ).toEqual(
            ['denizen.order.card-39', 'denizen.order.card-38', 'denizen.order.card-37'].sort()
        )
    })

    it('R-1.20 — each player draws three, in turn order, off the bottom', () => {
        const vault = vaultWith(orderedDeck(40))
        const result = resolveSetupDeal(vault, ['p1', 'p2', 'p3'])

        expect(result.hands.map((h) => h.playerId)).toEqual(['p1', 'p2', 'p3'])
        for (const hand of result.hands) {
            expect(hand.cardIds).toHaveLength(3)
        }
        // R-1.19's three come off first.
        expect(result.hands[0].cardIds).toEqual([
            'denizen.order.card-36',
            'denizen.order.card-35',
            'denizen.order.card-34'
        ])
    })

    it('R-9.4 — R-1.19’s three cards never reach the action', () => {
        const vault = vaultWith(orderedDeck(40))
        const seeded = ['denizen.order.card-39', 'denizen.order.card-38', 'denizen.order.card-37']
        const result = resolveSetupDeal(vault, ['p1', 'p2'])

        // The action log is broadcast permanently, and R-9.4 keeps these three from everyone.
        const json = JSON.stringify(result)
        for (const cardId of seeded) {
            expect(json).not.toContain(cardId)
        }
    })

    it('R-1.22 — the marker counts Visions in the hands, not in the discard seed', () => {
        // R-1.19's three are Visions; R-1.20's are not.
        const deck = [
            ...orderedDeck(10),
            'denizen.order.hand-a',
            'denizen.order.hand-b',
            'denizen.order.hand-c',
            'vision.conquest',
            'vision.faith',
            'vision.rebellion'
        ]
        const vault = vaultWith(deck)
        const result = resolveSetupDeal(vault, ['p1'])

        expect(result.hands[0].cardIds.sort()).toEqual(
            ['denizen.order.hand-a', 'denizen.order.hand-b', 'denizen.order.hand-c'].sort()
        )
        expect(result.visionsDrawn).toBe(0)
    })

    it('R-1.22, R-2.1.6 — a Vision in a hand does advance the marker', () => {
        const deck = [...orderedDeck(10), 'vision.conquest', 'denizen.order.x', 'denizen.order.y']
        const result = resolveSetupDeal(vaultWith(deck), [])
        expect(result.visionsDrawn).toBe(0)

        const deck2 = ['vision.conquest', 'denizen.order.x', 'denizen.order.y', ...orderedDeck(3)]
        const withVision = resolveSetupDeal(vaultWith(deck2), ['p1'])
        expect(withVision.hands[0].cardIds).toContain('vision.conquest')
        expect(withVision.visionsDrawn).toBe(1)
    })

    it('R-9.3 — a short deck deals as many as possible rather than throwing', () => {
        const vault = vaultWith(orderedDeck(4))
        const result = resolveSetupDeal(vault, ['p1', 'p2'])
        expect(result.hands[0].cardIds).toHaveLength(1)
        expect(result.hands[1].cardIds).toHaveLength(0)
        expect(result.worldDeckExhausted).toBe(true)
    })

    it('R-9.3, R-9.4 — a short deck seeds fewer piles, and the counts say so', () => {
        const vault = vaultWith(orderedDeck(2))
        const result = resolveSetupDeal(vault, [])
        expect(result.discardSeedCounts).toEqual({ cradle: 1, provinces: 1, hinterland: 0 })
        expect(vault.discardPiles[Region.Hinterland]).toEqual([])
    })
})

describe('R-1.19–R-1.22 applied to public state', () => {
    function state() {
        return testState([
            testPlayer({ playerId: 'p1' }),
            testPlayer({ playerId: 'p2' })
        ])
    }

    it('R-1.19, R-9.4 — public state learns the counts and nothing else', () => {
        const s = state()
        applySetupDeal(s, {
            discardSeedCounts: { cradle: 1, provinces: 1, hinterland: 1 },
            hands: [{ playerId: 'p1', cardIds: ['denizen.order.a'] }],
            visionsDrawn: 0,
            topCardBackType: CardKind.Denizen,
            worldDeckExhausted: false
        })
        for (const region of Object.values(Region)) {
            expect(s.discardPileCounts[region]).toBe(1)
        }
    })

    it('R-1.20 — hands land on the players who drew them', () => {
        const s = state()
        applySetupDeal(s, {
            discardSeedCounts: { cradle: 1, provinces: 1, hinterland: 1 },
            hands: [
                { playerId: 'p1', cardIds: ['denizen.order.a', 'denizen.order.b'] },
                { playerId: 'p2', cardIds: ['denizen.order.c'] }
            ],
            visionsDrawn: 0,
            worldDeckExhausted: false
        })
        expect(s.getPlayerState('p1').handIds).toEqual(['denizen.order.a', 'denizen.order.b'])
        expect(s.getPlayerState('p2').handIds).toEqual(['denizen.order.c'])
    })

    it('R-1.22, R-2.1.6, R-5.1.1 — the marker moves before play, raising the first Search cost', () => {
        const s = state()
        applySetupDeal(s, {
            discardSeedCounts: { cradle: 1, provinces: 1, hinterland: 1 },
            hands: [],
            visionsDrawn: 2,
            worldDeckExhausted: false
        })
        expect(s.visionsDrawn).toBe(2)
    })

    it('R-9.4 — the top card’s back type is published, the deck’s size is not', () => {
        const s = state()
        applySetupDeal(s, {
            discardSeedCounts: { cradle: 1, provinces: 1, hinterland: 1 },
            hands: [],
            visionsDrawn: 0,
            topCardBackType: CardKind.Vision,
            worldDeckExhausted: false
        })
        expect(s.topCardBackType).toBe(CardKind.Vision)
    })
})

describe('the setup deal is part of the initial state, so it cannot recur', () => {
    // R-1.19 to R-1.22 hold no decision, so the deal happens when the game state is initialized.
    const engine = new OathTestEngine(OathRuntime)

    function buildGame(): Game {
        return testGame(['p1', 'p2'], { status: GameStatus.WaitingToStart })
    }

    it('the initial state is dealt: three cards per player and one per pile', () => {
        const { initialState } = engine.startGame(buildGame(), {
            masterSeed: '0123456789abcdef0123456789abcdef'
        })
        const state = new HydratedOathGameState(initialState)
        expect(state.machineState).toBe(MachineState.Setup)
        for (const player of state.players) {
            expect(player.handIds).toHaveLength(3)
        }
        expect(state.discardPileCounts[Region.Cradle]).toBe(1)
        expect(state.discardPileCounts[Region.Provinces]).toBe(1)
        expect(state.discardPileCounts[Region.Hinterland]).toBe(1)
    })

    it('the dealt cards left the persisted vault, so no undo can redeal them', () => {
        const { initialState } = engine.startGame(buildGame(), {
            masterSeed: '0123456789abcdef0123456789abcdef'
        })
        const state = new HydratedOathGameState(initialState)
        const vault = state.requireVault()
        const inDeck = new Set(vault.worldDeck)
        for (const player of state.players) {
            for (const cardId of player.knownHand()) expect(inDeck.has(cardId)).toBe(false)
        }
        for (const region of Object.values(Region)) {
            expect(vault.discardPiles[region]).toHaveLength(1)
        }
    })
})
