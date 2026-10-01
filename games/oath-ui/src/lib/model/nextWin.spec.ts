import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS, OathType, PlayerStatus, WinKind } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { nextWin, nextWinPhrase } from './nextWin.js'

/** R-3 — the first win the table would produce as it stands, walking Wakes and round ends in order. */
function table(options: {
    round?: number
    current?: string
    holder?: string
    usurper?: boolean
    me?: Parameters<typeof testPlayer>[0]
    bo?: Parameters<typeof testPlayer>[0]
    sites?: Record<string, Record<string, number>>
    visionsDrawn?: number
}) {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', ...options.me }),
            testPlayer({ playerId: 'ann', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1' }),
            testPlayer({ playerId: 'bo', color: Color.Yellow, siteId: 'h1', ...options.bo })
        ],
        {
            chancellorPlayerId: 'ann',
            oathType: OathType.Supremacy,
            round: options.round ?? 1,
            oathkeeperPlayerId: options.holder,
            oathkeeperIsUsurper: options.usurper,
            warbandsBySite: options.sites ?? { p1: { [IMPERIAL_WARBANDS]: 1 } },
            visionsDrawn: options.visionsDrawn ?? 0
        }
    )
    openTurn(state, options.current ?? 'me')
    return state
}

describe('the next win', () => {
    it('R-3.3 — with the Chancellor holding the title, the first end die that could end the game', () => {
        expect(nextWin(table({ holder: 'ann' }))).toEqual({
            when: 'endDie',
            playerId: 'ann',
            kind: WinKind.StableRegime,
            round: 5,
            threshold: 6
        })
        expect(nextWin(table({ holder: 'ann', round: 6 }))).toMatchObject({ when: 'endDie', round: 6, threshold: 5 })
    })

    it('R-3.3.1 — a Citizen meeting the Successor goal takes the Empire’s win', () => {
        const state = table({
            holder: 'ann',
            bo: { status: PlayerStatus.Citizen, relicIds: ['relic.cup'], warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 0, bo: 14 } }
        })
        expect(nextWin(state)).toMatchObject({ when: 'endDie', playerId: 'bo', kind: WinKind.Successor })
    })

    it('R-3.1 — an Usurper later in the round wins at their Wake, before the round ends', () => {
        expect(nextWin(table({ holder: 'bo', usurper: true, round: 6 }))).toEqual({
            when: 'wake',
            playerId: 'bo',
            kind: WinKind.Usurper
        })
    })

    it('R-3.1 — the seat on the clock has had this Wake, so theirs is next round’s', () => {
        const state = table({ holder: 'me', usurper: true, round: 6 })
        expect(nextWin(state)).toEqual({ when: 'wake', playerId: 'me', kind: WinKind.Usurper })
    })

    it('R-3.2 — an Exile meeting their Vision alone, three Visions drawn, wins at their next Wake', () => {
        const state = table({
            holder: 'ann',
            round: 6,
            visionsDrawn: 3,
            bo: { revealedVisionId: 'vision.conquest' },
            sites: { h1: { bo: 1 }, h2: { bo: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 } }
        })
        expect(nextWin(state)).toEqual({ when: 'wake', playerId: 'bo', kind: WinKind.Visionary })
    })

    it('R-3.2-H1 — a Vision tied for the count is not met, so the end die comes first', () => {
        const state = table({
            holder: 'ann',
            round: 6,
            visionsDrawn: 3,
            bo: { revealedVisionId: 'vision.conquest' },
            sites: { h1: { bo: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 } }
        })
        expect(nextWin(state)).toMatchObject({ when: 'endDie', playerId: 'ann' })
    })

    it('R-4.1.3 — an Exile holding the Oathkeeper side turns Usurper at their next Wake and wins at the one after', () => {
        expect(nextWin(table({ holder: 'bo', round: 2 }))).toEqual({ when: 'wakeAfterNext', playerId: 'bo' })
    })

    it('R-3.4.2 — when round 8 ends first, the Exile who turned Usurper wins then', () => {
        expect(nextWin(table({ holder: 'bo', round: 8 }))).toEqual({
            when: 'finalRound',
            playerId: 'bo',
            kind: WinKind.Usurper
        })
    })

    it('R-3.4.1 — in round 8 with the Chancellor holding the title, the Empire wins when the round ends', () => {
        expect(nextWin(table({ holder: 'ann', round: 8 }))).toMatchObject({
            when: 'finalRound',
            playerId: 'ann'
        })
    })
})

describe('the next win, in words', () => {
    it('names the end die’s odds for the round, in the viewer’s person', () => {
        const next = { when: 'endDie', playerId: 'ann', kind: WinKind.StableRegime, round: 5, threshold: 6 } as const
        expect(nextWinPhrase(next, false)).toBe('wins as the Oathkeeper if the end die ends the game after round 5 (on a 6)')
        expect(nextWinPhrase({ ...next, round: 7, threshold: 3 }, true)).toBe(
            'win as the Oathkeeper if the end die ends the game after round 7 (on a 3 or more)'
        )
    })

    it('a Wake win, the Usurper’s two Wakes and round 8', () => {
        expect(nextWinPhrase({ when: 'wake', playerId: 'bo', kind: WinKind.Visionary }, false)).toBe(
            'wins with their Vision at their next Wake'
        )
        expect(nextWinPhrase({ when: 'wakeAfterNext', playerId: 'me' }, true)).toBe(
            'become the Usurper at your next Wake and win at the one after'
        )
        expect(nextWinPhrase({ when: 'finalRound', playerId: 'bo', kind: WinKind.Successor }, false)).toBe(
            'wins as the Successor when round 8 ends'
        )
    })
})
