import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { ProvisionalCards } from '../data/provisional.cards.js'
import { Charters, Mandates, type CharterId, type KingdomCharter } from '../data/writs.js'
import { holdSealedCharter } from '../testing/atWill.js'
import { meetCharter, ruleSpaces, setBarrel } from '../testing/charters.js'
import {
    addPawn,
    answer,
    commit,
    conquer,
    giveMonster,
    holdWrit,
    tableAtCombat
} from '../testing/combat.js'
import { setUp } from '../testing/improving.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { placeMarker } from '../model/locationControl.js'
import { conservationBreaks } from '../model/conservation.js'
import { canonicalOf } from '../testing/state.js'
import { writRegistry, type CharterRegistration } from './writRegistry.js'

const Northern: CharterId = 'writ.charter.northern-kingdom'
const Central: CharterId = 'writ.charter.central-kingdom'
const Eastern: CharterId = 'writ.charter.eastern-kingdom'
const Southern: CharterId = 'writ.charter.southern-kingdom'
const Isolated: CharterId = 'writ.charter.isolated-kingdom'
const Barrel: CharterId = 'writ.charter.sulfur-barrel'
const Monster: CharterId = 'writ.charter.monster-defeat'

function isKingdom(charter: (typeof Charters)[number]): charter is KingdomCharter {
    return charter.kind === 'kingdom'
}

const Kingdoms = Charters.filter(isKingdom)
const SharedSpace: SpaceId = 'space.badlands.3'

/** A table past setup: the seat it asks, one other, and a state to edit by hand. */
function seated() {
    const table = tableAtPlayingCards()
    const playerId = table.asked
    const [otherId] = table.order.filter((seat) => seat !== playerId)
    return { state: table.hydrated(), playerId, otherId }
}

function spacesOf(writId: CharterId): readonly SpaceId[] {
    const row = Kingdoms.find(({ id }) => id === writId)
    if (!row) {
        throw new Error(`${writId} is no kingdom charter`)
    }
    return row.spaces
}

describe('the charter registrations (R-4.4.3)', () => {
    const rows = writRegistry
        .registrations()
        .filter((row): row is CharterRegistration => row.timing === 'end-scoring')

    it('R-4.4.3 all eight score at the end, each from its own row', () => {
        expect(rows.map(({ writId }) => writId)).toEqual(Charters.map(({ id }) => id))
    })

    it.each(Charters)('R-4.4.3 $id carries its printed text', ({ id, text }) => {
        expect(rows.find(({ writId }) => writId === id)?.printedText).toBe(text)
    })

    it('R-4.4.3 a charter has no at-will or attack effect', () => {
        for (const { id } of Charters) {
            expect(writRegistry.mandateAlternatives(id)).toEqual([])
            expect(writRegistry.weaponBonus(id, 'writ.mandate.1.alt.1')).toBeUndefined()
        }
    })
})

describe('kingdom charters: R-4.4.3 ruled spaces among the marked ones', () => {
    describe.each(Kingdoms.filter(({ kingdom }) => kingdom !== 'isolated'))(
        '$id',
        ({ id, spaces }) => {
            it.each([
                { ruled: 0, vp: 0 },
                { ruled: 1, vp: 3 },
                { ruled: 2, vp: 5 },
                { ruled: 3, vp: 7 },
                { ruled: 4, vp: 9 }
            ])('R-4.4.3 $ruled ruled: $vp vp', ({ ruled, vp }) => {
                const { state, playerId } = seated()
                ruleSpaces(state, playerId, spaces.slice(0, ruled))
                expect(writRegistry.charterScore(id, state, playerId)).toBe(vp)
            })
        }
    )

    it.each([
        { ruled: 0, vp: 0 },
        { ruled: 1, vp: 5 },
        { ruled: 2, vp: 11 },
        { ruled: 3, vp: 17 }
    ])('R-4.4.3 the Isolated Kingdom, $ruled ruled: $vp vp', ({ ruled, vp }) => {
        const { state, playerId } = seated()
        ruleSpaces(state, playerId, spacesOf(Isolated).slice(0, ruled))
        expect(writRegistry.charterScore(Isolated, state, playerId)).toBe(vp)
    })

    it('R-4.4.3 a space off the card counts nothing', () => {
        const { state, playerId } = seated()
        ruleSpaces(state, playerId, ['space.island.1', 'space.island.2'])
        expect(writRegistry.charterScore(Isolated, state, playerId)).toBe(0)
        expect(writRegistry.charterScore(Central, state, playerId)).toBe(0)
    })

    it('R-4.4.3 one space counts for every charter marking it', () => {
        const { state, playerId } = seated()
        ruleSpaces(state, playerId, [SharedSpace])
        expect(writRegistry.charterScore(Eastern, state, playerId)).toBe(3)
        expect(writRegistry.charterScore(Southern, state, playerId)).toBe(3)
        expect(writRegistry.charterScore(Isolated, state, playerId)).toBe(5)
        expect(writRegistry.charterScore(Central, state, playerId)).toBe(0)
    })

    it('R-4.4.3 only the ruler counts: not a serf, and a subject adds no second space', () => {
        const { state, playerId, otherId } = seated()
        ruleSpaces(state, otherId, [SharedSpace])
        placeMarker(state, playerId, SharedSpace)
        expect(state.spaces[SharedSpace].serf?.playerId).toBe(playerId)
        expect(writRegistry.charterScore(Isolated, state, playerId)).toBe(0)
        expect(writRegistry.charterScore(Isolated, state, otherId)).toBe(5)

        placeMarker(state, otherId, 'space.sea.3')
        placeMarker(state, otherId, 'space.sea.3')
        expect(state.spaces['space.sea.3'].ruler).toMatchObject({ subject: true })
        expect(writRegistry.charterScore(Isolated, state, otherId)).toBe(11)
    })

    it('R-4.1.2 a space lost to another seat stops counting for the first', () => {
        const { state, playerId, otherId } = seated()
        ruleSpaces(state, playerId, [SharedSpace])
        placeMarker(state, otherId, SharedSpace)
        placeMarker(state, otherId, SharedSpace)
        expect(state.spaces[SharedSpace].ruler?.playerId).toBe(otherId)
        expect(writRegistry.charterScore(Isolated, state, playerId)).toBe(0)
        expect(writRegistry.charterScore(Isolated, state, otherId)).toBe(5)
    })

    it.each([
        { writId: Eastern, ruled: 5 },
        { writId: Eastern, ruled: 7 },
        { writId: Central, ruled: 8 },
        { writId: Southern, ruled: 9 }
    ])('R-6.2-H1 $writId with $ruled ruled scores the top value, 9', ({ writId, ruled }) => {
        const { state, playerId } = seated()
        const spaces = spacesOf(writId)
        expect(spaces.length).toBeGreaterThanOrEqual(ruled)
        ruleSpaces(state, playerId, spaces.slice(0, ruled))
        expect(writRegistry.charterScore(writId, state, playerId)).toBe(9)
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })
})

describe('R-4.4.3 the Northern Kingdom, data blocked', () => {
    const entry = ProvisionalCards.northernKingdomSpaces

    it('reads its two unsure dots from the provisional registry', () => {
        expect(entry.dataBlockedIn).toContain('charters.spec.ts')
        expect(entry.componentId).toBe(Northern)
        expect(spacesOf(Northern).slice(-2)).toEqual(entry.placeholder)
    })

    it('R-4.4.3 counts those dots like any other marked space, while they stand', () => {
        const { state, playerId } = seated()
        ruleSpaces(state, playerId, entry.placeholder)
        expect(writRegistry.charterScore(Northern, state, playerId)).toBe(5)
    })
})

describe('the sulfur barrel: R-4.4.3, R-6.2', () => {
    it.each([
        { sulfur: 0, vp: 0 },
        { sulfur: 1, vp: 0 },
        { sulfur: 2, vp: 5 },
        { sulfur: 3, vp: 7 }
    ])('R-6.2 $sulfur in the barrel: $vp vp', ({ sulfur, vp }) => {
        const { state, playerId } = seated()
        setBarrel(state, playerId, sulfur)
        expect(writRegistry.charterScore(Barrel, state, playerId)).toBe(vp)
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })

    it('R-6.2 sulfur in the supply is not in the barrel', () => {
        const { state, playerId } = seated()
        const player = state.getPlayerState(playerId)
        state.supply.haversack.sulfur -= 3
        player.goods.sulfur += 3
        expect(writRegistry.charterScore(Barrel, state, playerId)).toBe(0)
    })

    it('R-6.2-H2 sulfur standing on a wine-fed pawn is not in the barrel', () => {
        const { state, playerId } = seated()
        setBarrel(state, playerId, 2)
        const player = state.getPlayerState(playerId)
        player.barrel -= 1
        player.pawns[0].wine = 'fed'
        expect(player.barrel).toBe(1)
        expect(writRegistry.charterScore(Barrel, state, playerId)).toBe(0)
    })
})

describe('the monster defeat: R-4.4.3, R-6.2', () => {
    it('R-6.2 without defeatedMonster: nothing', () => {
        const { state, playerId } = seated()
        expect(writRegistry.charterScore(Monster, state, playerId)).toBe(0)
    })

    it('R-6.2 with defeatedMonster: 7 vp', () => {
        const { state, playerId } = seated()
        state.getPlayerState(playerId).defeatedMonster = true
        expect(writRegistry.charterScore(Monster, state, playerId)).toBe(7)
    })

    it('R-4.8.3, R-6.2 a monster beaten in play earns it, for the attacker alone', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            addPawn(state, attackerId)
            addPawn(state, attackerId)
            giveMonster(state, defenderId, 'behemoth')
            state.getPlayerState(defenderId).pawns[0].spaceId = 'space.forest.1'
            holdSealedCharter(state, attackerId, Monster)
        })
        conquer(combat, { kind: 'monster', monsterId: 'behemoth' })
        answer(combat)
        commit(combat)

        const state = table.hydrated()
        expect(writRegistry.sealedCharterScores(state, attackerId)).toEqual([
            { writId: Monster, vp: 7 }
        ])
        expect(writRegistry.charterScore(Monster, state, defenderId)).toBe(0)
    })
})

describe('R-6.2 only sealed charters score', () => {
    it.each(Charters)('R-6.2 $id held unsealed scores nothing, however well met', ({ id }) => {
        const { state, playerId } = seated()
        holdWrit(state, playerId, id)
        meetCharter(state, playerId, id)
        expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([])
    })

    it.each(Mandates)('R-6.2 $id scores nothing', ({ id }) => {
        const { state, playerId } = seated()
        holdWrit(state, playerId, id)
        expect(writRegistry.charterScore(id, state, playerId)).toBeUndefined()
        expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([])
    })

    it('R-6.2 a seat with no sealed charter has no row', () => {
        const { state, playerId } = seated()
        expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([])
    })

    it('R-6.2 a sealed charter not met keeps its row, at 0 vp', () => {
        const { state, playerId } = seated()
        holdSealedCharter(state, playerId, Barrel)
        expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([
            { writId: Barrel, vp: 0 }
        ])
    })

    it('R-6.2 each seat scores its own sealed charters by its own holdings', () => {
        const { state, playerId, otherId } = seated()
        holdSealedCharter(state, playerId, Barrel)
        holdSealedCharter(state, playerId, Isolated)
        holdSealedCharter(state, otherId, Monster)
        ruleSpaces(state, playerId, [SharedSpace])
        setBarrel(state, otherId, 3)
        expect(writRegistry.sealedCharterScores(state, playerId)).toEqual([
            { writId: Barrel, vp: 0 },
            { writId: Isolated, vp: 5 }
        ])
        expect(writRegistry.sealedCharterScores(state, otherId)).toEqual([
            { writId: Monster, vp: 0 }
        ])
    })

    it('R-6.2 scoring changes nothing', () => {
        const { state, playerId } = seated()
        holdSealedCharter(state, playerId, Isolated)
        ruleSpaces(state, playerId, [SharedSpace])
        const before = state.dehydrate()
        writRegistry.sealedCharterScores(state, playerId)
        expect(state.dehydrate()).toEqual(before)
    })
})
