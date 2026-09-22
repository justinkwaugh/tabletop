import { describe, expect, it } from 'vitest'
import { operatingOrderMoves } from './operatingOrderMoves.js'

describe('operating order history moves', () => {
    it('crops a later move to its old position, intervening companies and new position', () => {
        expect(
            operatingOrderMoves({
                before: ['A', 'B', 'C', 'D', 'E'],
                after: ['A', 'C', 'D', 'B', 'E']
            })
        ).toEqual([{ companies: ['B', 'C', 'D', 'B'], from: 0, to: 3 }])
    })
    it('points an earlier move back across only the affected companies', () => {
        expect(
            operatingOrderMoves({
                before: ['A', 'B', 'C', 'D', 'E'],
                after: ['A', 'D', 'B', 'C', 'E']
            })
        ).toEqual([{ companies: ['D', 'B', 'C', 'D'], from: 3, to: 0 }])
    })
    it('shows the sold company as the mover in an adjacent swap', () => {
        expect(
            operatingOrderMoves({ before: ['A', 'B'], after: ['B', 'A'], movingCompanyId: 'B' })
        ).toEqual([{ companies: ['B', 'A', 'B'], from: 2, to: 0 }])
    })
    it('uses the complete resulting order for new membership', () => {
        expect(operatingOrderMoves({ before: ['A'], after: ['A', 'B'] })).toEqual([])
    })
    it('reconstructs every permutation from its successive move diagrams', () => {
        function permutations(items: string[]): string[][] {
            return items.length
                ? items.flatMap((id) =>
                      permutations(items.filter((other) => other !== id)).map((rest) => [
                          id,
                          ...rest
                      ])
                  )
                : [[]]
        }
        const before = ['A', 'B', 'C', 'D', 'E']
        for (const after of permutations(before)) {
            const current = [...before]
            for (const move of operatingOrderMoves({ before, after })) {
                const id = move.companies[move.from]
                const between = move.companies.slice(1, -1)
                current.splice(current.indexOf(id), 1)
                const anchor = move.to > move.from ? between.at(-1)! : between[0]
                current.splice(current.indexOf(anchor) + (move.to > move.from ? 1 : 0), 0, id)
            }
            expect(current).toEqual(after)
        }
    })
})
