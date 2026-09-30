import { describe, expect, it } from 'vitest'
import { Color, getPrng } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedMoveWarbands } from '../actions/moveWarbands.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedRecover, RecoverTargetKind } from '../actions/recover.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PowerQuestionKind } from '../model/question.js'
import { createOathVault, type OathVault } from '../model/vault.js'
import { testPlayer, testState, openTurn, testVaultWithRelics } from '../testing/fixture.js'
import { type PowerChoice } from '../util/powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { MAX_SUPPLY } from '../util/rest.js'
import { collectDefensePool } from '../util/campaign.js'
import { warbandsAt } from '../util/rule.js'
import '../powers/index.js'
import { cardPowers } from '../data/cardPowers.js'
import { PowerChoiceKind, legalChoices } from '../util/powerChoice.js'
import { askQuestion } from '../util/questions.js'
import { reasonCannotPlayConspiracy } from '../util/cardPlay.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { OathRuntime } from '../definition/runtime.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { card, facedown, player, site, slot, actionPowerUse, battlePlanUse, modifierUse } from '../testing/choices.js'
import { INN, FILLER } from '../testing/cards.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

/** R-7.1.1-H1 — a held relic grants access the way an adviser does. */

const MAP = 'relic.map'
const DRUM = 'relic.dragonskin-drum'
const CUP = 'relic.cup-of-plenty'
const RING = 'relic.ring-of-devotion'
const RETURN = 'denizen.hearth.awaited-return'

function board(relics: string[], cards: string[] = [], advisers: string[] = [], over: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 2,
                relicIds: relics,
                warbandsOnBoard: { ruler: 3 },
                warbandsInPersonalBank: { ruler: 5 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true })),
                ...over
            }),
            testPlayer({ playerId: 'other', color: Color.Blue, siteId: 'c2' })
        ],
        {
            denizensBySite: { c1: cards, c2: [], p1: [] },
            warbandsBySite: { c1: { ruler: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains' }
        }
    )
    openTurn(s, 'ruler')
    return s
}

describe('the Map (Action)', () => {
    it('leaves the player, gains 4 Supply capped at the track, and the commit puts it on the deck bottom', () => {
        const s = board([MAP])
        const action = actionPowerUse('ruler', MAP)
        const vault = testVaultWithRelics({})
        vault.relicDeck = ['relic.a', 'relic.b']
        s.vault = vault
        action.apply(s)
        expect(s.getPlayerState('ruler').relicIds).toEqual([])
        expect(s.getPlayerState('ruler').supply).toBe(Math.min(MAX_SUPPLY, 2 + 4))
        expect(action.metadata?.relicToDeckBottom).toBe(MAP)
        expect(action.revealsInfo).toBe(true)

        expect(vault.relicDeck).toEqual(['relic.a', 'relic.b', MAP])
    })

    it('is refused to a player who does not hold it', () => {
        const s = board([])
        const action = actionPowerUse('ruler', MAP)
        expect(() => action.apply(s)).toThrow(/neither rule/)
    })
})

describe('Dragonskin Drum (Travel modifier)', () => {
    it('gains a warband after travelling, at the ordinary Supply cost', () => {
        const s = board([DRUM])
        const travel = new HydratedTravel(
            buildAction(Travel, {
                playerId: 'ruler',
                siteId: 'c2',
                modifiers: [modifierUse(DRUM)]
            })
        )
        travel.apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)
        expect(s.getPlayerState('ruler').supply).toBe(1)
        expect(travel.metadata?.modifierNotes?.[0]).toMatch(/Dragonskin Drum/)
    })
})

describe('Cup of Plenty (Trade modifier)', () => {
    it('waives Supply when the card matches an adviser, refused otherwise', () => {
        const s = board([CUP], [INN], [RETURN])
        new HydratedTrade(
            buildAction(Trade, {
                playerId: 'ruler',
                cardId: INN,
                option: TradeOption.ForFavor,
                modifiers: [modifierUse(CUP)]
            })
        ).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(2)

        expect(
            HydratedTrade.reasonCannotTrade(board([CUP], [INN]), 'ruler', INN, TradeOption.ForFavor, [
                modifierUse(CUP)
            ])
        ).toMatch(/matches none of your advisers/)
    })
})

describe('Ring of Devotion (continuous)', () => {
    it('adds two warbands to a Muster', () => {
        const s = board([RING], [INN])
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(3 + 4)
        const plain = board([], [INN])
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(plain)
        expect(plain.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(5)
    })

    it('forbids moving warbands from the board to a site, but not the reverse', () => {
        const s = board([RING])
        expect(
            HydratedMoveWarbands.reasonCannotMove(s, 'ruler', { move: { kind: WarbandMoveKind.BoardToSite }, owner: 'ruler', count: 1 })
        ).toMatch(/Ring of Devotion/)
        expect(
            HydratedMoveWarbands.reasonCannotMove(board([]), 'ruler', { move: { kind: WarbandMoveKind.BoardToSite }, owner: 'ruler', count: 1 })
        ).toBeUndefined()
    })
})

const DOWSING = 'relic.dowsing-sticks'
const HORNED = 'relic.horned-mask'
const PIG = 'relic.oracular-pig'
const WHISTLE = 'relic.whistle'
const KEY = 'relic.skeleton-key'
const EYE = 'relic.ivory-eye'
const HARP = 'relic.truthful-harp'
const BOOK = 'relic.book-of-records'
const CAULDRON = 'relic.cursed-cauldron'
const FIRE = 'relic.sticky-fire'
const CIRCLET = 'relic.circlet-of-command'
const TENTS = 'denizen.nomad.tents'
const WOLVES = 'denizen.beast.wolves'

function relicBoard(relics: string[], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, relicIds: relics, warbandsOnBoard: { me: 4 }, warbandsInPersonalBank: { me: 6 }, advisers: [{ cardId: INN, faceUp: true }], ...over['me'] }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { foe: 2 }, warbandsInPersonalBank: { foe: 5 }, advisers: [{ cardId: TENTS, faceUp: false }], ...over['foe'] }),
            testPlayer({ playerId: 'far', color: Color.Yellow, siteId: 'h1', favor: 2, secrets: 2, ...over['far'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 2, secrets: 2, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }, ...over['chan'] })
        ],
        {
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [WOLVES], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { foe: 2 }, c2: { me: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            reliquary: [{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }],
            ...state
        }
    )
    openTurn(s, 'me')
    return s
}
function use(s: ReturnType<typeof relicBoard>, cardId: string, choices?: PowerChoice[], seed?: (vault: OathVault) => void) {
    seed?.(s.requireVault())
    const a = actionPowerUse('me', cardId, choices)
    a.apply(s)
    return a
}

describe('the peeking and taking relics', () => {
    it('Dowsing Sticks draws and asks; Oracular Pig peeks at three', () => {
        const s = relicBoard([DOWSING, PIG])
        const a = use(s, DOWSING, undefined, (vault) => { vault.relicDeck = ['relic.cup'] })
        expect(a.metadata?.peeked).toEqual(['relic.cup'])
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic, askedPlayerId: 'me', relicCardId: 'relic.cup' })
        expect(s.getPlayerState('me')).toMatchObject({ favor: 2, secrets: 2 })
        s.pendingQuestions = undefined
        const b = use(s, PIG, undefined, (vault) => { vault.worldDeck = [INN, TENTS, WOLVES] })
        expect(b.metadata?.peeked).toEqual([INN, TENTS, WOLVES])
    })

    it("Skeleton Key: with the Chancellor ruling your site, a Reliquary relic is seen and may be taken — uncovering the space", () => {
        const s = relicBoard([KEY], {}, { warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1, foe: 2 }, c2: { me: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 } } })
        expect(HydratedUseActionPower.reasonCannotUse(relicBoard([KEY]), 'me', KEY, powerIndexOf(KEY, PowerTiming.Action), [slot('reliquary.0')])).toMatch(/Chancellor does not rule/)
        const a = use(s, KEY, [slot('reliquary.0')], (vault) => { vault.relicFacedown['reliquary.0'] = 'relic.cup' })
        expect(a.metadata?.peeked).toEqual(['relic.cup'])
        expect(s.reliquarySlots()[0]).toEqual({ slotId: 'reliquary.0' })
        expect(s.getPlayerState('me').peekedRelics).toEqual({ 'reliquary.0': 'relic.cup' })
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.TakeOrLeaveRelic, slotId: 'reliquary.0', relicCardId: 'relic.cup' })
        new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.TakeOrLeaveRelic, take: true } })).apply(s)
        expect(s.getPlayerState('me').relicIds).toContain('relic.cup')
        expect(s.reliquarySlots().map((r) => r.slotId)).toEqual(['reliquary.1'])
    })

    it('Ivory Eye peeks at one of three kinds of thing; a facedown site comes through the vault and stays facedown', () => {
        const s = relicBoard([EYE], {}, { relicsBySite: { c2: [{ slotId: 'c2-r1' }] } })
        expect(HydratedUseActionPower.reasonCannotUse(s, 'me', EYE, powerIndexOf(EYE, PowerTiming.Action), [])).toMatch(/exactly one/)
        expect(HydratedUseActionPower.reasonCannotUse(s, 'me', EYE, powerIndexOf(EYE, PowerTiming.Action), [facedown('foe', 0), slot('c2-r1')])).toMatch(/exactly one/)
        expect(use(s, EYE, [facedown('foe', 0)]).metadata?.peeked).toEqual([TENTS])
        const t = relicBoard([EYE], {}, { relicsBySite: { c2: [{ slotId: 'c2-r1' }] } })
        use(t, EYE, [slot('c2-r1')], (vault) => { vault.relicFacedown['c2-r1'] = 'relic.cup' })
        expect(t.relicSlotsAt('c2')[0]).toEqual({ slotId: 'c2-r1' })
        expect(t.getPlayerState('me').peekedRelics).toEqual({ 'c2-r1': 'relic.cup' })
        const u = relicBoard([EYE], {}, { siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes' } })
        const vault = createOathVault({ siteFacedown: { h1: 'site.mountain' } }, getPrng(1))
        const action = buildAction(UseActionPower, { playerId: 'me', cardId: EYE, powerIndex: powerIndexOf(EYE, PowerTiming.Action), choices: [site('h1')] })
        u.vault = vault
        const a = new HydratedUseActionPower(action)
        a.apply(u)
        expect(a.metadata?.reveal).toEqual({ kind: 'site', siteCardId: 'site.mountain' })
        expect(a.metadata?.peeked).toEqual(['site.mountain'])
        expect(u.isSiteFaceup('h1')).toBe(false)
        expect(u.getPlayerState('me').peekedSiteSlotIds).toEqual(['h1'])
    })
})

describe('the moving relics', () => {
    it('Horned Mask swaps an adviser with a card at your site; Whistle summons a pawn and gives them the secret', () => {
        const horned = (adviser: string, atSite: string) => {
            const t = relicBoard([HORNED], { me: { advisers: [{ cardId: adviser, faceUp: true }] } }, { denizensBySite: { c1: [atSite], c2: [], p1: [], h1: [] } })
            return HydratedUseActionPower.reasonCannotUse(t, 'me', HORNED, powerIndexOf(HORNED, PowerTiming.Action), [card(adviser), card(atSite)])
        }
        // R-7.2.2 — a locked adviser stays; R-7.2.1 — an adviser-only card never goes to a site, a site-only card never to the advisers.
        expect(horned('denizen.nomad.faithful-friend', WOLVES)).toMatch(/not among the options/)
        expect(horned('denizen.hearth.charming-friend', WOLVES)).toMatch(/not among the options/)
        expect(horned(INN, 'denizen.hearth.ballot-box')).toMatch(/not among the options/)
        expect(horned(INN, WOLVES)).toBeUndefined()
        const s = relicBoard([HORNED, WHISTLE])
        use(s, HORNED, [card(INN), card(WOLVES)])
        expect(s.denizensBySite['c1']).toEqual([INN])
        expect(s.getPlayerState('me').advisers.map((a) => a.cardId)).toEqual([WOLVES])
        expect(HydratedUseActionPower.reasonCannotUse(s, 'me', WHISTLE, powerIndexOf(WHISTLE, PowerTiming.Action), [player('foe')])).toMatch(/not among the options/)
        use(s, WHISTLE, [player('far')])
        expect(s.getPlayerState('far').siteId).toBe('c1')
        expect(s.getPlayerState('far').secrets).toBe(3)
        expect(s.cardTokens[WHISTLE]).toEqual({ favor: 0, secrets: 0 })
    })
})

describe('the Search relics', () => {
    it('Truthful Harp draws two more; Book of Records turns the site play’s favor into a secret', () => {
        const s = relicBoard([HARP, BOOK])
        expect(HydratedSearch.drawCount(s, 'me', [modifierUse(HARP)])).toBe(5)
        s.requireVault().worldDeck = [TENTS, FILLER]
        const search = new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true }))
        search.apply(s)
        expect(s.pendingSearchModifiers?.map((m) => m.cardId)).toContain(BOOK)
        const favor = s.getPlayerState('me').favor
        const play = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Site }))
        play.apply(s)
        expect(s.getPlayerState('me').favor).toBe(favor)
        expect(s.getPlayerState('me').secrets).toBe(4)
        expect(play.metadata?.favorGained ?? 0).toBe(0)
    })
})

describe('Truthful Harp — "you must reveal every card you draw and the card you keep"', () => {
    const harp = [modifierUse(HARP)]
    const spectator = { kind: 'spectator' } as const

    it('the draw and the kept card are public on the records, and the keep cannot be undone', () => {
        const s = relicBoard([HARP])
        s.requireVault().worldDeck = [TENTS, FILLER, WOLVES]
        const search = new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: harp }))
        search.apply(s)
        expect(search.metadata?.revealedDraw).toEqual([TENTS, FILLER, WOLVES])
        expect(OathRuntime.visibility.actions.project(search.dehydrate(), spectator)).toHaveProperty('metadata.revealedDraw', [TENTS, FILLER, WOLVES])
        const keep = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: TENTS, discardOrder: [FILLER, WOLVES], play: SearchPlay.Adviser, faceUp: false }))
        keep.apply(s)
        expect(keep.metadata?.revealedKeptCardId).toBe(TENTS)
        expect(OathRuntime.visibility.actions.project(keep.dehydrate(), spectator)).toHaveProperty('metadata.revealedKeptCardId', TENTS)
        expect(keep.revealsInfo).toBe(true)
    })

    it('a Search without the Harp shows nothing', () => {
        const s = relicBoard([HARP])
        s.requireVault().worldDeck = [TENTS, FILLER, WOLVES]
        const search = new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true }))
        search.apply(s)
        expect(search.metadata?.revealedDraw).toBeUndefined()
        expect(JSON.stringify(OathRuntime.visibility.actions.project(search.dehydrate(), spectator))).not.toContain(TENTS)
    })
})

describe('the Campaign relics', () => {
    const attack = (s: ReturnType<typeof relicBoard>, plans?: { cardId: string; powerIndex: number }[]) =>
        new HydratedCampaign(buildAction(Campaign, { playerId: 'me', defender: { kind: 'player', playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 4, plans })).apply(s)
    const finish = (s: ReturnType<typeof relicBoard>) => {
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        const sac = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'me', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
        sac.apply(s)
        const losses = defendingSideChooses(s)
        if (s.campaign) {
            victory = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'me', placements: [], burnFavor: false }))
            victory.apply(s)
        }
        return losses ?? sac
    }
    let victory: HydratedCampaignResolveVictory | undefined

    it('Cursed Cauldron gains a warband per enemy warband killed', () => {
        const s = relicBoard([CAULDRON])
        attack(s, [battlePlanUse(CAULDRON)])
        const board_ = required(s.getPlayerState('me').warbandsOnBoard['me'], 'my warbands')
        const sac = finish(s)
        // R-5.5.6 — half of the defending force of four (2 at c1, 2 on the board).
        expect(sac.metadata?.defeatKilled).toBe(2)
        expect(s.getPlayerState('me').warbandsOnBoard['me']).toBe(board_ + 2)
    })

    it("Sticky Fire kills the enemy's whole force and owes them a favor", () => {
        const s = relicBoard([FIRE])
        attack(s, [battlePlanUse(FIRE)])
        const sac = finish(s)
        expect(sac.metadata?.defeatKilled).toBe(4)
        expect(warbandsAt(s, 'c1')['foe'] ?? 0).toBe(0)
        expect(s.getPlayerState('foe').warbandsOnBoard['foe'] ?? 0).toBe(0)
        expect(s.getPlayerState('foe').favor).toBe(4)
        expect(sac.metadata?.defeatKilled).toBe(4)
        expect(victory?.metadata?.triggered?.[0]).toMatch(/Sticky Fire/)
    })

    it("Circlet of Command: nobody targets or takes the holder's banners or relics, and their pawn adds one more die", () => {
        const s = relicBoard([], { foe: { relicIds: [CIRCLET, 'relic.cup'] } }, { banners: { [Banner.PeoplesFavor]: { value: 1, holderPlayerId: 'foe' }, [Banner.DarkestSecret]: { value: 1 } } })
        const choice = (targets: CampaignTarget[]) => ({ defender: { kind: 'player' as const, playerId: 'foe' }, targets: targets, attackDice: 2 })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice([{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Relic, cardId: 'relic.cup' }]))).toMatch(/Circlet of Command/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice([{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor }]))).toMatch(/Circlet of Command/)
        expect(HydratedRecover.reasonCannotRecover(s, 'me', { target: { kind: RecoverTargetKind.Banner as const, banner: Banner.PeoplesFavor }, amountPaid: 2, redistributeFrom: Suit.Discord })).toMatch(/Circlet of Command/)
        const parties = HydratedCampaign.partiesFor(s, 'me', choice([{ kind: CampaignTargetKind.PawnAndFavor }]))
        expect(collectDefensePool(s, parties)).toBe(3)
        expect(HydratedRecover.reasonCannotRecover(relicBoard([], { foe: { relicIds: [CIRCLET] } }), 'foe', { target: { kind: RecoverTargetKind.Banner as const, banner: Banner.PeoplesFavor }, amountPaid: 2, redistributeFrom: Suit.Discord })).toBeUndefined()
    })

    it('Whistle — "if able": the Travel rules bind the pulled pawn, and its after-travel powers fire', () => {
        const lake = relicBoard([WHISTLE], { far: { warbandsOnBoard: { far: 3 } } }, { denizensBySite: { c1: [WOLVES, 'denizen.discord.boiling-lake'], c2: [], p1: [], h1: [] } })
        use(lake, WHISTLE, [player('far')])
        expect(lake.getPlayerState('far').siteId).toBe('c1')
        expect(lake.getPlayerState('far').warbandsOnBoard['far']).toBe(1)
        const vowed = relicBoard([WHISTLE], { far: { warbandsOnBoard: { far: 3 }, advisers: [{ cardId: 'denizen.beast.vow-of-union', faceUp: true }] } }, { warbandsBySite: { c1: { foe: 2 }, c2: { me: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 }, h1: { far: 1 } } })
        const a = use(vowed, WHISTLE, [player('far')])
        expect(vowed.getPlayerState('far').siteId).toBe('h1')
        expect(vowed.getPlayerState('far').secrets).toBe(2)
        expect(a.metadata?.summary).toMatch(/Vow of Union/)
    })

    it('Circlet of Command guards "your other relics" against every take, and not itself', () => {
        const s = relicBoard([], { foe: { relicIds: [CIRCLET, 'relic.cup'], advisers: [{ cardId: 'denizen.hearth.storyteller', faceUp: true }, { cardId: 'denizen.beast.rangers', faceUp: true }] }, me: { advisers: [{ cardId: INN, faceUp: true }, { cardId: 'denizen.beast.bracken', faceUp: true }] } })
        const targets: CampaignTarget[] = [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Relic, cardId: CIRCLET }]
        const circletTarget = { defender: { kind: 'player' as const, playerId: 'foe' }, targets, attackDice: 2 }
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', circletTarget) ?? '').not.toMatch(/Circlet/)
        // Blackmail may name only the Circlet itself.
        const blackmail = required(cardPowers('denizen.discord.blackmail')[0], 'Blackmail')
        expect(legalChoices(s, 'me', blackmail)[0].options).toEqual([{ kind: PowerChoiceKind.Card, cardId: CIRCLET }])
        // Relic Thief is not asked.
        const refused = askQuestion(s, 'me', { kind: PowerQuestionKind.RelicThiefRoll, cardId: 'denizen.discord.relic-thief', askedPlayerId: 'me', powerIndex: 0, takerPlayerId: 'foe', relicCardIds: ['relic.cup'] })
        expect(refused).toMatch(/Circlet of Command/)
        expect(s.pendingQuestions).toBeUndefined()
        // The Conspiracy's take.
        const conspiracy = (cardId: string) => reasonCannotPlayConspiracy(s, 'me', { keptCardId: CONSPIRACY_ID, conspiracy: { targetPlayerId: 'foe', take: { kind: 'relic', cardId } } })
        expect(conspiracy('relic.cup')).toMatch(/Circlet of Command/)
        expect(conspiracy(CIRCLET)).toBeUndefined()
    })
})
