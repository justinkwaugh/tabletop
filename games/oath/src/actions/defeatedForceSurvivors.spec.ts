import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign, type CampaignDefender } from './campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from './campaignSacrifice.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { CampaignTargetKind, type CampaignState, type CampaignTarget, type WarbandGroup } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { defeatPickMatters } from '../util/force.js'
import { warbandsAt } from '../util/rule.js'
import { campaignRecords, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { buildAction } from '../testing/actions.js'
import { site } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { OathRevision } from '../util/revision.js'
import { HydratedOathGameState } from '../model/gameState.js'
import '../powers/index.js'

const CAPTAINS = 'denizen.order.captains'
const WILD_ALLIES = 'denizen.beast.wild-allies'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const WOLVES = 'denizen.beast.wolves'

const atRevision = OathRevision.EngineFixes3
const before = OathRevision.UiBatch1

type Seat = 'cit' | 'chan' | 'ex'

interface Table {
    oathRevision: number
    attacker: Seat
    advisers?: string[]
    chancellorAt?: string
    exileAt?: string
    /** The warbands at c2, the site Captains or Wild Allies names (Wolves, a beast card, is there). */
    atC2?: WarbandCounts
}

/**
 * `cit`, a Citizen at c1 with 3 Imperial warbands on the board; `chan`, the Chancellor, with 4; `ex`, an
 * Exile with 2 of their own. The Empire's warbands alone hold c1 (Captains is there) and, by default, c2.
 */
function table({ oathRevision, attacker, advisers = [], chancellorAt = 'h1', exileAt = 'c1', atC2 = { [IMPERIAL_WARBANDS]: 2 } }: Table) {
    const held = (seat: Seat) => (seat === attacker ? advisers.map((cardId) => ({ cardId, faceUp: true })) : [])
    const s = testState(
        [
            testPlayer({ playerId: 'cit', color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, advisers: held('cit') }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: chancellorAt, supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 }, advisers: held('chan') }),
            testPlayer({ playerId: 'ex', color: Color.Red, status: PlayerStatus.Exile, siteId: exileAt, supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { ex: 2 }, warbandsInPersonalBank: { ex: 10 }, advisers: held('ex') })
        ],
        {
            oathRevision,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [CAPTAINS], c2: [WOLVES], p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: atC2 }
        }
    )
    openTurn(s, attacker)
    return s
}

/** Captains or Wild Allies names c2; the next action is the Campaign from there. */
function actingFromC2(s: HydratedOathGameState, playerId: Seat, cardId: string) {
    new HydratedUseActionPower(buildAction(UseActionPower, { playerId, cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Action), choices: [site('c2')] })).apply(s)
    s.actionCount += 1
    return s
}

const pawn: CampaignTarget[] = [{ kind: CampaignTargetKind.PawnAndFavor }]
const siteC2: CampaignTarget[] = [{ kind: CampaignTargetKind.Site, siteId: 'c2' }]

/** Declares the Campaign with no attack dice, then fixes the roll so the attacker is defeated. */
function defeatedCampaign(s: HydratedOathGameState, playerId: Seat, defender: Seat, targets: CampaignTarget[]) {
    const against: CampaignDefender = { kind: 'player', playerId: defender }
    new HydratedCampaign(buildAction(Campaign, { playerId, defender: against, targets, attackDice: 0 })).apply(s)
    const running = ongoingCampaign(s)
    running.swords = 0
    running.defense = 5
    return running
}

const fromBoard = (playerId: string, owner: string, count: number): WarbandGroup => ({ at: { kind: 'board', playerId }, owner, count })

/** The attacker loses, keeping their board's warbands alive where they can: the dead come off the board. */
function loseFromBoard(s: HydratedOathGameState, playerId: Seat, owner: string, count: number) {
    const action = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId, sacrifice: 0, defeatKills: [fromBoard(playerId, owner, count)] }))
    expectWarbandsConserved(s, () => action.apply(s))
    expect(action.metadata?.attackerVictorious).toBe(false)
    expect(action.metadata?.defeatKilled).toBe(count)
    expect(s.campaign).toBeUndefined()
}

const imperialOn = (s: HydratedOathGameState, playerId: string) => s.getPlayerState(playerId).warbandsOnBoard[IMPERIAL_WARBANDS] ?? 0

/** Vow of Union, attacking an Exile: c1 (1) and c2 (2), the sites `cit` rules, beside the 3 on the board. */
function vowOfUnionDefeated(oathRevision: number) {
    const s = table({ oathRevision, attacker: 'cit', advisers: [VOW_OF_UNION] })
    const running = defeatedCampaign(s, 'cit', 'ex', pawn)
    expect(HydratedCampaignSacrifice.attackerForce(s, running)).toEqual([
        { at: { kind: 'site', siteId: 'c1' }, owner: IMPERIAL_WARBANDS, count: 1 },
        { at: { kind: 'site', siteId: 'c2' }, owner: IMPERIAL_WARBANDS, count: 2 },
        fromBoard('cit', IMPERIAL_WARBANDS, 3)
    ])
    loseFromBoard(s, 'cit', IMPERIAL_WARBANDS, 3)
    expect(warbandsAt(s, 'c1')[IMPERIAL_WARBANDS]).toBe(0)
    expect(warbandsAt(s, 'c2')[IMPERIAL_WARBANDS]).toBe(0)
    return s
}

/** Captains names c2, attacking the Chancellor: the 2 there are in the force (R-5.5.1.a-H1), beside the 3 on the board. */
function captainsDefeated(oathRevision: number) {
    const s = actingFromC2(table({ oathRevision, attacker: 'cit' }), 'cit', CAPTAINS)
    const running = defeatedCampaign(s, 'cit', 'chan', siteC2)
    expect(HydratedCampaignSacrifice.attackerForce(s, running)).toEqual([
        { at: { kind: 'site', siteId: 'c2' }, owner: IMPERIAL_WARBANDS, count: 2 },
        fromBoard('cit', IMPERIAL_WARBANDS, 3)
    ])
    loseFromBoard(s, 'cit', IMPERIAL_WARBANDS, 2)
    expect(warbandsAt(s, 'c2')[IMPERIAL_WARBANDS]).toBe(0)
    return s
}

describe('R-5.5.6 — a defeated Citizen attacker moves the survivors at the sites in their force to their own board (revision 7)', () => {
    it('Vow of Union, attacking an Exile: the 3 from c1 and c2 go to the Citizen’s board, not the Chancellor’s', () => {
        const s = vowOfUnionDefeated(atRevision)
        expect(imperialOn(s, 'cit')).toBe(3)
        expect(imperialOn(s, 'chan')).toBe(4)
    })

    it('Captains, attacking the Chancellor: the 2 from c2 join the 1 left on the Citizen’s board', () => {
        const s = captainsDefeated(atRevision)
        expect(imperialOn(s, 'cit')).toBe(3)
        expect(imperialOn(s, 'chan')).toBe(4)
    })
})

describe('R-5.5.6 — the Chancellor and an Exile take their survivors home as before', () => {
    for (const oathRevision of [before, atRevision]) {
        it(`the Chancellor with Captains: the 2 from c2 go to their board (revision ${oathRevision})`, () => {
            const s = actingFromC2(table({ oathRevision, attacker: 'chan', chancellorAt: 'c1', exileAt: 'c2' }), 'chan', CAPTAINS)
            defeatedCampaign(s, 'chan', 'ex', pawn)
            loseFromBoard(s, 'chan', IMPERIAL_WARBANDS, 3)
            expect(warbandsAt(s, 'c2')[IMPERIAL_WARBANDS]).toBe(0)
            expect(imperialOn(s, 'chan')).toBe(3)
            expect(imperialOn(s, 'cit')).toBe(3)
        })

        it(`an Exile with Wild Allies: their 2 from c2 go to their board (revision ${oathRevision})`, () => {
            const s = actingFromC2(table({ oathRevision, attacker: 'ex', advisers: [WILD_ALLIES], chancellorAt: 'c2', atC2: { ex: 2 } }), 'ex', WILD_ALLIES)
            defeatedCampaign(s, 'ex', 'chan', pawn)
            loseFromBoard(s, 'ex', 'ex', 2)
            expect(warbandsAt(s, 'c2')['ex']).toBe(0)
            expect(s.getPlayerState('ex').warbandsOnBoard['ex']).toBe(2)
            expect(imperialOn(s, 'chan')).toBe(4)
        })
    }
})

describe('R-X.4 — before revision 7 a defeated Citizen’s survivors at sites went to the Chancellor’s board', () => {
    it('Vow of Union, attacking an Exile', () => {
        const s = vowOfUnionDefeated(before)
        expect(imperialOn(s, 'cit')).toBe(0)
        expect(imperialOn(s, 'chan')).toBe(7)
    })

    it('Captains, attacking the Chancellor', () => {
        const s = captainsDefeated(before)
        expect(imperialOn(s, 'cit')).toBe(1)
        expect(imperialOn(s, 'chan')).toBe(6)
    })
})

describe('R-5.5.6, R-10.13 — the defeat pick matters only when the dead go to more than one bank or the survivors to more than one board', () => {
    const atSite = (siteId: string, owner: string, count: number): WarbandGroup => ({ at: { kind: 'site', siteId }, owner, count })
    const revision = (oathRevision: number) => table({ oathRevision, attacker: 'cit' })

    it('a defeated attacker’s one-owner force: never from revision 7, since every survivor ends on their board', () => {
        const citizen = [atSite('c2', IMPERIAL_WARBANDS, 2), fromBoard('cit', IMPERIAL_WARBANDS, 3)]
        expect(defeatPickMatters(revision(atRevision), citizen, 'cit')).toBe(false)
        expect(defeatPickMatters(revision(before), citizen, 'cit')).toBe(true)

        const exile = [atSite('c2', 'ex', 2), fromBoard('ex', 'ex', 2)]
        expect(defeatPickMatters(revision(atRevision), exile, 'ex')).toBe(false)
        expect(defeatPickMatters(revision(before), exile, 'ex')).toBe(false)

        const chancellor = [atSite('c2', IMPERIAL_WARBANDS, 2), fromBoard('chan', IMPERIAL_WARBANDS, 4)]
        expect(defeatPickMatters(revision(atRevision), chancellor, 'chan')).toBe(false)
        expect(defeatPickMatters(revision(before), chancellor, 'chan')).toBe(false)
    })

    it('a force that mixes owners, as a Citizen’s own colour beside the Empire’s before revision 5: always', () => {
        const mixed = [atSite('c2', IMPERIAL_WARBANDS, 2), fromBoard('cit', 'cit', 3)]
        expect(defeatPickMatters(revision(atRevision), mixed, 'cit')).toBe(true)
        expect(defeatPickMatters(revision(atRevision), mixed)).toBe(true)
    })

    it('a defending force: its survivors at sites go to their owner’s board, the Empire’s to the Chancellor’s', () => {
        const s = revision(atRevision)
        expect(defeatPickMatters(s, [atSite('c2', 'ex', 2), fromBoard('ex', 'ex', 1)])).toBe(false)
        expect(defeatPickMatters(s, [atSite('c2', IMPERIAL_WARBANDS, 2), fromBoard('chan', IMPERIAL_WARBANDS, 2)])).toBe(false)
        expect(defeatPickMatters(s, [atSite('c2', IMPERIAL_WARBANDS, 2), fromBoard('cit', IMPERIAL_WARBANDS, 1)])).toBe(true)
        expect(defeatPickMatters(s, [atSite('c2', IMPERIAL_WARBANDS, 2)])).toBe(false)
    })
})

describe('R-5.5.6.a — a lone defender is not asked for losses that cannot differ (revision 7)', () => {
    /** `ex` attacks and wins; the defender's force is 2 at c2 and 1 on their board, so 1 dies. */
    function won(oathRevision: number, defender: 'chan' | 'ex') {
        const owner = defender === 'chan' ? IMPERIAL_WARBANDS : defender
        const s = table({ oathRevision, attacker: 'ex', atC2: { [owner]: 2 } })
        s.getPlayerState(defender).warbandsOnBoard = { [owner]: 1 }
        const defendingForce: WarbandGroup[] = [
            { at: { kind: 'site', siteId: 'c2' }, owner, count: 2 },
            fromBoard(defender, owner, 1)
        ]
        const campaign: CampaignState = {
            attackerPlayerId: 'ex',
            defenderPlayerId: defender,
            nonImperialPlayerIds: [],
            allyPlayerIds: [],
            targets: siteC2,
            attackPool: 4,
            defensePool: 1,
            attackRoll: [],
            defenseRoll: [],
            defense: 1,
            swords: 9,
            defendingForce,
            defendingBandits: 0,
            ...campaignRecords()
        }
        s.campaign = campaign
        return { s, owner }
    }
    const victory = () => new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'ex', sacrifice: 0 }))

    for (const defender of ['ex', 'chan'] as const) {
        it(`${defender === 'ex' ? 'an Exile' : 'the Chancellor'}: the default kill is taken, and the survivors go to their board`, () => {
            const { s, owner } = won(atRevision, defender)
            const action = victory()
            expectWarbandsConserved(s, () => action.apply(s))
            expect(s.campaign?.pendingDefeatKills).toBeUndefined()
            expect(action.metadata?.awaitingLossesOf).toBeUndefined()
            expect(action.metadata?.defeatKilled).toBe(1)
            expect(warbandsAt(s, 'c2')[owner]).toBe(0)
            expect(s.getPlayerState(defender).warbandsOnBoard[owner]).toBe(2)
        })

        it(`${defender === 'ex' ? 'an Exile' : 'the Chancellor'}: still asked in a game created before the revision (R-X.4)`, () => {
            const { s } = won(before, defender)
            victory().apply(s)
            expect(s.campaign?.pendingDefeatKills).toEqual({ chooserPlayerId: defender })
        })
    }
})

describe('R-5.5.5.c — a sacrifice is exactly enough to win, so the defeat pick never reads a force less a sacrifice', () => {
    it('a sacrifice named at c2 wins: the attacker names no defeated half, and none is offered', () => {
        const s = actingFromC2(table({ oathRevision: atRevision, attacker: 'cit' }), 'cit', CAPTAINS)
        const running = defeatedCampaign(s, 'cit', 'chan', siteC2)
        running.swords = 4
        running.defense = 4
        expect(HydratedCampaignSacrifice.sacrificeNeeded(running)).toBe(1)
        expect(HydratedCampaignSacrifice.isVictorious(running, 1)).toBe(true)
        const atC2 = { at: { kind: 'site' as const, siteId: 'c2' }, owner: IMPERIAL_WARBANDS, count: 1 }
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'cit', { sacrifice: 1, sacrificeKills: [atC2] })).toBeUndefined()
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'cit', { sacrifice: 1, sacrificeKills: [atC2], defeatKills: [fromBoard('cit', IMPERIAL_WARBANDS, 2)] })).toMatch(/defending side chooses its own losses/)
        expect(HydratedCampaignSacrifice.attackerDefeatKills(s, 1)).toEqual([])
    })
})
