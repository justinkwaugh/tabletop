import { describe, expect, it } from 'vitest'
import {
    CHICAGO_BONUS,
    FIVE_DOLLAR_BONUS,
    PhaseName,
    TRANSCONTINENTAL_BONUS,
    usaCity,
    type HexId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { hexCenter } from '$lib/utils/boardGeometry.js'
import {
    OUTLINE_TOTAL,
    bonusCoins,
    claimedLine,
    moneyAfterEach,
    outlineStep,
    placementChanges,
    shareChanges
} from './flightPlan.js'

const RED: RailroadId = 'railroad.red'
const CHICAGO: HexId = 'hex.usa.5-43'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'

describe('the flight plan', () => {
    it('finds the locomotive a placement adds, and the one an Undo takes away (R-3.2, R-4.2)', () => {
        const before = buildState({ phase: PhaseName.Build, track: { [NEXT_TO_CHICAGO]: [RED] } })
        const after = buildState({
            phase: PhaseName.Build,
            track: { [NEXT_TO_CHICAGO]: [RED], [CHICAGO]: [RED] }
        })
        const forward = placementChanges(before, after)
        expect(forward.arriving.map((piece) => piece.hexId)).toEqual([CHICAGO])
        expect(forward.leaving).toEqual([])
        const back = placementChanges(after, before)
        expect(back.arriving).toEqual([])
        expect(back.leaving.map((piece) => piece.hexId)).toEqual([CHICAGO])
    })

    it('finds the share a seat takes, with its count after it (R-3.1)', () => {
        const before = buildState({ phase: PhaseName.TakeShare })
        const after = buildState({ phase: PhaseName.TakeShare, shares: { p2: { [RED]: 1 } } })
        expect(shareChanges(before, after)).toEqual([
            { playerId: 'p2', railroadId: RED, shares: 1 }
        ])
        expect(shareChanges(after, before)).toEqual([])
    })

    it('flies the Chicago and $5 coins from their city and leaves the Transcontinental to its own flight (R-3.2.5, R-4.3)', () => {
        const chicago = usaCity('city.usa.chicago')
        const coins = bonusCoins(CHICAGO, [
            { bonusId: CHICAGO_BONUS.id, amount: CHICAGO_BONUS.amount, cityId: chicago.id },
            { bonusId: FIVE_DOLLAR_BONUS.id, amount: FIVE_DOLLAR_BONUS.amount },
            { bonusId: TRANSCONTINENTAL_BONUS.id, amount: 8 }
        ])
        expect(coins.map((coin) => coin.amount)).toEqual([
            CHICAGO_BONUS.amount,
            FIVE_DOLLAR_BONUS.amount
        ])
        expect(coins[0].from).toEqual(hexCenter(chicago.hexId))
        expect(coins[1].from).toEqual(hexCenter(CHICAGO))
        expect(new Set(coins.map((coin) => coin.key)).size).toBe(2)
        expect(moneyAfterEach(10, coins)).toEqual([
            10 + CHICAGO_BONUS.amount,
            10 + CHICAGO_BONUS.amount + FIVE_DOLLAR_BONUS.amount
        ])
    })

    it('draws the line only for the transition that claims the Transcontinental (R-4.3.3)', () => {
        const unclaimed = buildState({ phase: PhaseName.Build })
        const claimed = buildState({ phase: PhaseName.Build })
        claimed.transcontinental = { playerId: 'p1', amount: 8 }
        expect(claimedLine(unclaimed, unclaimed)).toBeUndefined()
        expect(claimedLine(claimed, claimed)).toBeUndefined()
        expect(claimedLine(claimed, unclaimed)).toBeUndefined()
    })

    it('outlines any line within 900 ms', () => {
        for (const hexCount of [0, 1, 7, 30, 60]) {
            expect(outlineStep(hexCount) * hexCount).toBeLessThanOrEqual(OUTLINE_TOTAL + 1e-9)
        }
        expect(outlineStep(4)).toBeGreaterThan(0)
    })
})
