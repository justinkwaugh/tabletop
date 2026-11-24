import { describe, expect, it } from 'vitest'
import { Scenario, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    infantry,
    passTurns,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import { outlinesOverlap } from './convexOutline.js'
import { gunTags, type GunTag } from './gunTags.js'
import { cornersOf } from './orientedBox.js'

const FLAT = { from: 72, to: 74 }
const BACK = { from: 74, to: 72 }

const FRENCH_GUNS: PiecePlacement = { id: 'F25', side: Side.French, face: artillery(), locale: 72 }
const ALLIED_FOOT: PiecePlacement = { id: 'A26', side: Side.Allied, face: infantry(2), locale: 74 }

function underway(): TestGame {
    const game = new TestGame({ scenario: Scenario.December2 })
    game.deployBoth()
    arrangeBattlefield(game, [FRENCH_GUNS, ALLIED_FOOT])
    return game
}

function approachOf(game: TestGame, between: { from: number; to: number }): number {
    return game.hydrated.map.approachBetween(between.from, between.to).id
}

function fire(game: TestGame, side: Side, approach: number, roundsAgo = 0) {
    game.arrange((state) => {
        const army = state.playerOf(side)
        army.artilleryFire = { ...army.artilleryFire, [String(approach)]: state.round - roundsAgo }
    })
}

function labels(game: TestGame) {
    return gunTags(game.hydrated, 0, []).map(({ approach, text }) => ({ approach, text }))
}

function apart(a: GunTag, b: GunTag): number {
    const between = Math.hypot(a.box.centre.x - b.box.centre.x, a.box.centre.y - b.box.centre.y)
    return between - a.box.halfLength - b.box.halfLength
}

describe('the tags on approaches artillery fired across', () => {
    it('say the hour two rounds on, from the round the guns fire until then', () => {
        for (const [roundsAgo, text] of [
            [0, '9AM'],
            [1, '8AM']
        ] as const) {
            const game = underway()
            const approach = approachOf(game, FLAT)
            fire(game, Side.French, approach, roundsAgo)
            expect(labels(game)).toEqual([{ approach, text }])
        }
        const game = underway()
        fire(game, Side.French, approachOf(game, FLAT), 2)
        expect(labels(game)).toEqual([])
    })

    it('name no hour when the game ends before the guns may lead again', () => {
        const game = underway()
        passTurns(game, 2 * 9)
        fire(game, Side.French, approachOf(game, FLAT))
        expect(labels(game)).toEqual([{ approach: expect.any(Number), text: 'Fired' }])
    })

    it('lie in the middle of the bar when alone on it', () => {
        const game = underway()
        const flat = approachOf(game, FLAT)
        fire(game, Side.French, flat)
        const [tag] = gunTags(game.hydrated, 0, [])
        const bar = APPROACH_GEOMETRY[Math.min(flat, approachOf(game, BACK))]
        expect(tag.box.centre.x).toBeCloseTo(bar.centre.x)
        expect(tag.box.centre.y).toBeCloseTo(bar.centre.y)
    })

    it('lie side by side, a gap between, when both armies fired across one bar', () => {
        const game = underway()
        fire(game, Side.French, approachOf(game, FLAT))
        fire(game, Side.Allied, approachOf(game, BACK))
        const [a, b] = gunTags(game.hydrated, 0, [])
        expect(apart(a, b)).toBeCloseTo(12)
    })

    it('leave the bar while the army that fired holds the locale it fired from no longer', () => {
        const game = underway()
        const flat = approachOf(game, FLAT)
        fire(game, Side.French, flat, 1)
        arrangeBattlefield(game, [ALLIED_FOOT])
        expect(labels(game)).toEqual([])
        arrangeBattlefield(game, [{ ...ALLIED_FOOT, locale: FLAT.from }])
        expect(labels(game)).toEqual([])
        fire(game, Side.Allied, flat)
        expect(gunTags(game.hydrated, 0, []).map(({ playerId }) => playerId)).toEqual([
            game.playerOf(Side.Allied)
        ])
    })

    it('come back when the army retakes the locale before its guns may lead again', () => {
        const game = underway()
        const flat = approachOf(game, FLAT)
        fire(game, Side.French, flat, 1)
        arrangeBattlefield(game, [ALLIED_FOOT])
        arrangeBattlefield(game, [{ ...FRENCH_GUNS, id: 'F01', face: infantry(3) }, ALLIED_FOOT])
        expect(labels(game)).toEqual([{ approach: flat, text: '8AM' }])
    })

    it('slide along the bar out from under an arrow', () => {
        const game = underway()
        const flat = approachOf(game, FLAT)
        fire(game, Side.French, flat)
        const { centre } = APPROACH_GEOMETRY[flat]
        const arrow = [
            { x: centre.x - 15, y: centre.y - 40 },
            { x: centre.x + 15, y: centre.y - 40 },
            { x: centre.x + 15, y: centre.y + 40 },
            { x: centre.x - 15, y: centre.y + 40 }
        ]
        const [tag] = gunTags(game.hydrated, 0, [arrow])
        expect(outlinesOverlap(cornersOf(tag.box), arrow)).toBe(false)
        const [unmoved] = gunTags(game.hydrated, 0, [])
        expect(outlinesOverlap(cornersOf(unmoved.box), arrow)).toBe(true)
    })
})
