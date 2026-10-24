import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { DIRECTIVES, directiveDefinition } from '@tabletop/stellar-horizons-2'
import { directiveText, fulfilledIn } from './directives.js'

describe('directive text', () => {
    it('reads as the printed markers do', () => {
        const text = (directiveId: string) =>
            directiveText(directiveDefinition(directiveId).condition)
        expect(text('a3')).toBe('Resolve a combat anomaly of 9+ difficulty')
        expect(text('c5')).toBe(
            'Blockade a base of the Player with the most settlements (other than you)'
        )
        expect(text('p3')).toBe('Earn 2 tech markers using research ships')
        expect(text('p6')).toBe('Earn $12B cash from base production')
        expect(text('t1')).toBe('Sell 2 trade goods on Earth')
        expect(text('t5')).toBe('Sell 1 Fine Art on Earth')
        expect(text('t8')).toBe("Sell 2 trade goods at Barnard's Star")
        expect(text('tf3')).toBe('Terraform a world into L, O or M-class')
        expect(DIRECTIVES.every((directive) => directiveText(directive.condition).length > 0)).toBe(
            true
        )
    })

    it('finds the directives an action fulfilled in its metadata’s directives', () => {
        const fulfilled = { playerId: 'p0', directiveId: 'p4', year: 2110 }
        const action = (metadata: unknown) =>
            ({
                id: 'a',
                gameId: 'g',
                source: ActionSource.System,
                type: 'ProduceAtBases',
                metadata
            }) as GameAction
        expect(fulfilledIn(action({ directives: [fulfilled] }))).toEqual([fulfilled])
        expect(fulfilledIn(action({ directive: fulfilled }))).toEqual([])
        expect(fulfilledIn(action({ results: [] }))).toEqual([])
        expect(fulfilledIn(action(undefined))).toEqual([])
    })
})
