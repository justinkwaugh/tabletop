import { describe, expect, it } from 'vitest'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { commandDiscs } from '$lib/utils/commandTrack.js'
import { inwardsFromTheEdge, onBattlefield } from './battlefield.js'
import { BOARD_HEIGHT, BOARD_WIDTH, LOCALE_GEOMETRY, PRINTED_BARS } from './boardGeometry.js'

describe('the battlefield on the printed board', () => {
    it('holds every locale', () => {
        for (const locale of Object.values(LOCALE_GEOMETRY)) {
            expect(onBattlefield(locale.anchor)).toBe(true)
        }
    })

    it('leaves out the frame, the title and the tracks', () => {
        expect(onBattlefield({ x: 5, y: BOARD_HEIGHT / 2 })).toBe(false)
        expect(onBattlefield({ x: 300, y: 200 })).toBe(false)
        const game = new TestGame()
        game.deployBoth()
        game.arrange((state) => {
            state.commander('murat').commandsThisTurn = 1
            state.commander('langeron').commandsThisTurn = 1
        })
        const onTheTracks = commandDiscs(game.hydrated)
        expect(onTheTracks).toHaveLength(2)
        for (const disc of onTheTracks) {
            expect(onBattlefield(disc)).toBe(false)
        }
        expect(onBattlefield({ x: BOARD_WIDTH - 200, y: BOARD_HEIGHT - 100 })).toBe(false)
    })

    it('has bars printed under those parts, which is why they are cut out', () => {
        const hidden = PRINTED_BARS.filter((bar) => !onBattlefield(bar.centre))
        expect(hidden.length).toBeGreaterThan(0)
        expect(hidden.length).toBeLessThan(PRINTED_BARS.length / 4)
    })
})

describe('the way onto the board from its edge', () => {
    it('is straight in from whichever edge is nearest', () => {
        expect(inwardsFromTheEdge({ x: 40, y: BOARD_HEIGHT / 2 })).toEqual({ x: 1, y: 0 })
        expect(inwardsFromTheEdge({ x: BOARD_WIDTH - 40, y: BOARD_HEIGHT / 2 })).toEqual({
            x: -1,
            y: 0
        })
        expect(inwardsFromTheEdge({ x: BOARD_WIDTH / 3, y: 40 })).toEqual({ x: 0, y: 1 })
        expect(inwardsFromTheEdge({ x: BOARD_WIDTH / 3, y: BOARD_HEIGHT - 40 })).toEqual({
            x: 0,
            y: -1
        })
    })
})
