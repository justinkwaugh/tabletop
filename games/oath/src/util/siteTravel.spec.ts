import { describe, expect, it } from 'vitest'
import { Color, getPrng } from '@tabletop/common'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { createOathVault } from '../model/vault.js'
import '../powers/index.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { INN, FILLER } from '../testing/cards.js'

const WOLVES = 'denizen.beast.wolves'

function board(siteCards: Record<string, string>, over: Record<string, unknown> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, supply: 5, warbandsOnBoard: { [Color.Red]: 3 }, ...over }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'p1', favor: 2, secrets: 2, supply: 4, warbandsOnBoard: { [Color.Blue]: 2 } })
        ],
        {
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [] },
            warbandsBySite: { p1: { [Color.Blue]: 2 }, p2: { [Color.Blue]: 1 }, c2: { [Color.Blue]: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', p2: 'site.mine', h1: 'site.mountain', ...siteCards },
            ...state
        }
    )
    openTurn(s, 'me')
    return s
}
const travel = (s: ReturnType<typeof board>, siteId: string, extra: Record<string, unknown> = {}) => {
    const a = new HydratedTravel(buildAction(Travel, { playerId: 'me', siteId, ...extra }))
    a.apply(s)
    return a
}

describe('the site travel layer (R-11.3, R-11.6, R-11.7, R-11.12)', () => {
    it('Coast to Coast is 1; Charming Valley adds 1 to leave; Shrouded Wood is 2 to leave', () => {
        const coast = board({ c1: 'site.barren-coast', h1: 'site.lush-coast' })
        expect(HydratedTravel.plan(coast, 'me', 'h1').cost).toBe(1)
        expect(HydratedTravel.plan(coast, 'me', 'p1').cost).toBe(2)
        const valley = board({ c1: 'site.charming-valley' })
        expect(HydratedTravel.plan(valley, 'me', 'c2').cost).toBe(2)
        const wood = board({ c1: 'site.shrouded-wood' })
        expect(HydratedTravel.plan(wood, 'me', 'h1').cost).toBe(2)
        const a = travel(wood, 'h1')
        expect(a.metadata?.supplySpent).toBe(2)
        expect(a.metadata?.siteNotes?.[0]).toMatch(/Shrouded Wood/)
    })

    it('Buried Giant: a flipped secret makes the Travel free; a flip nowhere asks for is refused', () => {
        const s = board({ c1: 'site.buried-giant' })
        expect(HydratedTravel.plan(s, 'me', 'h1').cost).toBe(4)
        expect(HydratedTravel.plan(s, 'me', 'h1', undefined, undefined, true).cost).toBe(0)
        expect(HydratedTravel.legalTerms(s, 'me', 'h1')).toEqual([{ tolls: [], flipSecret: false }, { tolls: [], flipSecret: true }])
        s.getPlayerState('me').supply = 2
        expect(HydratedTravel.legalTerms(s, 'me', 'h1')).toEqual([{ tolls: [], flipSecret: true }])
        const a = travel(s, 'h1', { flipSecret: true })
        expect(a.metadata?.secretFlipped).toBe(true)
        expect(s.getPlayerState('me')).toMatchObject({ secrets: 1, secretsFacedown: 1, supply: 2 })
        expect(HydratedTravel.reasonCannotTravel(board({}), 'me', 'c2', undefined, undefined, true)).toMatch(/no site here asks/)
        expect(HydratedTravel.reasonCannotTravel(board({ c1: 'site.buried-giant' }, { secrets: 0 }), 'me', 'h1', undefined, undefined, true)).toMatch(/no faceup secret/)
    })
})

describe('R-11.7 — leaving a Shrouded Wood an enemy rules', () => {
    const enemyWood = () => board({ c1: 'site.shrouded-wood' }, {}, { warbandsBySite: { c1: { [Color.Blue]: 1 }, p1: { [Color.Blue]: 2 }, p2: { [Color.Blue]: 1 }, c2: { [Color.Blue]: 1 } } })

    it('names no destination: the Supply is paid and the ruler chooses, ignoring the Narrow Pass', () => {
        const s = enemyWood()
        expect(HydratedTravel.legalDestinations(s, 'me')).toEqual([])
        expect(HydratedTravel.canDoTravel(s, 'me')).toBe(true)
        expect(() => travel(s, 'c2')).toThrow(/Shrouded Wood's ruler chooses/)
        const a = new HydratedTravel(buildAction(Travel, { playerId: 'me' }))
        a.apply(s)
        expect(s.getPlayerState('me')).toMatchObject({ siteId: 'c1', supply: 3 })
        expect(a.metadata?.destinationChooser).toBe('foe')
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'foe', travelerPlayerId: 'me' })

        s.siteCards = { ...s.siteCards, p1: 'site.narrow-pass' }
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'foe', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })).toMatch(/not a site/)
        new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'foe', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'p2' } })).apply(s)
        expect(s.getPlayerState('me').siteId).toBe('p2')
    })

    it('a Wood its traveler rules, or the bandits hold, is left the usual way', () => {
        expect(HydratedTravel.legalDestinations(board({ c1: 'site.shrouded-wood' }, {}, { warbandsBySite: { c1: { [Color.Red]: 1 } } }), 'me')).toContain('c2')
    })
})

describe('Forest Paths and Portal ignore the powers of sites', () => {
    const PORTAL = 'denizen.arcane.portal'
    const PATHS = 'denizen.beast.forest-paths'
    const sites = (c1: string[], c2: string[] = []) => ({ denizensBySite: { c1, c2, p1: [], p2: [], h1: [] } })

    it('Portal: leaving its site, the Narrow Pass of the region entered asks nothing', () => {
        const s = board({ p1: 'site.narrow-pass' }, {}, sites([PORTAL]))
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'p2')).toMatch(/must travel to p1/)
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'p2', [modifierUse(PORTAL)])).toBeUndefined()
    })

    it('Forest Paths: into The Hidden Place with a beast card there, no secret is flipped, and a flip is refused', () => {
        const s = board({ c2: 'site.the-hidden-place' }, {}, sites([PATHS], [WOLVES]))
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'c2')).toMatch(/cannot travel here unless you flip/)
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'c2', [modifierUse(PATHS)])).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'c2', [modifierUse(PATHS)], undefined, true)).toMatch(/no site here asks/)
        expect(HydratedTravel.legalTerms(s, 'me', 'c2', [modifierUse(PATHS)])).toEqual([{ tolls: [], flipSecret: false }])
    })

    it("Portal: Charming Valley's price to leave does not reach the Travel's notes", () => {
        const s = board({ c1: 'site.charming-valley' }, {}, sites([PORTAL]))
        expect(HydratedTravel.plan(s, 'me', 'c2').siteNotes).toEqual(['Charming Valley: one more Supply to leave'])
        expect(HydratedTravel.plan(s, 'me', 'c2', [modifierUse(PORTAL)]).siteNotes).toEqual([])
    })
})

describe('the Narrow Pass and The Hidden Place (R-11.8, R-11.13)', () => {
    it('entering a region with a Narrow Pass, you must travel to it — unless a Coast, the Shrouded Wood or a Buried Giant flip ignores it', () => {
        const s = board({ p1: 'site.narrow-pass' })
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'p2')).toMatch(/must travel to p1/)
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'p1')).toBeUndefined()
        s.getPlayerState('me').siteId = 'p1'
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'p2')).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(board({ p1: 'site.narrow-pass', c1: 'site.shrouded-wood' }), 'me', 'p2')).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(board({ p1: 'site.narrow-pass', c1: 'site.buried-giant' }), 'me', 'p2', undefined, undefined, true)).toBeUndefined()
        // R-11.12, R-X.1 — the flip is offered whatever the Supply, so the bypass lights the site.
        expect(HydratedTravel.legalDestinations(board({ p1: 'site.narrow-pass', c1: 'site.buried-giant' }), 'me')).toContain('p2')
        expect(HydratedTravel.reasonCannotTravel(board({ p1: 'site.narrow-pass', c1: 'site.barren-coast', p2: 'site.lush-coast' }), 'me', 'p2')).toBeUndefined()
    })

    it('The Hidden Place takes a flipped secret to enter or to target, and the flip is its only legal term', () => {
        const s = board({ c2: 'site.the-hidden-place' })
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'c2')).toMatch(/cannot travel here unless you flip/)
        expect(HydratedTravel.reasonCannotTravel(s, 'me', 'c2', undefined, undefined, true)).toBeUndefined()
        expect(HydratedTravel.legalTerms(s, 'me', 'c2')).toEqual([{ tolls: [], flipSecret: true }])
        expect(HydratedTravel.legalDestinations(s, 'me')).toContain('c2')
        expect(HydratedTravel.legalDestinations(board({ c2: 'site.the-hidden-place' }, { secrets: 0 }), 'me')).not.toContain('c2')
        // foe also rules c1, the attacker's site, which R-5.5.2 then requires among the targets.
        const t = board({ c2: 'site.the-hidden-place' }, {}, { warbandsBySite: { c1: { [Color.Blue]: 1 }, c2: { [Color.Blue]: 1 }, p1: { [Color.Blue]: 2 } } })
        const choice = { defender: { kind: 'player' as const, playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.Site as const, siteId: 'c1' }, { kind: CampaignTargetKind.Site as const, siteId: 'c2' }], attackDice: 2 }
        expect(HydratedCampaign.reasonCannotCampaign(t, 'me', choice)).toMatch(/cannot declare targets here unless you flip/)
        expect(HydratedCampaign.reasonCannotCampaign(t, 'me', { ...choice, flipSecret: true })).toBeUndefined()
        new HydratedCampaign(buildAction(Campaign, { playerId: 'me', ...choice, flipSecret: true })).apply(t)
        expect(t.getPlayerState('me')).toMatchObject({ secrets: 1, secretsFacedown: 1 })
    })

    it('The Hidden Place: a pawn target there asks for the flip too, with no site targeted (R-11.13)', () => {
        const s = board({ c1: 'site.the-hidden-place' })
        s.getPlayerState('foe').siteId = 'c1'
        const choice = { defender: { kind: 'player' as const, playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.PawnAndFavor as const }], attackDice: 1 }
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice)).toMatch(/cannot declare targets here unless you flip/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', { ...choice, flipSecret: true })).toBeUndefined()
    })

    it('targeting another region with a Narrow Pass, you must target the pass unless you rule it', () => {
        const s = board({ p1: 'site.narrow-pass' }, {}, { warbandsBySite: { c1: { [Color.Blue]: 1 }, p1: { [Color.Blue]: 2 }, p2: { [Color.Blue]: 1 } } })
        const choice = (siteIds: string[]) => ({ defender: { kind: 'player' as const, playerId: 'foe' }, targets: siteIds.map((siteId) => ({ kind: CampaignTargetKind.Site as const, siteId })), attackDice: 2 })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice(['c1', 'p2']))).toMatch(/must target p1/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice(['c1', 'p1', 'p2']))).toBeUndefined()
    })
})

describe('Great Slum and the relic Homelands (R-11.10, R-11.2)', () => {
    it('Great Slum: a denizen here may be discarded before the site play, freeing its space', () => {
        const s = board({ c1: 'site.great-slums' }, {}, { denizensBySite: { c1: [WOLVES, INN, 'denizen.nomad.tents'], c2: [], p1: [], p2: [], h1: [] } })
        s.getPlayerState('me').handIds = ['denizen.order.wrestlers', 'denizen.hearth.storyteller']
        const play = (extra: Record<string, unknown>) =>
            HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: 'denizen.order.wrestlers', discardOrder: ['denizen.hearth.storyteller'], play: SearchPlay.Site, ...extra })
        expect(play({})).toMatch(/capacity/)
        expect(play({ discardFirstCardId: INN })).toBeUndefined()
        expect(play({ discardFirstCardId: 'denizen.beast.rangers' })).toMatch(/only the Great Slum/)
        const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: 'denizen.order.wrestlers', discardOrder: ['denizen.hearth.storyteller'], play: SearchPlay.Site, discardFirstCardId: INN }))
        a.apply(s)
        expect(s.denizensBySite['c1']).toEqual([WOLVES, 'denizen.nomad.tents', 'denizen.order.wrestlers'])
        expect(a.metadata?.discardedCardIds).toContain(INN)
        const t = board({}, {}, { denizensBySite: { c1: [WOLVES], c2: [], p1: [], p2: [], h1: [] } })
        t.getPlayerState('me').handIds = ['denizen.order.wrestlers', 'denizen.hearth.storyteller']
        expect(HydratedSearchResolve.reasonCannotResolve(t, 'me', { keptCardId: 'denizen.order.wrestlers', discardOrder: ['denizen.hearth.storyteller'], play: SearchPlay.Site, discardFirstCardId: WOLVES })).toMatch(/only the Great Slum/)
    })

    it('Deep Woods: a beast card played here takes the facedown relic, through the vault', () => {
        const s = board({ c1: 'site.deep-woods' }, {}, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] } })
        s.getPlayerState('me').handIds = [WOLVES, FILLER]
        const vault = createOathVault({}, getPrng(3))
        vault.relicFacedown['c1-r1'] = 'relic.cup'
        const action = buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site })
        s.vault = vault
        const a = new HydratedSearchResolve(action)
        a.apply(s)
        expect(a.metadata?.reveal).toEqual({ kind: 'relic', relicCardId: 'relic.cup' })
        expect(s.getPlayerState('me').relicIds).toContain('relic.cup')
        expect(s.relicSlotsAt('c1')).toEqual([])
        expect(a.metadata?.sitePower).toMatch(/took relic.cup/)
        expect(a.revealsInfo).toBe(true)
        const t = board({ c1: 'site.deep-woods' }, {}, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] } })
        t.getPlayerState('me').handIds = [INN, FILLER]
        const b = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: INN, discardOrder: [FILLER], play: SearchPlay.Site }))
        b.apply(t)
        expect(t.relicSlotsAt('c1')).toHaveLength(1)
    })

    it('R-11.2 — the relic is taken on an R-6.1 play to the site, and on a play to another site (the People\'s Favor)', () => {
        const flipped = board({ c1: 'site.deep-woods' }, { advisers: [{ cardId: WOLVES, faceUp: false }] }, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] } })
        flipped.requireVault().relicFacedown['c1-r1'] = 'relic.cup'
        new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'me', cardId: WOLVES, play: SearchPlay.Site })).apply(flipped)
        expect(flipped.getPlayerState('me').relicIds).toContain('relic.cup')
        const remote = board({ c2: 'site.deep-woods' }, {}, { relicsBySite: { c2: [{ slotId: 'c2-r1' }] }, banners: { [Banner.PeoplesFavor]: { holderPlayerId: 'me', value: 2, mobSide: false }, [Banner.DarkestSecret]: { value: 1 } } })
        remote.requireVault().relicFacedown['c2-r1'] = 'relic.cup'
        remote.getPlayerState('me').handIds = [WOLVES, FILLER]
        new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, toSiteId: 'c2' })).apply(remote)
        expect(remote.denizensBySite['c2']).toContain(WOLVES)
        expect(remote.getPlayerState('me').relicIds).toContain('relic.cup')
    })

    it('R-11.2-H1 — the relic a Homeland takes is taken as a Recover takes it, so Relic Thief is asked', () => {
        const RELIC_THIEF = 'denizen.discord.relic-thief'
        const s = board({ c1: 'site.deep-woods' }, {}, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] } })
        const thief = s.getPlayerState('foe')
        thief.siteId = 'c2'
        thief.setAdvisers([{ cardId: RELIC_THIEF, faceUp: true }])
        s.getPlayerState('me').handIds = [WOLVES, FILLER]
        s.requireVault().relicFacedown['c1-r1'] = 'relic.cup'
        const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site }))
        a.apply(s)
        expect(s.getPlayerState('me').relicIds).toContain('relic.cup')
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.RelicThiefRoll, askedPlayerId: 'foe', takerPlayerId: 'me', relicCardIds: ['relic.cup'] })
    })
})
