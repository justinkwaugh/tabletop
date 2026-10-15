import { describe, expect, it } from 'vitest'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type ExchangeTerms } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import '../powers/index.js'
import { actionPowerUse } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { answerQuestion } from '../testing/steps.js'
import { rulerTable } from '../testing/tables.js'
import { PowerChoiceKind } from './powerChoice.js'
import {
    applyExchange,
    boardToMoveInFrom,
    boardWarbandOwnerOf,
    reasonExchangeInvalid
} from './exchange.js'
import { rulesSite, totalWarbandsAt, warbandsAt } from './rule.js'
import { OathRevision } from './revision.js'

const DEED_WRITER = 'denizen.hearth.deed-writer'
const CROWN = 'relic.bandit-crown'

/**
 * 'ruler' rules c1 (1 warband) and c2 (2) and has 4 on their board, with Deed Writer at c1;
 * 'other' rules p1 with `atP1` and has `onBoard`; the game keeps the rules of `revision`.
 */
function table(
    onBoard: Record<string, number>,
    revision: OathRevision = OathRevision.EngineFixes7,
    atP1: Record<string, number> = { other: 3 },
    over: Record<string, Record<string, unknown>> = {}
) {
    return rulerTable(
        [DEED_WRITER],
        [],
        { ...over, other: { warbandsOnBoard: onBoard, ...over['other'] } },
        {
            oathRevision: revision,
            warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 }, p1: atP1 }
        }
    )
}

/** 'ruler' gives c2 for 'other''s p1, each new ruler moving in the count named. */
function swap(intoC2: number, intoP1 = 1, proposer: 'ruler' | 'other' = 'ruler'): ExchangeTerms {
    const c2 = { sites: [{ siteId: 'c2', warbands: intoC2 }] }
    const p1 = { sites: [{ siteId: 'p1', warbands: intoP1 }] }
    return proposer === 'ruler'
        ? { fromProposer: c2, fromCounterparty: p1 }
        : { fromProposer: p1, fromCounterparty: c2 }
}

function proposeWithDeedWriter(s: HydratedOathGameState, terms: ExchangeTerms): void {
    actionPowerUse('ruler', DEED_WRITER, [
        { kind: PowerChoiceKind.Exchange, withPlayerId: 'other', terms }
    ]).apply(s)
    answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
}

function view(s: HydratedOathGameState, playerId: string): HydratedOathGameState {
    return new HydratedOathGameState(served(s, { kind: 'player', playerId }))
}

// Deed Writer: "Old ruler moves warbands to board, and new ruler moves warbands from board." Law
// 10.8: "You may Give to the prompted player and vice versa." Every outgoing site's warbands come
// home before any new ruler moves in, across both sides.
describe('Deed Writer from revision 11: old rulers go home first, then new rulers move in', () => {
    it('a ruler whose only warbands are on the site they give takes the other site (the other player proposes)', () => {
        const s = table({})
        expect(reasonExchangeInvalid(s, 'ruler', 'other', swap(2))).toBeUndefined()
        proposeWithDeedWriter(s, swap(2))
        expect(warbandsAt(s, 'c2')).toMatchObject({ other: 2 })
        expect(warbandsAt(s, 'c2')['ruler'] ?? 0).toBe(0)
        expect(warbandsAt(s, 'p1')).toMatchObject({ ruler: 1 })
        expect(warbandsAt(s, 'p1')['other'] ?? 0).toBe(0)
        expect(s.getPlayerState('other').warbandsOnBoard['other']).toBe(1)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(5)
        expect(rulesSite(s, 'other', 'c2')).toBe(true)
        expect(rulesSite(s, 'ruler', 'p1')).toBe(true)
    })

    it('the same exchange is accepted and applied when that ruler proposes it', () => {
        const s = table({})
        const terms = swap(2, 1, 'other')
        expect(reasonExchangeInvalid(s, 'other', 'ruler', terms)).toBeUndefined()
        applyExchange(s, 'other', 'ruler', terms)
        expect(warbandsAt(s, 'c2')).toMatchObject({ other: 2 })
        expect(warbandsAt(s, 'p1')).toMatchObject({ ruler: 1 })
        expect(s.getPlayerState('other').warbandsOnBoard['other']).toBe(1)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(5)
    })

    it('a receiver still short after their own site comes home is refused', () => {
        const s = table({})
        expect(reasonExchangeInvalid(s, 'ruler', 'other', swap(4))).toBe(
            "other's board has fewer than 4 warbands to move to c2"
        )
        expect(reasonExchangeInvalid(s, 'other', 'ruler', swap(4, 1, 'other'))).toBe(
            "other's board has fewer than 4 warbands to move to c2"
        )
    })

    it('two sites handed over share the board their giver’s returned warbands fill', () => {
        const s = table({})
        const terms: ExchangeTerms = {
            fromProposer: {
                sites: [
                    { siteId: 'c1', warbands: 2 },
                    { siteId: 'c2', warbands: 1 }
                ]
            },
            fromCounterparty: { sites: [{ siteId: 'p1', warbands: 1 }] }
        }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        proposeWithDeedWriter(s, terms)
        expect(warbandsAt(s, 'c1')).toMatchObject({ other: 2 })
        expect(warbandsAt(s, 'c2')).toMatchObject({ other: 1 })
        expect(s.getPlayerState('other').warbandsOnBoard['other'] ?? 0).toBe(0)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(6)
    })

    it('a site for favor is unchanged: nothing comes home to the receiver', () => {
        for (const revision of [OathRevision.EngineFixes7, OathRevision.EngineFixes6]) {
            const s = table({ other: 2 }, revision)
            const terms: ExchangeTerms = {
                fromProposer: { sites: [{ siteId: 'c2', warbands: 2 }] },
                fromCounterparty: { favor: 1 }
            }
            expect(reasonExchangeInvalid(s, 'ruler', 'other', { ...terms, fromProposer: { sites: [{ siteId: 'c2', warbands: 3 }] } })).toBe(
                "other's board has fewer than 3 warbands to move to c2"
            )
            proposeWithDeedWriter(s, terms)
            expect(warbandsAt(s, 'c2')).toMatchObject({ other: 2 })
            expect(s.getPlayerState('other').warbandsOnBoard['other'] ?? 0).toBe(0)
            expect(s.getPlayerState('ruler').favor).toBe(4)
        }
    })

    it('a Bandit Crown holder with an empty board may still take a site with no warbands (its Q&A)', () => {
        for (const revision of [OathRevision.EngineFixes7, OathRevision.EngineFixes6]) {
            const s = table({}, revision, {}, { other: { relicIds: [CROWN] } })
            const terms: ExchangeTerms = { fromProposer: { sites: [{ siteId: 'c2', warbands: 0 }] } }
            expect(reasonExchangeInvalid(s, 'ruler', 'other', terms), `revision ${revision}`).toBeUndefined()
            proposeWithDeedWriter(s, terms)
            expect(totalWarbandsAt(s, 'c2')).toBe(0)
            expect(rulesSite(s, 'other', 'c2')).toBe(true)
        }
    })

    it('a Bandit Crown holder giving the site their warbands hold moves them into the other site', () => {
        const s = table({}, OathRevision.EngineFixes7, { other: 3 }, { other: { relicIds: [CROWN] } })
        expect(reasonExchangeInvalid(s, 'ruler', 'other', swap(3))).toBeUndefined()
        proposeWithDeedWriter(s, swap(3))
        expect(warbandsAt(s, 'c2')).toMatchObject({ other: 3 })
    })
})

describe('before revision 11 an exchange keeps the order it was recorded with', () => {
    it('the receiver’s board is read before their own site comes home, so the exchange is refused either way', () => {
        const s = table({}, OathRevision.EngineFixes6)
        expect(reasonExchangeInvalid(s, 'ruler', 'other', swap(2))).toBe(
            "other's board has fewer than 2 warbands to move to c2"
        )
        expect(reasonExchangeInvalid(s, 'other', 'ruler', swap(2, 1, 'other'))).toBe(
            "other's board has fewer than 2 warbands to move to c2"
        )
    })

    // Why the order is gated: a Citizen's board holds their own warbands and the Empire's, and the
    // new ruler moves in whichever the board holds most of (R-10.8). Warbands coming home first can
    // change which that is, and so what a recorded exchange placed.
    it('a Citizen receiving a site places what their board held before their own site came home', () => {
        const citizen = (revision: OathRevision) =>
            table({ other: 2, [IMPERIAL_WARBANDS]: 1 }, revision, { [IMPERIAL_WARBANDS]: 3 }, {
                other: { status: PlayerStatus.Citizen },
                away: { status: PlayerStatus.Chancellor }
            })
        const before = citizen(OathRevision.EngineFixes6)
        proposeWithDeedWriter(before, swap(1))
        expect(warbandsAt(before, 'c2')).toMatchObject({ other: 1 })
        expect(warbandsAt(before, 'c2')[IMPERIAL_WARBANDS] ?? 0).toBe(0)
        expect(before.getPlayerState('other').warbandsOnBoard).toMatchObject({ other: 1, [IMPERIAL_WARBANDS]: 4 })

        const after = citizen(OathRevision.EngineFixes7)
        proposeWithDeedWriter(after, swap(1))
        expect(warbandsAt(after, 'c2')).toMatchObject({ [IMPERIAL_WARBANDS]: 1 })
        expect(warbandsAt(after, 'c2')['other'] ?? 0).toBe(0)
        expect(after.getPlayerState('other').warbandsOnBoard).toMatchObject({ other: 2, [IMPERIAL_WARBANDS]: 3 })
    })
})

describe("safe on a player's view: the board a new ruler moves in from reads only what is public", () => {
    it('every view counts the board and judges the terms as the server does', () => {
        const scenes = [table({}), table({}, OathRevision.EngineFixes6), table({ other: 1 })]
        const termsList = [swap(2), swap(3), swap(4), swap(2, 1, 'other'), swap(1, 5)]
        for (const s of scenes) {
            for (const playerId of ['ruler', 'other', 'away']) {
                const seen = view(s, playerId)
                for (const terms of termsList) {
                    expect(reasonExchangeInvalid(seen, 'ruler', 'other', terms)).toBe(
                        reasonExchangeInvalid(s, 'ruler', 'other', terms)
                    )
                }
                const p1 = [{ siteId: 'p1', warbands: 1 }]
                expect(boardToMoveInFrom(seen, 'other', p1)).toEqual(boardToMoveInFrom(s, 'other', p1))
                expect(boardWarbandOwnerOf(seen, 'other', p1)).toBe(boardWarbandOwnerOf(s, 'other', p1))
            }
        }
    })

    it('from revision 11 the board counts the warbands the receiver’s own sites send home', () => {
        const p1 = [{ siteId: 'p1', warbands: 1 }]
        expect(boardToMoveInFrom(table({ other: 1 }), 'other', p1)).toEqual({ other: 4 })
        expect(boardToMoveInFrom(table({ other: 1 }, OathRevision.EngineFixes6), 'other', p1)).toEqual({ other: 1 })
        expect(boardWarbandOwnerOf(table({}), 'other', p1)).toBe('other')
    })
})
