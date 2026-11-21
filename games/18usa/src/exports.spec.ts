import { describe, expect, it } from 'vitest'
import { edit, kit } from '../test/kit.js'
import { passOpening } from '../test/positions.js'
import { passUntil } from '../test/passTurns.js'
import { EighteenUSAOperatingRules, EighteenUSATrainDepot } from './index.js'

const KansasCity = { locationId: 'E15', nodeId: 'city' }

function operating(config?: Record<string, boolean>) {
    const game = kit.table(4, 9, config)
    passOpening(game)
    game.act('AuctionCompany', { companyId: 'ATSF', amount: 100, home: KansasCity })
    passUntil(game, (state) => !state.companyAuction)
    passUntil(game, (state) => state.machineState !== 'StockRound')
    return game
}

type Game = ReturnType<typeof operating>

const remaining = (game: Game, definitionId: string) =>
    EighteenUSATrainDepot.remaining(game.state.trainInventory, definitionId)

/** The trains exported as the set's round ends. */
function exportsAfter(game: Game, set: number, roundNumber: number): string[] {
    edit(game, (state) => {
        if (state.operatingSet) Object.assign(state.operatingSet, { number: set, roundNumber })
    })
    return EighteenUSAOperatingRules.trainsToExport?.(game.state) ?? []
}

describe('train exports (§12.10)', () => {
    it('exports every 2 and 2+ in the first set and begins phase 3 as it ends', () => {
        const game = operating()
        passUntil(game, (state) => state.machineState === 'StockRound')
        expect(remaining(game, '2')).toBe(0)
        expect(remaining(game, '2+')).toBe(0)
        expect(remaining(game, '3')).toBe(12)
        expect(game.state.phaseId).toBe('3')
    })

    it('follows the schedule: all 2s, all 2+s, nothing, all 3s, then the next train', () => {
        const game = operating()
        expect(exportsAfter(game, 1, 1)).toHaveLength(40)
        expect(new Set(exportsAfter(game, 1, 1))).toEqual(new Set(['2']))
        expect(exportsAfter(game, 1, 2)).toEqual(['2+', '2+', '2+', '2+'])
        expect(exportsAfter(game, 2, 1)).toEqual([])
        expect(exportsAfter(game, 2, 2)).toHaveLength(12)
        expect(exportsAfter(game, 3, 1)).toEqual(['2'])
    })

    it('exports the next train each round with 1817’s trains, the 2s together', () => {
        const game = operating({ seventeenTrains: true })
        passUntil(game, (state) => state.machineState === 'StockRound')
        expect(remaining(game, '2')).toBe(0)
        expect(remaining(game, '2+')).toBe(3)
        expect(game.state.phaseId).toBe('2')
    })
})
