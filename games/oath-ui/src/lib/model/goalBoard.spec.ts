import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, IMPERIAL_WARBANDS, OathType, PlayerStatus } from '@tabletop/oath'
import { openTurn, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { GoalKind, SUCCESSOR_KINDS, goalBoard, standingWords } from './goalBoard.js'

type Table = {
    usurper?: boolean
    holder?: string
    citizen?: boolean
    banners?: Partial<Record<Banner, string>>
    boRelics?: string[]
    state?: Record<string, unknown>
}

/** R-2.11, R-3 — the rail's goals: who holds the title, the standing behind it, each Vision and the Successor. */
function table(oathType: OathType, over: Table = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', revealedVisionId: 'vision.conquest' }),
            testPlayer({ playerId: 'ann', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1' }),
            testPlayer({
                playerId: 'bo',
                color: Color.Yellow,
                siteId: 'h1',
                relicIds: over.boRelics ?? [],
                ...(over.citizen
                    ? { status: PlayerStatus.Citizen, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 0, bo: 14 } }
                    : {})
            })
        ],
        {
            chancellorPlayerId: 'ann',
            oathType,
            oathkeeperPlayerId: over.holder ?? 'ann',
            oathkeeperIsUsurper: over.usurper,
            visionsDrawn: 3,
            banners: testBanners(over.banners ?? {}),
            warbandsBySite: { c1: { me: 1 }, c2: { me: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 }, p2: { [IMPERIAL_WARBANDS]: 1 } },
            ...over.state
        }
    )
    openTurn(state, 'me')
    return state
}

describe('the goal board', () => {
    it('R-2.11.b — a count goal: every seat’s count, the title’s holder ringed, a tie leaving the title where it is', () => {
        const { oath } = goalBoard(table(OathType.Supremacy))
        expect(oath).toMatchObject({ kind: GoalKind.Sites, holderId: 'ann', usurper: false })
        expect(oath.standing).toEqual({
            shape: 'count',
            ringedId: 'ann',
            counts: [
                { playerId: 'me', count: 2 },
                { playerId: 'ann', count: 2 },
                { playerId: 'bo', count: 0 }
            ]
        })
    })

    it('R-3.2-H1 — a counted Vision rings its own seat, and a tie is not met', () => {
        const [vision] = goalBoard(table(OathType.Supremacy)).visions
        expect(vision).toMatchObject({ playerId: 'me', visionId: 'vision.conquest', shared: false, met: false })
        expect(vision.kind).toBe(GoalKind.Sites)
        expect(vision.standing).toMatchObject({ shape: 'count', ringedId: 'me' })
    })

    it('R-3.1 — the title held on its Usurper side says so', () => {
        expect(goalBoard(table(OathType.Supremacy, { holder: 'me', usurper: true })).oath).toMatchObject({
            holderId: 'me',
            usurper: true
        })
    })

    it('R-2.11 — a banner Oath is a holder goal: the banner’s holder, or nobody', () => {
        expect(goalBoard(table(OathType.Protection)).oath.kind).toBe(GoalKind.RelicsAndBanners)
        const people = goalBoard(table(OathType.ThePeople, { banners: { [Banner.PeoplesFavor]: 'ann' } })).oath
        expect(people).toMatchObject({ kind: GoalKind.PeoplesFavor, standing: { shape: 'holder', holderId: 'ann' } })
        const devotion = goalBoard(table(OathType.Devotion)).oath
        expect(devotion).toMatchObject({ kind: GoalKind.DarkestSecret, standing: { shape: 'holder' } })
        expect(devotion.standing).toEqual({ shape: 'holder', holderId: undefined })
    })

    it('R-3.3.1 — the Successor appears only with a Citizen, compared with the Imperial players alone', () => {
        expect(goalBoard(table(OathType.Supremacy)).successors).toEqual([])
        const [successor] = goalBoard(table(OathType.Supremacy, { citizen: true })).successors
        expect(successor).toMatchObject({ citizenId: 'bo', met: false, kind: GoalKind.RelicsAndBanners })
        expect(successor.standing).toMatchObject({ shape: 'count', ringedId: 'bo' })
        if (successor.standing.shape !== 'count') throw Error('a count')
        expect(successor.standing.counts.map((count) => count.playerId).sort()).toEqual(['ann', 'bo'])
    })

    it('R-3.3.1 — each Oath’s Successor symbol names what the engine’s Successor goal reads', () => {
        const successor = (oathType: OathType, over: Table) =>
            goalBoard(table(oathType, { citizen: true, ...over })).successors[0]
        expect(successor(OathType.Supremacy, { boRelics: ['relic.grand-scepter'] })).toMatchObject({
            met: true,
            kind: SUCCESSOR_KINDS[OathType.Supremacy]
        })
        expect(successor(OathType.ThePeople, { banners: { [Banner.DarkestSecret]: 'bo' } })).toMatchObject({
            met: true,
            kind: GoalKind.DarkestSecret,
            standing: { shape: 'holder', holderId: 'bo' }
        })
        expect(successor(OathType.Protection, { banners: { [Banner.PeoplesFavor]: 'bo' } })).toMatchObject({
            met: true,
            kind: GoalKind.PeoplesFavor,
            standing: { shape: 'holder', holderId: 'bo' }
        })
        expect(successor(OathType.Devotion, { boRelics: ['relic.grand-scepter'] })).toMatchObject({
            met: true,
            kind: GoalKind.GrandScepter,
            standing: { shape: 'holder', holderId: 'bo' }
        })
    })

    it('R-3.2 — a Vision shared by a warband on it names the seat whose Vision it is', () => {
        const state = table(OathType.Supremacy, {
            state: { warbandsOnCards: { 'vision.conquest': { bo: 1 } } }
        })
        const shared = goalBoard(state).visions.find((vision) => vision.shared)
        expect(shared).toMatchObject({ playerId: 'bo', ownerId: 'me', visionId: 'vision.conquest' })
    })

    it('the next win leads the board', () => {
        expect(goalBoard(table(OathType.Supremacy)).next).toMatchObject({ when: 'endDie', playerId: 'ann' })
    })

    it('a disc’s tooltip says the count or the thing held in words', () => {
        expect(standingWords(GoalKind.Sites, 1)).toBe('1 site ruled')
        expect(standingWords(GoalKind.Sites, 2)).toBe('2 sites ruled')
        expect(standingWords(GoalKind.RelicsAndBanners, 1)).toBe('1 relic or banner')
        expect(standingWords(GoalKind.RelicsAndBanners, 0)).toBe('0 relics and banners')
        expect(standingWords(GoalKind.GrandScepter)).toBe('the Grand Scepter')
        expect(standingWords(GoalKind.Sites)).toBe('sites ruled')
    })
})
