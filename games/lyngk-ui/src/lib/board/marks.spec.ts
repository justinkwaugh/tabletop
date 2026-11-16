import { describe, expect, it } from 'vitest'
import { HydratedLyngkBoard } from '@tabletop/lyngk'
import { bolts, faceCenter } from './marks.js'
import { PIECE_RADIUS, VIEW } from './geometry.js'

const board = new HydratedLyngkBoard({
    stacks: [
        { coords: { q: 0, r: 0 }, pieces: [0, 8, 16] },
        { coords: { q: 0, r: 2 }, pieces: [1] }
    ]
})

describe('marks', () => {
    it('puts a mark on the top face, higher on a taller stack', () => {
        const tall = faceCenter(VIEW, board, { q: 0, r: 0 }, PIECE_RADIUS)
        const ground = VIEW.center({ q: 0, r: 0 })
        expect(tall.x).toBe(ground.x)
        expect(tall.y).toBeLessThan(ground.y)
    })

    it('gives each LYNGK connection its own flickering bolt', () => {
        const drawn = bolts(
            VIEW,
            board,
            [
                [
                    { q: 0, r: 0 },
                    { q: 0, r: 2 }
                ]
            ],
            PIECE_RADIUS
        )
        expect(drawn).toHaveLength(1)
        expect(new Set(drawn[0].shapes).size).toBe(drawn[0].shapes.length)
    })
})
