import { describe, expect, it } from 'vitest'
import { Color, assertExists } from '@tabletop/common'
import { CardKind, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { boardWarbands, site, siteTarget, siteWarbands } from '../testing/choices.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import {
    legalChoices,
    optional,
    PowerChoiceKind,
    type ChoiceDomain,
    type PowerChoice
} from '../util/powerChoice.js'
import { cardPowers, PowerTiming, powerIndexOf, registerCardPowers } from '../data/cardPowers.js'
import { registerCards } from '../data/cardRegistry.js'
import { rulingWarbandOwners, sitesRuledBy, warbandsFreeToLeave } from '../util/rule.js'
import { battleScopeOf } from '../util/campaign.js'
import { partiesOf } from '../util/campaignRoll.js'
import { warbandEntries } from '../util/warbands.js'
import { moveWarbandsBoardToSite, moveWarbandsSiteToBoard } from './vocabulary.js'
import { choiceSpecsFor, chosen, registerBattlePlan } from './registry.js'
import '../powers/index.js'

const WARNING = 'denizen.nomad.warning-signals'

function warningPower() {
    const power = cardPowers(WARNING)[powerIndexOf(WARNING, PowerTiming.BattlePlan)]
    assertExists(power, 'Warning Signals prints a battle plan')
    return power
}

/**
 * Warning Signals as it was registered before its moves were paired: warbands off ruled sites,
 * warbands off the board, and the one site every board warband went to. A test card, so the two
 * registrations can be put to the same lists.
 */
const ONE_SITE = 'denizen.test.warning-signals-one-site'
registerCards([{ id: ONE_SITE, name: 'One Site', kind: CardKind.Denizen, suit: Suit.Nomad }])
registerCardPowers(ONE_SITE, [{ ...warningPower(), cardId: ONE_SITE, powerIndex: 0 }])
const scopeOf = (state: HydratedOathGameState) => {
    const campaign = state.campaign
    assertExists(campaign, 'a defender plan is used once the Campaign is mustered')
    return battleScopeOf(state, partiesOf(state, campaign))
}
const oldSiteGroups: ChoiceDomain = (state, playerId) =>
    sitesRuledBy(state, playerId, scopeOf(state)).flatMap((siteId) =>
        rulingWarbandOwners(state, playerId, scopeOf(state))
            .map((owner) => ({ owner, free: warbandsFreeToLeave(state, playerId, siteId, owner) }))
            .filter(({ free }) => free > 0)
            .map(({ owner, free }) => ({
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'site' as const, siteId }, owner, count: free }
            }))
    )
const oldBoardGroups: ChoiceDomain = (state, playerId) =>
    warbandEntries(state.getPlayerState(playerId).warbandsOnBoard)
        .filter(([, count]) => count > 0)
        .map(([owner, count]) => ({
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board' as const, playerId }, owner, count }
        }))
registerBattlePlan(ONE_SITE, 0, {
    choices: [
        optional(PowerChoiceKind.Warbands, { domain: oldSiteGroups, max: 16 }),
        optional(PowerChoiceKind.Warbands, { domain: oldBoardGroups, max: 8 }),
        optional(PowerChoiceKind.Site, {
            domain: (state, playerId) =>
                sitesRuledBy(state, playerId, scopeOf(state)).map((siteId) => ({
                    kind: PowerChoiceKind.Site,
                    siteId
                }))
        })
    ],
    hooks: {
        discardAtEnd: true,
        reasonCannotUse: (ctx) => {
            const toSite = chosen(ctx, PowerChoiceKind.Warbands).some(
                ({ group }) => group.at.kind === 'board'
            )
            const [to] = chosen(ctx, PowerChoiceKind.Site)
            if (toSite && !to) return 'name the site you rule the board warbands go to'
            if (!toSite && to) return 'name the board warbands to move to that site'
            return undefined
        },
        onUse: (ctx) => {
            const [to] = chosen(ctx, PowerChoiceKind.Site)
            const notes: string[] = []
            for (const { group } of chosen(ctx, PowerChoiceKind.Warbands)) {
                assertExists(ctx.playerId, 'a declared plan has a user')
                const fromSite = group.at.kind === 'site' ? group.at.siteId : undefined
                const siteId = fromSite ?? to?.siteId
                if (!siteId) continue
                const move = fromSite ? moveWarbandsSiteToBoard : moveWarbandsBoardToSite
                const moved = move(ctx.state, ctx.playerId, group.owner, siteId, group.count)
                notes.push(
                    `${moved} ${fromSite ? `from ${siteId} to the board` : `from the board to ${siteId}`}`
                )
            }
            return `Warning Signals: ${ctx.playerId} moved ${notes.join('; ') || 'nothing'}`
        }
    }
})

/**
 * 'me' campaigns against 'foe' at c1. Foe rules c1 (2), p1 (3) and h1 (1), holds `board` on their
 * board, and has Warning Signals (and the one-site test card) among their advisers.
 */
function defending(board: Record<string, number> = { foe: 2 }): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 3,
                supply: 6,
                warbandsOnBoard: { me: 3 }
            }),
            testPlayer({
                playerId: 'foe',
                color: Color.Blue,
                siteId: 'c1',
                favor: 3,
                warbandsOnBoard: board,
                advisers: [
                    { cardId: WARNING, faceUp: true },
                    { cardId: ONE_SITE, faceUp: true }
                ]
            })
        ],
        { warbandsBySite: { c1: { foe: 2 }, p1: { foe: 3 }, h1: { foe: 1 }, c2: { me: 2 } } }
    )
    openTurn(s, 'me')
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: 'me',
            defender: { kind: 'player', playerId: 'foe' },
            targets: [siteTarget('c1')],
            attackDice: 2
        })
    ).apply(s)
    return s
}

function plan(cardId: string, choices: PowerChoice[]) {
    return { cardId, powerIndex: powerIndexOf(cardId, PowerTiming.BattlePlan), choices }
}

function verdict(
    s: HydratedOathGameState,
    cardId: string,
    choices: PowerChoice[]
): string | undefined {
    return HydratedCampaignDefend.reasonCannotDefend(s, 'foe', [plan(cardId, choices)])
}

function defend(s: HydratedOathGameState, cardId: string, choices: PowerChoice[]) {
    const d = new HydratedCampaignDefend(
        buildAction(CampaignDefend, { playerId: 'foe', plans: [plan(cardId, choices)] })
    )
    d.apply(s)
    return d
}

function where(s: HydratedOathGameState) {
    return { board: s.getPlayerState('foe').warbandsOnBoard, sites: s.warbandsBySite }
}

describe('Warning Signals — moves like Messenger: each warbands, then the site they go to', () => {
    it('moves chain: off a site to the board, then from the board the first move filled to another site', () => {
        const s = defending()
        const choices = [siteWarbands('p1', 'foe', 2), boardWarbands('foe', 'foe', 4), site('h1')]
        expect(verdict(s, WARNING, choices)).toBeUndefined()
        const d = defend(s, WARNING, choices)
        expect(where(s).board['foe'] ?? 0).toBe(0)
        expect(s.warbandsBySite['p1']['foe']).toBe(1)
        expect(s.warbandsBySite['h1']['foe']).toBe(5)
        expect(d.metadata?.planNotes?.[0]).toBe(
            'Warning Signals: foe moved 2 from p1 to the board; 4 from the board to h1'
        )
        expect(s.campaign?.discardAtEnd).toContain(WARNING)
    })

    it('board warbands go to two different sites in one use, and a site sends straight to a site', () => {
        const s = defending()
        const choices = [
            boardWarbands('foe', 'foe', 1),
            site('c1'),
            boardWarbands('foe', 'foe', 1),
            site('h1'),
            siteWarbands('p1', 'foe', 2),
            site('c1')
        ]
        expect(verdict(s, WARNING, choices)).toBeUndefined()
        const d = defend(s, WARNING, choices)
        expect(where(s).board['foe'] ?? 0).toBe(0)
        expect(s.warbandsBySite['c1']['foe']).toBe(5)
        expect(s.warbandsBySite['h1']['foe']).toBe(2)
        expect(s.warbandsBySite['p1']['foe']).toBe(1)
        expect(d.metadata?.planNotes?.[0]).toBe(
            'Warning Signals: foe moved 1 from the board to c1; 1 from the board to h1; 2 from p1 to c1'
        )
    })

    it('each move is offered on the state the moves before it leave', () => {
        const s = defending({})
        expect(legalChoices(s, 'foe', warningPower())[0].options).toEqual([
            siteWarbands('c1', 'foe', 1),
            siteWarbands('p1', 'foe', 2)
        ])
        // After 2 leave p1 for the board, the board holds them and p1 has none free.
        const after = legalChoices(s, 'foe', warningPower(), [siteWarbands('p1', 'foe', 2)])
        expect(after[2].options).toEqual([
            boardWarbands('foe', 'foe', 2),
            siteWarbands('c1', 'foe', 1)
        ])
    })

    it('the last warband stays: a site with one is no source, and no more than the free ones leave', () => {
        const s = defending()
        const sources = legalChoices(s, 'foe', warningPower())[0].options
        expect(sources).toEqual([
            boardWarbands('foe', 'foe', 2),
            siteWarbands('c1', 'foe', 1),
            siteWarbands('p1', 'foe', 2)
        ])
        expect(verdict(s, WARNING, [siteWarbands('h1', 'foe', 1)])).toMatch(/not among the options/)
        expect(verdict(s, WARNING, [siteWarbands('p1', 'foe', 3)])).toMatch(/only 2 are there/)
        // Two moves off one site take no more than its free warbands between them.
        expect(
            verdict(s, WARNING, [
                siteWarbands('p1', 'foe', 2),
                site('h1'),
                siteWarbands('p1', 'foe', 1)
            ])
        ).toBeDefined()
    })

    it('board warbands need a site the defender rules to go to', () => {
        const s = defending()
        expect(verdict(s, WARNING, [boardWarbands('foe', 'foe', 2)])).toMatch(
            /need a site you rule/
        )
        expect(verdict(s, WARNING, [boardWarbands('foe', 'foe', 2), site('c2')])).toMatch(
            /not among the options/
        )
    })

    it('offers 16 moves and no more', () => {
        const specs = choiceSpecsFor(warningPower())
        expect(specs).toHaveLength(32)
        expect(specs.filter((spec) => spec.kind === PowerChoiceKind.Warbands)).toHaveLength(16)
        expect(specs.every((spec) => spec.sequential && spec.min === 0)).toBe(true)
        const s = defending({ foe: 16 })
        const back = (n: number) =>
            Array.from({ length: n }, () => [boardWarbands('foe', 'foe', 1), site('c1')]).flat()
        expect(verdict(s, WARNING, back(16))).toBeUndefined()
        expect(verdict(s, WARNING, back(17))).toMatch(/never asked for/)
        defend(s, WARNING, back(16))
        expect(s.warbandsBySite['c1']['foe']).toBe(18)
    })
})

describe('Warning Signals — a use recorded in the one-site form replays unchanged', () => {
    it('two owners on the board share the one site named after them', () => {
        const choices = [
            boardWarbands('foe', 'foe', 1),
            boardWarbands('foe', IMPERIAL_WARBANDS, 1),
            site('c1')
        ]
        const now = defending({ foe: 2, [IMPERIAL_WARBANDS]: 1 })
        const then = defending({ foe: 2, [IMPERIAL_WARBANDS]: 1 })
        expect(verdict(then, ONE_SITE, choices)).toBeUndefined()
        expect(verdict(now, WARNING, choices)).toBeUndefined()
        const old = defend(then, ONE_SITE, choices)
        const d = defend(now, WARNING, choices)
        expect(where(now)).toEqual(where(then))
        expect(now.warbandsBySite['c1']).toEqual({ foe: 3, [IMPERIAL_WARBANDS]: 1 })
        expect(d.metadata?.planNotes).toEqual(old.metadata?.planNotes)
    })

    it('every list of up to five choices the one-site check accepted is accepted, to the same state and note', () => {
        const ws = [
            siteWarbands('c1', 'foe', 1),
            siteWarbands('p1', 'foe', 2),
            siteWarbands('p1', 'foe', 1),
            boardWarbands('foe', 'foe', 2),
            boardWarbands('foe', 'foe', 3),
            boardWarbands('foe', IMPERIAL_WARBANDS, 1)
        ]
        const ss = [site('c1'), site('h1'), site('c2')]
        let accepted = 0
        const boards: Record<string, number>[] = [{ foe: 2 }, { foe: 2, [IMPERIAL_WARBANDS]: 1 }]
        for (const board of boards) {
            const base = defending(board)
            const visit = (choices: PowerChoice[]) => {
                if (verdict(base, ONE_SITE, choices) === undefined) {
                    accepted += 1
                    expect(verdict(base, WARNING, choices), JSON.stringify(choices)).toBeUndefined()
                    const then = new HydratedOathGameState(base.dehydrate())
                    const now = new HydratedOathGameState(base.dehydrate())
                    const old = defend(then, ONE_SITE, choices)
                    const d = defend(now, WARNING, choices)
                    expect(where(now), JSON.stringify(choices)).toEqual(where(then))
                    expect(d.metadata?.planNotes).toEqual(old.metadata?.planNotes)
                }
                if (choices.length === 5) return
                for (const next of [...ws, ...ss]) visit([...choices, next])
            }
            visit([])
        }
        expect(accepted).toBe(96)
    }, 60_000)
})
