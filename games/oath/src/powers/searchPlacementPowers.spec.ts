import { describe, expect, it } from 'vitest'
import { Color, getPrng } from '@tabletop/common'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedRecover, RecoverTargetKind } from '../actions/recover.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { CONSPIRACY_ID } from '../data/cardRegistry.js'
import { isLockedFor } from '../util/locked.js'
import { createOathVault } from '../model/vault.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { warbandsAt } from '../util/rule.js'
import { registerCards } from '../data/cardRegistry.js'
import { CardKind } from '../model/oathEnums.js'
import '../powers/index.js'
import { homelandRelicSlot } from '../util/sitePowers.js'
import { reasonCannotDeclareTargets, type CampaignParties } from '../util/campaign.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { slot } from '../testing/choices.js'
import { type PowerChoice } from '../util/powerChoice.js'
import { buildAction } from '../testing/actions.js'
import { facedown, actionPowerUse, modifierUse, site } from '../testing/choices.js'
import { INN, FILLER } from '../testing/cards.js'

registerCards([{ id: 'site.test-cheap2', name: 'Cheap', kind: CardKind.Site, recoverCost: { kind: 'burnFavor', amount: 1 } }])

const INQUISITOR = 'denizen.arcane.inquisitor'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'
const HORN = 'relic.cracked-horn'
const NEW_GROWTH = 'denizen.beast.new-growth'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'

function board(cards: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { [Color.Red]: 3 }, advisers: [{ cardId: INN, faceUp: true }], ...over['me'] }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { [Color.Blue]: 2 }, advisers: [{ cardId: TENTS, faceUp: false }], ...over['foe'] })
        ],
        {
            denizensBySite: { c1: cards, c2: [WOLVES], p1: [], h1: [] },
            warbandsBySite: { c1: { [Color.Blue]: 2 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...state
        }
    )
    openTurn(s, 'me')
    return s
}

describe('Inquisitor — a peek, and the Conspiracy found there', () => {
    it('an ordinary adviser: peeked, and the favor here given to its holder', () => {
        const s = board([INQUISITOR])
        const a = actionPowerUse('me', INQUISITOR, [facedown('foe', 0)])
        a.apply(s)
        expect(a.metadata?.peeked).toEqual([TENTS])
        expect(s.getPlayerState('foe').favor).toBe(4)
        expect(s.cardTokens[INQUISITOR]).toEqual({ favor: 0, secrets: 0 })
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('the Conspiracy: its finder plays it (to the box) or discards it, through the vault', () => {
        const s = board([INQUISITOR], { foe: { advisers: [{ cardId: CONSPIRACY_ID, faceUp: false }] } })
        actionPowerUse('me', INQUISITOR, [facedown('foe', 0)]).apply(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.PlayOrDiscardConspiracy, askedPlayerId: 'me', holderPlayerId: 'foe' })
        const play = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: true } }))
        play.apply(s)
        expect(s.getPlayerState('foe').knownAdvisers()).toEqual([])
        expect(s.boxIds).toContain(CONSPIRACY_ID)
        const t = board([INQUISITOR], { foe: { advisers: [{ cardId: CONSPIRACY_ID, faceUp: false }] } })
        actionPowerUse('me', INQUISITOR, [facedown('foe', 0)]).apply(t)
        const discard = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: false } }))
        discard.apply(t)
        expect(t.getPlayerState('foe').advisers).toEqual([])
        expect(discard.metadata?.discardedCardIds).toEqual([CONSPIRACY_ID])
        expect(discard.metadata?.discardPileRegion).toBe(Region.Provinces)
        expect(discard.revealsInfo).toBe(true)
    })
})

describe('Ancient Bloodline — locked, for enemies, at the sites you rule', () => {
    it("the ruler's enemies see the cards and relics there as locked; the ruler and friends do not", () => {
        const s = board([], { me: { advisers: [{ cardId: BLOODLINE, faceUp: true }] } }, { relicsBySite: { c2: [{ slotId: 'c2-r1' }] }, siteCards: { c1: 'site.plains', c2: 'site.test-cheap2', p1: 'site.marshes', h1: 'site.mountain' } })
        expect(isLockedFor(s, 'foe', WOLVES)).toBe(true)
        expect(isLockedFor(s, 'me', WOLVES)).toBe(false)
        expect(isLockedFor(s, 'foe', TENTS)).toBe(false)
        s.getPlayerState('foe').siteId = 'c2'
        expect(HydratedRecover.reasonCannotRecover(s, 'foe', { target: { kind: RecoverTargetKind.Relic as const, slotId: 'c2-r1' } })).toMatch(/locked for you/)
    })

    it("its relics are locked to every take: Relic Breaker, a Homeland relic, Relic Hunter's targets", () => {
        const BREAKER = 'denizen.hearth.relic-breaker'
        const s = board([], { me: { advisers: [{ cardId: BLOODLINE, faceUp: true }] }, foe: { siteId: 'c2', advisers: [{ cardId: BREAKER, faceUp: true }] } }, { relicsBySite: { c2: [{ slotId: 'c2-r1' }] }, siteCards: { c1: 'site.plains', c2: 'site.deep-woods', p1: 'site.marshes', h1: 'site.mountain' } })
        expect(HydratedUseActionPower.reasonCannotUse(s, 'foe', BREAKER, powerIndexOf(BREAKER, PowerTiming.Action), [slot('c2-r1')])).toMatch(/not among the options/)
        expect(homelandRelicSlot(s, 'foe', WOLVES, 'c2')).toBeUndefined()
        s.getPlayerState('me').siteId = 'c2'
        expect(homelandRelicSlot(s, 'me', WOLVES, 'c2')).toBe('c2-r1')
        const parties: CampaignParties = { attackerPlayerId: 'foe', defenderPlayerId: 'me', allyPlayerIds: [], nonImperialPlayerIds: [], targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }, { kind: CampaignTargetKind.SiteRelic, slotId: 'c2-r1' }] }
        expect(reasonCannotDeclareTargets(s, parties)).toMatch(/Ancient Bloodline/)
    })
})

describe('Cracked Horn and New Growth — where discards and plays may go', () => {
    it('Cracked Horn sends the discards under the world deck, and the vault replays them there', () => {
        const s = board([], { me: { relicIds: [HORN] } })
        const search = new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(HORN)] }))
        s.requireVault().worldDeck = [TENTS, FILLER]
        search.apply(s)
        const piles = { ...s.discardPileCounts }
        const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }))
        const vault = createOathVault({ worldDeck: [INN] }, getPrng(1))
        s.vault = vault
        a.apply(s)
        expect(a.metadata?.discardToWorldDeck).toBe(true)
        expect(s.discardPileCounts).toEqual(piles)
        expect(s.worldDeckExhausted).toBe(false)
        expect(vault.worldDeck).toEqual([INN, FILLER])
    })

    it('Cracked Horn under an exhausted deck makes the first discard its public top back (R-9.4)', () => {
        const s = board([], { me: { relicIds: [HORN] } })
        const search = new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(HORN)] }))
        s.requireVault().worldDeck = [TENTS, FILLER]
        search.apply(s)
        expect(s.worldDeckExhausted).toBe(true)
        expect(s.topCardBackType).toBeUndefined()
        new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true })).apply(s)
        expect(s.worldDeckExhausted).toBe(false)
        expect(s.topCardBackType).toBe(CardKind.Denizen)
    })

    it('New Growth: a beast or hearth card may be played to another site with room, and gains its favor there', () => {
        const s = board([], {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        s.requireVault().worldDeck = [WOLVES, TENTS]
        const search = new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(NEW_GROWTH)] }))
        s.getPlayerState('me').addAdviser(NEW_GROWTH, true)
        search.apply(s)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: TENTS, discardOrder: [WOLVES], play: SearchPlay.Site, toSiteId: 'p1' })).toMatch(/only be played to your own site/)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: WOLVES, discardOrder: [TENTS], play: SearchPlay.Site, toSiteId: 'p1' })).toBeUndefined()
        const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [TENTS], play: SearchPlay.Site, toSiteId: 'p1' }))
        a.apply(s)
        expect(s.denizensBySite['p1']).toEqual([WOLVES])
        expect(s.denizensBySite['c1']).toEqual([])
        expect(a.metadata?.favorGained).toBe(1)
        const t = board([], {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        t.getPlayerState('me').handIds = [WOLVES, TENTS]
        expect(HydratedSearchResolve.reasonCannotResolve(t, 'me', { keptCardId: WOLVES, discardOrder: [TENTS], play: SearchPlay.Site, toSiteId: 'p1' })).toMatch(/only be played to your own site/)
    })

    it('New Growth to a remote site: a card is discarded first only at a Great Slum played to, and never a locked one (R-11.10, R-7.2.2)', () => {
        const growing = (siteCards: Record<string, string>, atP1: string[]) => {
            const s = board([], {}, { denizensBySite: { c1: [INN], c2: [], p1: atP1, h1: [] }, siteCards: { c1: 'site.great-slums', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain', ...siteCards } })
            s.requireVault().worldDeck = [WOLVES, TENTS]
            s.getPlayerState('me').addAdviser(NEW_GROWTH, true)
            new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(NEW_GROWTH)] })).apply(s)
            return s
        }
        const play = (s: ReturnType<typeof board>, first: string) => HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: WOLVES, discardOrder: [TENTS], play: SearchPlay.Site, toSiteId: 'p1', discardFirstCardId: first })
        // The Great Slum is where the pawn stands, not where the card goes.
        expect(play(growing({}, ['denizen.order.scouts']), 'denizen.order.scouts')).toMatch(/only the Great Slum/)
        expect(play(growing({}, ['denizen.order.scouts']), INN)).toMatch(/only the Great Slum/)
        const slum = growing({ p1: 'site.great-slums' }, ['denizen.order.scouts', 'denizen.beast.forest-council'])
        expect(play(slum, 'denizen.order.scouts')).toBeUndefined()
        expect(play(slum, 'denizen.beast.forest-council')).toMatch(/locked/)
    })
})

describe('Land Warden and Warning Signals', () => {
    it('Land Warden: two of the drawn cards are played when one goes to a site; the rest are discarded', () => {
        const LAND_WARDEN = 'denizen.hearth.land-warden'
        const s = board([], { me: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] } }, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        s.requireVault().worldDeck = [WOLVES, TENTS, FILLER]
        new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })).apply(s)
        const second = { cardId: TENTS, play: SearchPlay.Adviser, faceUp: true }
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true, secondPlay: second })).toMatch(/at least one .* to a site/)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: WOLVES, discardOrder: [FILLER, TENTS], play: SearchPlay.Site, secondPlay: second })).toMatch(/must discard exactly/)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: second })).toBeUndefined()
        const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: second }))
        a.apply(s)
        expect(s.denizensBySite['c1']).toEqual([WOLVES])
        expect(s.getPlayerState('me').advisers.map((x) => x.cardId)).toContain(TENTS)
        expect(a.metadata?.discardedCardIds).toEqual([FILLER])
        expect(a.metadata?.secondPlayedCardId).toBe(TENTS)
        const t = board([], {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        t.getPlayerState('me').handIds = [WOLVES, TENTS, FILLER]
        expect(HydratedSearchResolve.reasonCannotResolve(t, 'me', { keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: second })).toMatch(/only one drawn card/)
    })

    it('Warning Signals: the defender moves warbands off a ruled site (never the last) and onto one from the board, then discards it', () => {
        const WARNING = 'denizen.nomad.warning-signals'
        // foe starts with 2 blue at c1, 3 at p1 and 2 on the board.
        const s = board([WARNING])
        new HydratedCampaign(buildAction(Campaign, { playerId: 'me', defender: { kind: 'player', playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2 })).apply(s)
        expect(s.campaign?.pendingDefenderPlans).toBeDefined()
        const d = new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'foe', plans: [{ cardId: WARNING, powerIndex: powerIndexOf(WARNING, PowerTiming.BattlePlan), choices: [
            { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'site', siteId: 'p1' }, color: Color.Blue, count: 2 } },
            { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'board', playerId: 'foe' }, color: Color.Blue, count: 1 } },
            site('c1')
        ] }] }))
        d.apply(s)
        expect(warbandsAt(s, 'p1')[Color.Blue]).toBe(1)
        expect(warbandsAt(s, 'c1')[Color.Blue]).toBe(3)
        expect(s.getPlayerState('foe').warbandsOnBoard[Color.Blue]).toBe(3)
        expect(s.campaign?.discardAtEnd).toContain(WARNING)
        expect(d.metadata?.planNotes?.[0]).toMatch(/Warning Signals/)
    })

    it('Warning Signals: "any warbands" — a board-to-site move alone, and moves off several sites', () => {
        const WARNING = 'denizen.nomad.warning-signals'
        const defendWith = (choices: PowerChoice[]) => {
            const s = board([WARNING])
            new HydratedCampaign(buildAction(Campaign, { playerId: 'me', defender: { kind: 'player', playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2 })).apply(s)
            new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'foe', plans: [{ cardId: WARNING, powerIndex: powerIndexOf(WARNING, PowerTiming.BattlePlan), choices }] })).apply(s)
            return s
        }
        const alone = defendWith([{ kind: PowerChoiceKind.Warbands, group: { at: { kind: 'board', playerId: 'foe' }, color: Color.Blue, count: 2 } }, site('c1')])
        expect(warbandsAt(alone, 'c1')[Color.Blue]).toBe(4)
        expect(alone.getPlayerState('foe').warbandsOnBoard[Color.Blue]).toBe(0)
        const both = defendWith([
            { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'site', siteId: 'c1' }, color: Color.Blue, count: 1 } },
            { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'site', siteId: 'p1' }, color: Color.Blue, count: 2 } }
        ])
        expect(warbandsAt(both, 'c1')[Color.Blue]).toBe(1)
        expect(warbandsAt(both, 'p1')[Color.Blue]).toBe(1)
        expect(both.getPlayerState('foe').warbandsOnBoard[Color.Blue]).toBe(5)
    })
})
