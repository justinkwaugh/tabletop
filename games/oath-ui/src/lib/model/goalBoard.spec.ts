import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS, OathType, PlayerStatus } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { TallyUnit, goalBoard, tallyLabel } from './goalBoard.js'

/** R-2.11, R-3 — the rail's goals: who holds the title, the counts behind it, each Vision and the Successor. */
function table(oathType: OathType, overrides: { usurper?: boolean; holder?: string; citizen?: boolean } = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', revealedVisionId: 'vision.conquest' }),
            testPlayer({ playerId: 'ann', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1' }),
            testPlayer({
                playerId: 'bo',
                color: Color.Yellow,
                siteId: 'h1',
                ...(overrides.citizen
                    ? { status: PlayerStatus.Citizen, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 0, bo: 14 } }
                    : {})
            })
        ],
        {
            chancellorPlayerId: 'ann',
            oathType,
            oathkeeperPlayerId: overrides.holder ?? 'ann',
            oathkeeperIsUsurper: overrides.usurper,
            visionsDrawn: 3,
            warbandsBySite: { c1: { me: 1 }, c2: { me: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 }, p2: { [IMPERIAL_WARBANDS]: 1 } }
        }
    )
    openTurn(state, 'me')
    return state
}

describe('the goal board', () => {
    it('R-2.11.b — a tie on sites leaves the title with its holder, and the counts show the tie', () => {
        const board = goalBoard(table(OathType.Supremacy))
        expect(board.oath).toMatchObject({ holderId: 'ann', usurper: false })
        expect(board.oath.tally).toEqual({
            unit: TallyUnit.Sites,
            counts: [
                { playerId: 'me', count: 2 },
                { playerId: 'ann', count: 2 },
                { playerId: 'bo', count: 0 }
            ]
        })
    })

    it('R-3.2-H1 — the tied Exile’s Vision is not met', () => {
        expect(goalBoard(table(OathType.Supremacy)).visions).toEqual([
            { playerId: 'me', visionId: 'vision.conquest', shared: false, met: false }
        ])
    })

    it('R-3.1 — the title held on its Usurper side says so', () => {
        expect(goalBoard(table(OathType.Supremacy, { holder: 'me', usurper: true })).oath).toMatchObject({
            holderId: 'me',
            usurper: true
        })
    })

    it('R-2.11 — under Protection the count is relics and banners; under the banner Oaths, the holder alone', () => {
        expect(goalBoard(table(OathType.Protection)).oath.tally?.unit).toBe(TallyUnit.RelicsAndBanners)
        expect(goalBoard(table(OathType.ThePeople)).oath.tally).toBeUndefined()
        expect(goalBoard(table(OathType.Devotion)).oath.tally).toBeUndefined()
    })

    it('R-3.3.1 — the Successor appears only with a Citizen, compared with the Imperial players alone', () => {
        expect(goalBoard(table(OathType.Supremacy)).successor).toBeUndefined()
        const successor = goalBoard(table(OathType.Supremacy, { citizen: true })).successor
        expect(successor?.citizens).toEqual([{ playerId: 'bo', met: false }])
        expect(successor?.tally?.counts.map((count) => count.playerId).sort()).toEqual(['ann', 'bo'])
        expect(goalBoard(table(OathType.Protection, { citizen: true })).successor?.tally).toBeUndefined()
    })

    it('the next win leads the board', () => {
        expect(goalBoard(table(OathType.Supremacy)).next).toMatchObject({ when: 'endDie', playerId: 'ann' })
    })

    it('counts read as words', () => {
        expect(tallyLabel(TallyUnit.Sites, 1)).toBe('1 site')
        expect(tallyLabel(TallyUnit.Sites, 2)).toBe('2 sites')
        expect(tallyLabel(TallyUnit.RelicsAndBanners, 1)).toBe('1 relic or banner')
        expect(tallyLabel(TallyUnit.RelicsAndBanners, 0)).toBe('0 relics and banners')
    })
})
