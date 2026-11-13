// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PouchTurnMs, turnOver } from './turnOver.js'

describe('R-3.1-H1 the pouches turn over at the reveal', () => {
    const node = {} as Element

    it('every pouch turns at once, the same time and no delay, edge on to face up', () => {
        const turn = turnOver(node, { reduced: false })
        expect(turn.duration).toBe(PouchTurnMs)
        expect(turn.delay ?? 0).toBe(0)
        expect(turn.css?.(0, 1)).toContain('rotateY(90deg)')
        expect(turn.css?.(1, 0)).toContain('rotateY(0deg)')
    })

    it('with reduced motion the good is simply there', () => {
        expect(turnOver(node, { reduced: true }).duration).toBe(0)
    })
})
