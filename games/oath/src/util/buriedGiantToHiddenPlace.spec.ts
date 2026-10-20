import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedCampaign } from '../actions/campaign.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from './revision.js'
import { returnSecretsToBoard } from './rest.js'
import '../powers/index.js'

const BURIED_GIANT = 'site.buried-giant'
const HIDDEN_PLACE = 'site.the-hidden-place'
const NARROW_PASS = 'site.narrow-pass'
const TOLL_ROADS = 'denizen.order.toll-roads'
const SPELL_BREAKER = 'denizen.nomad.spell-breaker'
const STORYTELLER = 'denizen.hearth.storyteller'

const atRevision = OathRevision.EngineFixes16
const before = OathRevision.EngineFixes15

/**
 * Dana stands at the Buried Giant (c1) with 5 Supply and 2 faceup secrets; The Hidden Place is h2,
 * in the Hinterland, 4 Supply away. Rhys stands at p1.
 */
function board(
    over: Record<string, unknown> = {},
    siteCards: Record<string, string> = {},
    state: Record<string, unknown> = {},
    oathRevision: number = atRevision
) {
    const s = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, supply: 5, warbandsOnBoard: { dana: 3 }, ...over }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2, secrets: 2, supply: 4, warbandsOnBoard: { rhys: 2 } })
        ],
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [] },
            warbandsBySite: { p1: { rhys: 2 } },
            siteCards: { c1: BURIED_GIANT, c2: 'site.river', p1: 'site.marshes', p2: 'site.mine', h1: 'site.mountain', h2: HIDDEN_PLACE, ...siteCards },
            ...state
        }
    )
    openTurn(s, 'dana')
    return s
}
/** The Travel's verdict and price for Dana. */
const plan = (s: HydratedOathGameState, siteId: string, flipSecret: boolean | 2) => {
    const { reason, cost } = HydratedTravel.plan(s, 'dana', siteId, undefined, undefined, flipSecret)
    return { reason, cost }
}
const travel = (s: HydratedOathGameState, siteId: string, extra: Record<string, unknown> = {}) => {
    const a = new HydratedTravel(buildAction(Travel, { playerId: 'dana', siteId, ...extra }))
    a.apply(s)
    return a
}
const secretsOf = (s: HydratedOathGameState) => {
    const p = s.getPlayerState('dana')
    return { siteId: p.siteId, supply: p.supply, secrets: p.secrets, secretsFacedown: p.secretsFacedown }
}

describe('R-11.13-H2 — from the Buried Giant to The Hidden Place, each site power takes its own flip', () => {
    it('no flip is refused; one satisfies The Hidden Place at the usual Supply; two also make it free', () => {
        const s = board()
        expect(plan(s, 'h2', false).reason).toBe('The Hidden Place: you cannot travel here unless you flip a secret facedown')
        expect(plan(s, 'h2', true)).toEqual({ reason: undefined, cost: 4 })
        expect(plan(s, 'h2', 2)).toEqual({ reason: undefined, cost: 0 })

        const one = travel(s, 'h2', { flipSecret: true })
        expect(secretsOf(s)).toEqual({ siteId: 'h2', supply: 1, secrets: 1, secretsFacedown: 1 })
        expect(one.metadata).toMatchObject({ supplySpent: 4, secretFlipped: true })
        expect(one.metadata?.siteNotes).toBeUndefined()

        const t = board()
        const two = travel(t, 'h2', { flipSecret: 2 })
        expect(secretsOf(t)).toEqual({ siteId: 'h2', supply: 5, secrets: 0, secretsFacedown: 2 })
        expect(two.metadata).toMatchObject({ supplySpent: 0, secretFlipped: 2 })
        expect(two.metadata?.siteNotes?.[0]).toMatch(/^Buried Giant: a secret flipped facedown, no Supply spent/)
    })

    it('one flip leaves the Narrow Pass binding; the second ignores it', () => {
        const s = board({}, { h1: NARROW_PASS })
        expect(plan(s, 'h2', true).reason).toBe('Narrow Pass: travelling into the hinterland, you must travel to h1')
        expect(plan(s, 'h2', 2).reason).toBeUndefined()
        expect(HydratedTravel.legalTerms(s, 'dana', 'h2')).toEqual([{ tolls: [], flipSecret: 2 }])
    })

    it('two flips take two faceup secrets: a facedown secret cannot be flipped (R-7.1.2)', () => {
        const s = board({ secrets: 1, secretsFacedown: 1 })
        expect(plan(s, 'h2', 2).reason).toBe('flipping 2 secrets takes 2 faceup secrets: you have 1')
        expect(() => travel(s, 'h2', { flipSecret: 2 })).toThrow(/takes 2 faceup secrets/)
        expect(plan(s, 'h2', true).reason).toBeUndefined()
        expect(plan(board({ secrets: 0, secretsFacedown: 2 }), 'h2', true).reason).toBe('you have no faceup secret to flip')
    })

    it('each legal count is a way: both with the Supply, only the free one without, none with one secret and no Supply', () => {
        expect(HydratedTravel.legalTerms(board(), 'dana', 'h2')).toEqual([
            { tolls: [], flipSecret: true },
            { tolls: [], flipSecret: 2 }
        ])
        const short = board({ supply: 3 })
        expect(HydratedTravel.legalTerms(short, 'dana', 'h2')).toEqual([{ tolls: [], flipSecret: 2 }])
        expect(HydratedTravel.legalDestinations(short, 'dana')).toContain('h2')
        const poor = board({ supply: 3, secrets: 1 })
        expect(HydratedTravel.legalTerms(poor, 'dana', 'h2')).toEqual([])
        expect(HydratedTravel.legalDestinations(poor, 'dana')).not.toContain('h2')
        // The rest of the map keeps its ways from the Buried Giant: the Supply, or one flip for none.
        expect(HydratedTravel.legalTerms(poor, 'dana', 'h1')).toEqual([{ tolls: [], flipSecret: true }])
    })

    it('from the Buried Giant elsewhere one flip makes the Travel free, as before, and a second is refused', () => {
        const s = board({}, { p1: NARROW_PASS })
        expect(plan(s, 'h1', true)).toEqual({ reason: undefined, cost: 0 })
        expect(plan(s, 'p2', true).reason).toBeUndefined()
        expect(plan(s, 'h1', 2).reason).toBe('one secret at most is flipped here')
        expect(HydratedTravel.legalTerms(s, 'dana', 'h1')).toEqual([
            { tolls: [], flipSecret: false },
            { tolls: [], flipSecret: true }
        ])
    })

    it('to The Hidden Place from elsewhere one flip, at the usual Supply, as before', () => {
        const s = board({}, { c1: 'site.plains' })
        expect(plan(s, 'h2', true)).toEqual({ reason: undefined, cost: 4 })
        expect(plan(s, 'h2', 2).reason).toBe('one secret at most is flipped here')
        expect(HydratedTravel.legalTerms(s, 'dana', 'h2')).toEqual([{ tolls: [], flipSecret: true }])
    })

    it('R-11.7 — leaving a Shrouded Wood ignores The Hidden Place, so no flip is needed and two are refused', () => {
        const s = board({}, { c1: 'site.shrouded-wood' })
        expect(plan(s, 'h2', false)).toEqual({ reason: undefined, cost: 2 })
        expect(plan(s, 'h2', 2).reason).toBe('one secret at most is flipped here')
    })

    it("Spell Breaker — an enemy ruler's Spell Breaker bars both flips (its Q&A names both sites)", () => {
        const s = board()
        s.getPlayerState('rhys').advisers = [{ cardId: SPELL_BREAKER, faceUp: true }]
        expect(plan(s, 'h2', true).reason).toMatch(/^Spell Breaker/)
        expect(plan(s, 'h2', 2).reason).toMatch(/^Spell Breaker/)
        expect(HydratedTravel.legalDestinations(s, 'dana')).not.toContain('h2')
    })

    it("Toll Roads' toll rides along with either count", () => {
        const s = board({}, {}, {
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [TOLL_ROADS] },
            warbandsBySite: { p1: { rhys: 2 }, h2: { rhys: 1 } }
        })
        expect(HydratedTravel.legalTerms(s, 'dana', 'h2')).toEqual([
            { tolls: [TOLL_ROADS], flipSecret: true },
            { tolls: [TOLL_ROADS], flipSecret: 2 }
        ])
        travel(s, 'h2', { tolls: [TOLL_ROADS], flipSecret: 2 })
        expect(secretsOf(s)).toEqual({ siteId: 'h2', supply: 5, secrets: 0, secretsFacedown: 2 })
        expect(s.getPlayerState('dana').favor).toBe(2)
    })

    it("Second Wind's free Travel: one flip is enough where the Narrow Pass does not bind", () => {
        const s = board({ supply: 0 })
        s.getPlayerState('dana').freeTravelAtAction = s.actionCount
        expect(plan(s, 'h2', true)).toEqual({ reason: undefined, cost: 0 })
        expect(plan(s, 'h2', 2)).toEqual({ reason: undefined, cost: 0 })
    })

    it('the Rest turns both flipped secrets faceup again (R-4.3.2)', () => {
        const s = board()
        travel(s, 'h2', { flipSecret: 2 })
        returnSecretsToBoard(s, 'dana')
        expect(s.getPlayerState('dana')).toMatchObject({ secrets: 2, secretsFacedown: 0 })
    })

    it("a Campaign at The Hidden Place after Travelling there takes a flip of its own (its Q&A)", () => {
        const s = board({ secrets: 3 }, {}, { warbandsBySite: { p1: { rhys: 2 }, h2: { rhys: 1 } } })
        travel(s, 'h2', { flipSecret: 2 })
        const choice = { defender: { kind: 'player' as const, playerId: 'rhys' }, targets: [{ kind: CampaignTargetKind.Site as const, siteId: 'h2' }], attackDice: 2 }
        expect(HydratedCampaign.reasonCannotCampaign(s, 'dana', choice)).toMatch(/cannot declare targets here unless you flip/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'dana', { ...choice, flipSecret: true })).toBeUndefined()
    })
})

describe('R-X.4 — before revision 20 one flip serves both sites, as recorded', () => {
    it('one flip makes the Travel free and ignores the Narrow Pass; two are refused', () => {
        const s = board({}, { h1: NARROW_PASS }, {}, before)
        expect(plan(s, 'h2', false).reason).toMatch(/cannot travel here unless you flip/)
        expect(plan(s, 'h2', true)).toEqual({ reason: undefined, cost: 0 })
        expect(plan(s, 'h2', 2).reason).toBe('one secret at most is flipped here')
        expect(HydratedTravel.legalTerms(s, 'dana', 'h2')).toEqual([{ tolls: [], flipSecret: true }])
        const one = travel(s, 'h2', { flipSecret: true })
        expect(secretsOf(s)).toEqual({ siteId: 'h2', supply: 5, secrets: 1, secretsFacedown: 1 })
        expect(one.metadata).toMatchObject({ supplySpent: 0, secretFlipped: true })
    })
})

describe("R-11.13-H2 on the traveller's own view", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    it("the Travel terms and destinations read only Dana's own secrets", () => {
        for (const over of [{}, { supply: 3 }, { supply: 3, secrets: 1 }]) {
            // Rhys holds a facedown adviser and facedown secrets, so Dana's view does not hold everything.
            const s = board(over, { h1: NARROW_PASS })
            Object.assign(s.getPlayerState('rhys'), { advisers: [{ cardId: STORYTELLER, faceUp: false }], secrets: 0, secretsFacedown: 2 })
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const terms = HydratedTravel.legalTerms(s, 'dana', 'h2')
            expect(HydratedTravel.legalTerms(ownView(s), 'dana', 'h2')).toEqual(terms)
            expect(HydratedTravel.legalDestinations(ownView(s), 'dana')).toEqual(HydratedTravel.legalDestinations(s, 'dana'))
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
        expect(HydratedTravel.legalTerms(ownView(board()), 'dana', 'h2')).toEqual([
            { tolls: [], flipSecret: true },
            { tolls: [], flipSecret: 2 }
        ])
    })
})
