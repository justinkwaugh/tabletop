import { beforeAll, describe, expect, it } from 'vitest'
import { docTableRows, readDoc } from '../testing/docs.js'
import {
    DisloyaltyDawns,
    EpicVoyageTrack,
    EpochTrack,
    MilitaryServiceTrack,
    RegionTileChart,
    ScoreTrack
} from './tracks.js'

let components = ''

beforeAll(async () => {
    components = await readDoc('components.md')
})

function ids(heading: string): string[] {
    return docTableRows(components, heading).map((row) => row['Id'])
}

describe('R-3.7.5, R-6.2 the epic voyage', () => {
    it('has every row of components.md, 7 spaces in order', () => {
        expect(EpicVoyageTrack.map((space) => space.id)).toEqual(ids('### Epic voyage (7)'))
        expect(EpicVoyageTrack.map((space) => space.space)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('R-3.7.5 draws 2 writs and keeps 1 on spaces 2, 4 and 6', () => {
        const withWrits = EpicVoyageTrack.filter((space) => space.writDraw !== null)
        expect(withWrits.map((space) => space.space)).toEqual([2, 4, 6])
        for (const { writDraw } of withWrits) {
            expect(writDraw).toEqual({ draw: 2, keep: 1 })
        }
    })

    it('R-6.2 scores by section: 1-2 3/5, 3-4 7/9, 5-6 11/13, 7 the monastery 17', () => {
        expect(EpicVoyageTrack.map(({ space, section, vp }) => [space, section, vp])).toEqual([
            [1, 1, { lower: 3, higher: 5 }],
            [2, 1, { lower: 3, higher: 5 }],
            [3, 2, { lower: 7, higher: 9 }],
            [4, 2, { lower: 7, higher: 9 }],
            [5, 3, { lower: 11, higher: 13 }],
            [6, 3, { lower: 11, higher: 13 }],
            [7, 4, { lower: 17, higher: 17 }]
        ])
    })

    it('R-6.2 ends at the monastery', () => {
        expect(
            EpicVoyageTrack.filter((space) => space.monastery).map((space) => space.space)
        ).toEqual([7])
    })
})

describe('R-4.9.2 the military service track', () => {
    it('has every row of components.md: spaces at -3, -4, -5 due at II, IV, V', () => {
        expect(MilitaryServiceTrack.map((space) => space.id)).toEqual(
            ids('### Military service (3)')
        )
        expect(
            MilitaryServiceTrack.map(({ space, penalty, dueFrom }) => [space, penalty, dueFrom])
        ).toEqual([
            [1, -3, 2],
            [2, -4, 4],
            [3, -5, 5]
        ])
    })

    it('a vassal who never serves loses 3, then 7, then 12: 22 in all', () => {
        const losses = DisloyaltyDawns.map((dawn) =>
            MilitaryServiceTrack.filter((space) => space.dueFrom <= dawn).reduce(
                (sum, space) => sum + space.penalty,
                0
            )
        )
        expect(losses).toEqual([-3, -7, -12])
        expect(losses.reduce((sum, loss) => sum + loss, 0)).toBe(-22)
    })
})

describe('R-4.11, R-4.12 the five sunrays', () => {
    it('has every row of components.md, I to V', () => {
        expect(EpochTrack.map((ray) => ray.id)).toEqual(ids('### Epoch track (5 sunrays)'))
        expect(EpochTrack.map((ray) => [ray.epoch, ray.ray])).toEqual([
            [1, 'I'],
            [2, 'II'],
            [3, 'III'],
            [4, 'IV'],
            [5, 'V']
        ])
    })

    it('R-4.12.4 each dawn replenishes the map at S (II), E (III), W (IV), after N at setup (R-1.4.6)', () => {
        expect(EpochTrack.map((ray) => ray.mapDirection)).toEqual(['N', 'S', 'E', 'W', null])
    })

    it('R-4.12.2 the dawns of II, IV and V bring disloyalty', () => {
        expect(EpochTrack.filter((ray) => ray.disloyalty).map((ray) => ray.epoch)).toEqual([
            2, 4, 5
        ])
        expect(DisloyaltyDawns).toEqual([2, 4, 5])
    })

    it('R-4.12.5 only the dawn of III refills the guilds', () => {
        expect(EpochTrack.filter((ray) => ray.guildRefill).map((ray) => ray.epoch)).toEqual([3])
    })

    it('R-4.11.2 advances on 4 epoch II tiles, 3 epoch III, 2 epoch IV, or 1 empty stack', () => {
        expect(EpochTrack.map((ray) => ray.advanceWhen)).toEqual([
            { kind: 'start' },
            { kind: 'stack-tops', tileEpoch: 2, count: 4 },
            { kind: 'stack-tops', tileEpoch: 3, count: 3 },
            { kind: 'stack-tops', tileEpoch: 4, count: 2 },
            { kind: 'empty-stacks', count: 1 }
        ])
    })
})

describe('R-4.3.2 the region tile chart', () => {
    it("has every row of components.md, with each legal epoch's printed vp", () => {
        expect(RegionTileChart.map((row) => row.id)).toEqual(ids('### Region tile chart (5)'))
        expect(RegionTileChart.map(({ tileEpoch, vp }) => [tileEpoch, vp])).toEqual([
            [1, { farm: 2, town: 3, feudum: 4 }],
            [2, { farm: 3, town: 4, feudum: 5 }],
            [3, { farm: 4, town: 5, feudum: 6 }],
            [4, { farm: 5, town: 6, feudum: 7 }],
            [5, null]
        ])
    })
})

describe('R-1.2.5 the score track', () => {
    it('runs from 0 to 149, 150 spaces labelled every 5', () => {
        expect(ids('### Scoring track (1)')).toEqual([ScoreTrack.id])
        expect(ScoreTrack).toEqual({
            id: 'track.score',
            lowest: 0,
            highest: 149,
            spaces: 150,
            labelEvery: 5
        })
    })
})
