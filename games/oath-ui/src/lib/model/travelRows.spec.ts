import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Region } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { travelRows } from './travelRows.js'

const TOLL_ROADS = 'denizen.order.toll-roads'
const WAY_STATION = 'denizen.nomad.way-station'

/** `foe` is on turn at the Plains; `ruler` rules the Plains and the River, which hold the tolls. */
function board(foe: Record<string, unknown> = {}, denizens: Record<string, string[]> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'ruler', color: Color.Red, siteId: 'c1', favor: 3, warbandsOnBoard: { ruler: 2 } }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, supply: 3, ...foe })
        ],
        {
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizens },
            warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
        }
    )
    openTurn(s, 'foe')
    return s
}

const read = (rows: ReturnType<typeof travelRows>) =>
    rows.map((row) => [row.slotId, row.region, row.ways.map((w) => [w.cost, w.tolls, w.favorTo])])

describe('the destinations a Travel can reach (R-5.6)', () => {
    it('lists each affordable site in the board order with its Supply, leaving out what costs too much', () => {
        const rows = read(travelRows(board(), 'foe', []))
        expect(rows.slice(0, 2)).toEqual([
            ['c2', Region.Cradle, [[1, [], []]]],
            ['p1', Region.Provinces, [[2, [], []]]]
        ])
        expect(rows.map(([, region]) => region)).not.toContain(Region.Hinterland)
    })

    it('names who takes a toll’s favor (R-7.1.4)', () => {
        const rows = travelRows(board({}, { c1: [TOLL_ROADS] }), 'foe', [])
        expect(read(rows)[0]).toEqual(['c2', Region.Cradle, [[1, [TOLL_ROADS], ['ruler']]]])
    })

    it('offers each way to pay as its own choice: Way Station’s favor for no Supply', () => {
        const rows = travelRows(board({}, { c2: [WAY_STATION] }), 'foe', [])
        expect(read(rows)[0]).toEqual(['c2', Region.Cradle, [[1, [], []], [0, [WAY_STATION], ['ruler']]]])
    })

    it('lists nothing the player cannot afford', () => {
        expect(travelRows(board({ supply: 0 }), 'foe', [])).toEqual([])
    })
})
