import { describe, expect, it } from 'vitest'
import {
    CHICAGO_BONUS,
    FIVE_DOLLAR_BONUS,
    GREATER_GERMANY_BONUS,
    INTERCOLONIAL_BONUS,
    PhaseName,
    TORONTO_BONUS,
    TRANSCONTINENTAL_BONUS,
    cityById,
    type HexId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { hexCenter } from '$lib/utils/boardGeometry.js'
import {
    OUTLINE_TOTAL,
    bonusCoins,
    claimedConnection,
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
        const chicago = cityById('city.usa.chicago')
        const coins = bonusCoins('map.usa', CHICAGO, [
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

    it('leaves a connection bonus to its own flight, as the Transcontinental (R-8)', () => {
        const toronto = cityById('city.ca.toronto')
        const coins = bonusCoins('map.ca', toronto.hexId, [
            { bonusId: TORONTO_BONUS.id, amount: TORONTO_BONUS.buildInAmount, cityId: toronto.id },
            { bonusId: INTERCOLONIAL_BONUS.id, amount: INTERCOLONIAL_BONUS.amount }
        ])
        expect(coins.map((coin) => coin.amount)).toEqual([TORONTO_BONUS.buildInAmount])
        expect(coins[0].from).toEqual(hexCenter(toronto.hexId))
    })

    it('joins the link cities only for the transition that claims the connection bonus (R-8)', () => {
        const open = (mapId: 'map.ca' | 'map.de' | 'map.usa') =>
            buildState({ mapId, phase: PhaseName.Build })
        const claimed = (mapId: 'map.ca' | 'map.de') => {
            const state = open(mapId)
            state.connectionClaim = { playerId: 'p1' }
            return state
        }
        expect(claimedConnection(open('map.ca'), claimed('map.ca'))).toEqual(
            INTERCOLONIAL_BONUS.cityIds
        )
        expect(claimedConnection(open('map.de'), claimed('map.de'))).toEqual(
            GREATER_GERMANY_BONUS.cityIds
        )
        expect(claimedConnection(open('map.ca'), open('map.ca'))).toBeUndefined()
        expect(claimedConnection(claimed('map.ca'), claimed('map.ca'))).toBeUndefined()
        expect(claimedConnection(claimed('map.ca'), open('map.ca'))).toBeUndefined()
        expect(claimedConnection(open('map.usa'), open('map.usa'))).toBeUndefined()
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
