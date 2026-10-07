import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { reasonNoCampaignAgainst } from '../util/campaign.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const PYTHON = 'denizen.beast.giant-python'
const WARD = 'denizen.arcane.sealing-ward'
const CIRCLET = 'relic.circlet-of-command'
const CUP = 'relic.cup-of-plenty'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

/**
 * `att`, an Exile, campaigns from `attSite`. `def` (an Exile) rules c1 and c2 and stands at c1;
 * the Empire's warbands at p1 and p2 are ruled by the Chancellor `chan` and the Citizen `cit`.
 */
function board(
    oathRevision: number,
    attSite: string,
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {}
) {
    const s = testState(
        [
            testPlayer({ playerId: 'att', color: Color.Red, status: PlayerStatus.Exile, siteId: attSite, supply: 6, secrets: 1, warbandsOnBoard: { att: 4 }, ...over['att'] }),
            testPlayer({ playerId: 'def', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 3, secrets: 1, warbandsOnBoard: { def: 2 }, ...over['def'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h3', supply: 6, favor: 3, secrets: 1, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, ...over['chan'] }),
            testPlayer({ playerId: 'cit', color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'h2', supply: 6, favor: 3, secrets: 1, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 1 }, ...over['cit'] })
        ],
        {
            oathRevision,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [], h3: [] },
            warbandsBySite: { c1: { def: 1 }, c2: { def: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 }, p2: { [IMPERIAL_WARBANDS]: 1 } },
            ...state
        }
    )
    openTurn(s, 'att')
    return s
}

const advisers = (...cardIds: string[]) => ({ advisers: cardIds.map((cardId) => ({ cardId, faceUp: true })) })
const site = (siteId: string): CampaignTarget => ({ kind: CampaignTargetKind.Site, siteId })
const pawn: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const relic = (cardId: string): CampaignTarget => ({ kind: CampaignTargetKind.Relic, cardId })

function choice(defender: string, targets: CampaignTarget[]) {
    return { defender: { kind: 'player' as const, playerId: defender }, targets, attackDice: 2, plans: [] }
}
const reason = (s: ReturnType<typeof board>, defender: string, targets: CampaignTarget[]) =>
    HydratedCampaign.reasonCannotCampaign(s, 'att', choice(defender, targets))

/** The Oathkeeper `def` holds Giant Python; their title adds one die to the pool. */
function oathkeeperWithPython(oathRevision: number) {
    return board(oathRevision, 'c1', { def: advisers(PYTHON) }, { oathkeeperPlayerId: 'def' })
}

/** The Chancellor holds Giant Python and is the Citizen defender's ally from the declaration (R-5.5.2.a). */
function chancellorWithPython(oathRevision: number, state: Record<string, unknown> = {}) {
    return board(oathRevision, 'p1', { chan: advisers(PYTHON) }, state)
}

describe('Giant Python counts only the dice its holder’s targets add (revision 5)', () => {
    it('the Oathkeeper’s title die is not counted: one site is odd, two sites are even', () => {
        const s = oathkeeperWithPython(atRevision)
        expect(reason(s, 'def', [site('c1')])).toBe('Giant Python: the targets must add an even total of defense dice, not 1')
        expect(reason(s, 'def', [site('c1'), site('c2')])).toBeUndefined()
        expect(reason(s, 'def', [site('c1'), pawn])).toBe('Giant Python: the targets must add an even total of defense dice, not 3')
    })

    it('the defense pool still takes the title die', () => {
        const s = oathkeeperWithPython(atRevision)
        new HydratedCampaign(buildAction(Campaign, { playerId: 'att', ...choice('def', [site('c1'), site('c2')]) })).apply(s)
        expect(s.campaign?.defensePool).toBe(3)
    })

    it('Sealing Ward’s die on a targeted relic still counts', () => {
        const warded = board(atRevision, 'c1', { def: { ...advisers(PYTHON, WARD), relicIds: [CUP] } })
        expect(reason(warded, 'def', [site('c1'), relic(CUP)])).toBeUndefined()
        const plain = board(atRevision, 'c1', { def: { ...advisers(PYTHON), relicIds: [CUP] } })
        expect(reason(plain, 'def', [site('c1'), relic(CUP)])).toBe('Giant Python: the targets must add an even total of defense dice, not 3')
    })

    it('the Circlet of Command’s die on the pawn still counts', () => {
        const circlet = board(atRevision, 'c1', { def: { ...advisers(PYTHON), relicIds: [CIRCLET] } })
        expect(reason(circlet, 'def', [site('c1'), pawn])).toBeUndefined()
        const plain = board(atRevision, 'c1', { def: advisers(PYTHON) })
        expect(reason(plain, 'def', [site('c1'), pawn])).toBe('Giant Python: the targets must add an even total of defense dice, not 3')
    })
})

describe('Giant Python held by the Chancellor binds an attack on a Citizen (revision 5)', () => {
    it('the Chancellor, an ally from the declaration, holds it: the targets must add an even total', () => {
        const s = chancellorWithPython(atRevision)
        expect(reason(s, 'cit', [site('p1')])).toBe('Giant Python: the targets must add an even total of defense dice, not 1')
        expect(reason(s, 'cit', [site('p1'), site('p2')])).toBeUndefined()
    })

    it('a Citizen defender is no legal choice when only an odd total can be declared', () => {
        const s = chancellorWithPython(atRevision, { warbandsBySite: { c1: { def: 1 }, c2: { def: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 } } })
        expect(reasonNoCampaignAgainst(s, 'att', 'cit')).toBe('no targets can be declared against cit')
        expect(HydratedCampaign.legalDefenders(s, 'att')).not.toContainEqual({ kind: 'player', playerId: 'cit' })
    })

    it('a Citizen who holds it does not bind an attack on the Chancellor: they join after the targets are declared (its Q&A)', () => {
        const s = board(atRevision, 'p1', { cit: { ...advisers(PYTHON), siteId: 'p1' } })
        expect(reason(s, 'chan', [site('p1')])).toBeUndefined()
    })
})

describe('R-X.4 — before revision 5, Giant Python counts the whole pool and only its defender', () => {
    it('the Oathkeeper’s title die makes one site even', () => {
        const s = oathkeeperWithPython(before)
        expect(reason(s, 'def', [site('c1')])).toBeUndefined()
        expect(reason(s, 'def', [site('c1'), site('c2')])).toBe('Giant Python: the targets must add an even total of defense dice, not 3')
    })

    it('the Chancellor’s Python does not bind an attack on a Citizen', () => {
        const s = chancellorWithPython(before)
        expect(reason(s, 'cit', [site('p1')])).toBeUndefined()
        const one = chancellorWithPython(before, { warbandsBySite: { c1: { def: 1 }, c2: { def: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 } } })
        expect(reasonNoCampaignAgainst(one, 'att', 'cit')).toBeUndefined()
    })

    for (const [name, start, defender, targets] of [
        ['against the Oathkeeper, one site', oathkeeperWithPython, 'def', [site('c1')]],
        ['against a Citizen, the Chancellor holding it', chancellorWithPython, 'cit', [site('p1')]]
    ] as const) {
        it(`a Campaign recorded ${name} replays unchanged; from revision 5 it is refused`, () => {
            const game = testGame(['att', 'def', 'chan', 'cit'])
            const action = buildAction(Campaign, { playerId: 'att', ...choice(defender, [...targets]) })
            const recordedFrom = start(before).dehydrate()
            const recorded = engine.runNext(structuredClone(action), structuredClone(recordedFrom), game)
            let replayed = structuredClone(recordedFrom)
            for (const processed of recorded.processedActions) replayed = engine.run(structuredClone(processed), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)

            expect(() => engine.runNext(structuredClone(action), start(atRevision).dehydrate(), game)).toThrow(/Giant Python/)
        })
    }
})
