import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign } from './campaign.js'
import { HydratedCampaignDefend } from './campaignDefend.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { ongoingCampaign } from '../testing/required.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse } from '../testing/choices.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const ZEALOTS = 'denizen.discord.zealots'
const SLANDER = 'denizen.discord.slander'
const SCOUTS = 'denizen.order.scouts'
const OUTRIDERS = 'denizen.order.outriders'
const FIRE_TALKERS = 'denizen.arcane.fire-talkers'
const SECOND_WIND = 'denizen.discord.second-wind'
const CRACKED_SAGE = 'denizen.discord.cracked-sage'
const SHIELD_WALL = 'denizen.order.shield-wall'
const PROVISIONS = 'denizen.hearth.extra-provisions'
const ARMOR = 'denizen.arcane.gleaming-armor'
const SWARM = 'denizen.beast.insect-swarm'
const VOW = 'denizen.discord.vow-of-renewal'

const atRevision = OathRevision.PlanCostsAndSearchPlays
const before = OathRevision.CostsAndFacedownModifiers

/** `att` campaigns from c1 against `def`, who rules it. */
function board(
    oathRevision: number,
    advisers: { att?: string[]; def?: string[] },
    holding: { att?: { favor: number; secrets: number }; def?: { favor: number; secrets: number } },
    siteCard = 'site.plains'
) {
    const adv = (ids: string[] = []) => ids.map((cardId) => ({ cardId, faceUp: true }))
    const s = testState(
        [
            testPlayer({ playerId: 'att', color: Color.Blue, siteId: 'c1', supply: 5, warbandsOnBoard: { att: 3 }, advisers: adv(advisers.att), ...(holding.att ?? { favor: 4, secrets: 3 }) }),
            testPlayer({ playerId: 'def', color: Color.Red, siteId: 'c1', supply: 5, warbandsOnBoard: { def: 4 }, advisers: adv(advisers.def), ...(holding.def ?? { favor: 4, secrets: 3 }) })
        ],
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { def: 1 } },
            siteCards: { c1: siteCard, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            discardPileCounts: { cradle: 2, provinces: 2, hinterland: 2 }
        }
    )
    openTurn(s, 'att')
    return s
}

function choice(plans: string[], over: Record<string, unknown> = {}) {
    return {
        defender: { kind: 'player' as const, playerId: 'def' },
        targets: [{ kind: CampaignTargetKind.Site as const, siteId: 'c1' }],
        attackDice: 2,
        plans: plans.map((id) => battlePlanUse(id)) as BattlePlanUse[],
        ...over
    }
}

const reason = (s: ReturnType<typeof board>, plans: string[], over: Record<string, unknown> = {}) =>
    HydratedCampaign.reasonCannotCampaign(s, 'att', choice(plans, over))

const campaign = (plans: string[], over: Record<string, unknown> = {}) =>
    new HydratedCampaign(buildAction(Campaign, { playerId: 'att', ...choice(plans, over) }))

describe('R-7.1.2 — a side’s battle-plan costs are paid in order from one holding (revision 3)', () => {
    it('two plans of a favor each, with one favor held, are refused with the total', () => {
        const s = board(atRevision, { att: [ZEALOTS, SLANDER] }, { att: { favor: 1, secrets: 3 } })
        expect(reason(s, [ZEALOTS, SLANDER])).toBe('your battle plans cost 2 favor in all, you hold 1')
        expect(reason(s, [ZEALOTS])).toBeUndefined()
    })

    it('Gleaming Armor: its secret is added to each plan, so two free plans with one secret are refused', () => {
        const s = board(atRevision, { att: [SCOUTS, OUTRIDERS], def: [ARMOR] }, { att: { favor: 4, secrets: 1 } })
        expect(reason(s, [SCOUTS, OUTRIDERS])).toBe('your battle plans cost 2 secrets in all, you hold 1')
        expect(reason(s, [SCOUTS])).toBeUndefined()
    })

    it('Insect Swarm: its burned favor is added to each plan', () => {
        const s = board(atRevision, { att: [SCOUTS, OUTRIDERS], def: [SWARM] }, { att: { favor: 1, secrets: 3 } })
        expect(reason(s, [SCOUTS, OUTRIDERS])).toBe('your battle plans cost 2 favor in all, you hold 1')
    })

    it('The Hidden Place: the secret flipped to target there is not there to pay a plan', () => {
        const s = board(atRevision, { att: [FIRE_TALKERS] }, { att: { favor: 4, secrets: 1 } }, 'site.the-hidden-place')
        expect(reason(s, [FIRE_TALKERS], { flipSecret: true })).toBe('your battle plans cost 2 secrets in all, you hold 1')
        expect(reason(s, [], { flipSecret: true })).toBeUndefined()
    })

    it('plans in two resources pass when each is held', () => {
        const s = board(atRevision, { att: [ZEALOTS, FIRE_TALKERS] }, { att: { favor: 1, secrets: 1 } })
        expect(reason(s, [ZEALOTS, FIRE_TALKERS])).toBeUndefined()
        campaign([ZEALOTS, FIRE_TALKERS]).apply(s)
        expect(s.getPlayerState('att').favor).toBe(0)
        expect(s.getPlayerState('att').secrets).toBe(0)
    })

    it('Vow of Renewal: a burn its payer takes straight back pays the next plan too', () => {
        const s = board(atRevision, { att: [VOW, SECOND_WIND, CRACKED_SAGE] }, { att: { favor: 1, secrets: 2 } })
        expect(reason(s, [SECOND_WIND, CRACKED_SAGE])).toBeUndefined()
        campaign([SECOND_WIND, CRACKED_SAGE]).apply(s)
        expect(s.getPlayerState('att').favor).toBe(1)
        expect(s.getPlayerState('att').secrets).toBe(0)
    })

    it('Vow of Renewal returns a burn, not a placed favor: the plan placed before a burn still counts', () => {
        const s = board(atRevision, { att: [VOW, ZEALOTS, SECOND_WIND] }, { att: { favor: 1, secrets: 2 } })
        expect(reason(s, [ZEALOTS, SECOND_WIND])).toBe('your battle plans cost 2 favor in all, you hold 1')
        expect(reason(s, [SECOND_WIND, ZEALOTS])).toBeUndefined()
    })

    it('another player’s Vow of Renewal takes the burn away: the payer needs a favor for each', () => {
        const s = board(atRevision, { att: [SECOND_WIND, CRACKED_SAGE], def: [VOW] }, { att: { favor: 1, secrets: 2 } })
        expect(reason(s, [SECOND_WIND, CRACKED_SAGE])).toBe('your battle plans cost 2 favor in all, you hold 1')
    })

    it('the defender: two plans of a favor each, with one favor held, are refused', () => {
        const s = board(atRevision, { def: [PROVISIONS, SHIELD_WALL] }, { def: { favor: 1, secrets: 0 } })
        campaign([]).apply(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual(['def'])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'def', [battlePlanUse(PROVISIONS), battlePlanUse(SHIELD_WALL)])).toBe(
            'your battle plans cost 2 favor in all, you hold 1'
        )
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'def', [battlePlanUse(PROVISIONS)])).toBeUndefined()
    })
})

describe('R-X.4 — before revision 3 each plan is checked alone, as recorded', () => {
    it('two plans of a favor each with one favor are accepted, and the second payment throws', () => {
        const s = board(before, { att: [ZEALOTS, SLANDER] }, { att: { favor: 1, secrets: 3 } })
        expect(reason(s, [ZEALOTS, SLANDER])).toBeUndefined()
        expect(() => campaign([ZEALOTS, SLANDER]).apply(s)).toThrow('Cannot pay power cost: costs 1 favor, player has 0')
    })

    it('replay: Gleaming Armor on two free plans with one secret leaves the attacker at -1 secrets', () => {
        const s = board(before, { att: [SCOUTS, OUTRIDERS], def: [ARMOR] }, { att: { favor: 4, secrets: 1 } })
        expect(reason(s, [SCOUTS, OUTRIDERS])).toBeUndefined()
        campaign([SCOUTS, OUTRIDERS]).apply(s)
        expect(s.getPlayerState('att').secrets).toBe(-1)
        expect(s.tokensOn(SCOUTS).secrets).toBe(1)
        expect(s.tokensOn(OUTRIDERS).secrets).toBe(1)
    })
})
