import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { advisersTowardLimit } from '../util/continuous.js'
import '../powers/index.js'
import { createOathVault } from '../model/vault.js'
import { getPrng } from '@tabletop/common'
import { adviserDiscardsNeeded } from '../actions/searchResolve.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, bank, card, modifierUse, player, site } from '../testing/choices.js'
import { rulerTable } from '../testing/tables.js'
import { playDrawnCard } from '../testing/steps.js'
import { INN, TENTS, FILLER } from '../testing/cards.js'
import { PowerQuestionKind } from '../model/question.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'

const MEMORY = 'denizen.hearth.memory-of-home'
const HOMESTEADERS = 'denizen.hearth.homesteaders'
const ROVING = 'denizen.beast.roving-terror'
const PIPER = 'denizen.beast.pied-piper'
const RIOTS = 'denizen.discord.riots'
const WAGON = 'denizen.nomad.family-wagon'
const TWIN = 'denizen.nomad.twin-brother'
const KNIGHTS = 'denizen.order.knights-errant'
const HUNTING = 'denizen.order.hunting-party'
const PALANQUIN = 'denizen.order.palanquin'

const WOLVES = 'denizen.beast.wolves'
const ELDERS = 'denizen.nomad.elders'
const SCOUTS = 'denizen.order.scouts'

function campaign(s: ReturnType<typeof rulerTable>) {
    const a = new HydratedCampaign(
        buildAction(Campaign, {
            playerId: 'ruler',
            defender: { kind: 'player', playerId: 'other' },
            targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
            attackDice: 2
        })
    )
    a.apply(s)
    return a
}

describe('Hearth', () => {
    it('Memory of Home — empties one bank into the hearth bank, never the hearth bank itself', () => {
        const s = rulerTable([MEMORY])
        const nomad = s.favorBank[Suit.Nomad]
        const hearth = s.favorBank[Suit.Hearth]
        actionPowerUse('ruler', MEMORY, [bank(Suit.Nomad)]).apply(s)
        expect(s.favorBank[Suit.Nomad]).toBe(0)
        expect(s.favorBank[Suit.Hearth]).toBe(hearth + nomad)
        expect(s.getPlayerState('ruler').secrets).toBe(2)
        expect(() => actionPowerUse('ruler', MEMORY, [bank(Suit.Hearth)]).apply(rulerTable([MEMORY]))).toThrow(/into itself/)
    })

    it('Homesteaders — moves one of your faceup advisers to your site, if it has room', () => {
        const s = rulerTable([HOMESTEADERS], [WOLVES])
        actionPowerUse('ruler', HOMESTEADERS, [card(WOLVES)]).apply(s)
        expect(s.getPlayerState('ruler').advisers).toEqual([])
        expect(s.denizensBySite['c1']).toEqual([HOMESTEADERS, WOLVES])
        const full = rulerTable([HOMESTEADERS, INN, ELDERS], [WOLVES])
        expect(() => actionPowerUse('ruler', HOMESTEADERS, [card(WOLVES)]).apply(full)).toThrow(/no room/)
        const facedown = rulerTable([HOMESTEADERS], [], { ruler: { advisers: [{ cardId: WOLVES, faceUp: false }] } })
        expect(() => actionPowerUse('ruler', HOMESTEADERS, [card(WOLVES)]).apply(facedown)).toThrow()
    })
})

describe('Beast', () => {
    it('Roving Terror — discards a denizen at another site and moves there', () => {
        const s = rulerTable([ROVING], [], {}, { denizensBySite: { c1: [ROVING], c2: [INN, WOLVES], p1: [], h1: [] } })
        actionPowerUse('ruler', ROVING, [card(INN)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(s.denizensBySite['c2']).toEqual([WOLVES, ROVING])
        expect(s.discardPileCounts.provinces).toBe(1)
        expect(s.getPlayerState('ruler').secrets).toBe(2)
        const own = rulerTable([ROVING, INN])
        expect(() => actionPowerUse('ruler', ROVING, [card(INN)]).apply(own)).toThrow()
    })

    it('Pied Piper — ignores the adviser limit, and moves to another player taking two favor', () => {
        const s = rulerTable([], [PIPER, WOLVES, INN])
        expect(advisersTowardLimit(s, 'ruler')).toBe(2)
        playDrawnCard(s, ELDERS, SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').advisers).toHaveLength(4)
        const down = rulerTable([], [], { ruler: { advisers: [{ cardId: PIPER, faceUp: false }, { cardId: WOLVES, faceUp: true }, { cardId: INN, faceUp: true }] } })
        expect(() => playDrawnCard(down, ELDERS, SearchPlay.Adviser)).toThrow(/adviser limit/)

        const t = rulerTable([], [PIPER])
        actionPowerUse('ruler', PIPER, [player('other')]).apply(t)
        expect(t.getPlayerState('ruler').advisers).toEqual([])
        expect(t.getPlayerState('other').advisers).toEqual([{ cardId: TENTS, faceUp: true }, { cardId: PIPER, faceUp: true }])
        expect(t.getPlayerState('other').favor).toBe(0)
        expect(t.getPlayerState('ruler').favor).toBe(5)
        expect(t.getPlayerState('ruler').secrets).toBe(2)
    })
})

describe('Discord', () => {
    const mob = { banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: true }, [Banner.DarkestSecret]: { value: 1 } } }

    it("Riots — on the Mob side, discards every other card of the map's most common suit; ties are yours", () => {
        const s = rulerTable([], [], {}, { ...mob, denizensBySite: { c1: [INN], c2: [WOLVES, 'denizen.hearth.storyteller'], p1: [ELDERS], h1: [] } })
        playDrawnCard(s, RIOTS, SearchPlay.Site)
        expect(s.denizensBySite['c1']).toEqual([RIOTS])
        expect(s.denizensBySite['c2']).toEqual([WOLVES])
        expect(s.denizensBySite['p1']).toEqual([ELDERS])

        const tie = rulerTable([], [], {}, { ...mob, denizensBySite: { c1: [INN], c2: [WOLVES], p1: [], h1: [] } })
        expect(() => playDrawnCard(tie, RIOTS, SearchPlay.Site)).toThrow(/tied/)
        const broken = rulerTable([], [], {}, { ...mob, denizensBySite: { c1: [INN], c2: [WOLVES], p1: [], h1: [] } })
        playDrawnCard(broken, RIOTS, SearchPlay.Site, [bank(Suit.Beast)])
        expect(broken.denizensBySite['c2']).toEqual([])
        expect(broken.denizensBySite['c1']).toEqual([INN, RIOTS])
        expect(() => playDrawnCard(rulerTable([], [], {}, { ...mob, denizensBySite: { c1: [INN], c2: [WOLVES], p1: [], h1: [] } }), RIOTS, SearchPlay.Site, [bank(Suit.Order)])).toThrow(/not the most common/)

        const calm = rulerTable([INN], [], {}, { denizensBySite: { c1: [INN], c2: [INN === INN ? 'denizen.hearth.storyteller' : INN], p1: [], h1: [] } })
        const a = playDrawnCard(calm, RIOTS, SearchPlay.Site)
        expect(a.metadata?.whenPlayed).toMatch(/not on the Mob side/)
        expect(calm.denizensBySite['c2']).toEqual(['denizen.hearth.storyteller'])
    })
})

describe('Nomad', () => {
    it('Family Wagon — one non-nomad adviser at most; nomads are unlimited', () => {
        const s = rulerTable([], [WAGON, TENTS, ELDERS])
        expect(advisersTowardLimit(s, 'ruler')).toBe(0)
        playDrawnCard(s, 'denizen.nomad.a-fast-steed', SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').advisers).toHaveLength(4)
        playDrawnCard(s, WOLVES, SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').advisers).toHaveLength(5)
        expect(() => playDrawnCard(s, SCOUTS, SearchPlay.Adviser)).toThrow(/adviser limit of 1/)
        const down = rulerTable([], [WAGON], { ruler: { advisers: [{ cardId: WAGON, faceUp: true }, { cardId: TENTS, faceUp: false }] } })
        expect(() => playDrawnCard(down, WOLVES, SearchPlay.Adviser)).toThrow(/adviser limit of 1/)
    })

    it('Family Wagon — played over two other advisers, it forces a discard down to its limit (R-7.6.4)', () => {
        const s = rulerTable([], [WOLVES, SCOUTS])
        expect(adviserDiscardsNeeded(s, 'ruler', WAGON, { faceUp: true })).toBe(1)
        expect(() => playDrawnCard(s, WAGON, SearchPlay.Adviser)).toThrow(/adviser limit/)
    })

    it("Twin Brother — may swap itself with another player's faceup nomad adviser", () => {
        const s = rulerTable([], [WOLVES])
        playDrawnCard(s, TWIN, SearchPlay.Adviser, [card(TENTS)])
        expect(s.getPlayerState('ruler').advisers).toEqual([{ cardId: WOLVES, faceUp: true }, { cardId: TENTS, faceUp: true }])
        expect(s.getPlayerState('other').advisers).toEqual([{ cardId: TWIN, faceUp: true }])
        const keep = rulerTable([])
        const a = playDrawnCard(keep, TWIN, SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toMatch(/stays/)
        expect(() => playDrawnCard(rulerTable([], [ELDERS]), TWIN, SearchPlay.Adviser, [card(ELDERS)])).toThrow()
    })
})

describe('Order', () => {
    it('Knights Errant — the Campaign right after a Muster spends no Supply, and only that one', () => {
        // `other` rules c1, so the ruler's own site is a Campaign target.
        const contested = { warbandsBySite: { c1: { [Color.Blue]: 1 }, p1: { [Color.Blue]: 3 } } }
        const s = rulerTable([KNIGHTS, INN], [], {}, contested)
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN, modifiers: [modifierUse(KNIGHTS)] })).apply(s)
        expect(s.getPlayerState('ruler').freeCampaignAtAction).toBe(1)
        s.actionCount = 1 // the engine records the Muster; the Campaign is next
        expect(HydratedCampaign.supplyCostFor(s, 'ruler')).toBe(0)
        const supply = s.getPlayerState('ruler').supply
        const a = campaign(s)
        expect(s.getPlayerState('ruler').supply).toBe(supply)
        expect(a.metadata?.supplySpent).toBe(0)
        expect(s.getPlayerState('ruler').freeCampaignAtAction).toBeUndefined()

        const t = rulerTable([KNIGHTS, INN])
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN, modifiers: [modifierUse(KNIGHTS)] })).apply(t)
        t.actionCount = 2
        expect(HydratedCampaign.supplyCostFor(t, 'ruler')).toBe(2)
        const u = rulerTable([KNIGHTS, INN])
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(u)
        expect(u.getPlayerState('ruler').freeCampaignAtAction).toBeUndefined()
    })

    it('Hunting Party — the same, after a Search of the world deck, granted when the Search resolves', () => {
        const s = rulerTable([HUNTING], [], {}, { discardPileCounts: { cradle: 2, provinces: 2, hinterland: 2 } })
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.Discard, [modifierUse(HUNTING)])).toMatch(/not searching the world deck/)
        s.requireVault().worldDeck = [INN, FILLER]
        new HydratedSearch(
            buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(HUNTING)] })
        ).apply(s)
        expect(s.getPlayerState('ruler').freeCampaignAtAction).toBeUndefined()
        s.actionCount = 1
        const r = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', keptCardId: INN, discardOrder: [FILLER], play: SearchPlay.Site }))
        r.apply(s)
        expect(s.getPlayerState('ruler').freeCampaignAtAction).toBe(2)
        s.actionCount = 2
        expect(HydratedCampaign.supplyCostFor(s, 'ruler')).toBe(0)
    })

    it('Palanquin — carries you and a player at your site to a faceup site, free', () => {
        const s = rulerTable([PALANQUIN])
        actionPowerUse('ruler', PALANQUIN, [player('other'), site('p1')]).apply(s)
        expect(s.getPlayerState('ruler').siteId).toBe('p1')
        expect(s.getPlayerState('other').siteId).toBe('p1')
        expect(s.getPlayerState('ruler').supply).toBe(4)
        expect(s.getPlayerState('ruler').favor).toBe(2)
        expect(() => actionPowerUse('ruler', PALANQUIN, [player('away'), site('p1')]).apply(rulerTable([PALANQUIN]))).toThrow()
        expect(() => actionPowerUse('ruler', PALANQUIN, [player('other'), site('c1')]).apply(rulerTable([PALANQUIN]))).toThrow()
    })

    it('Palanquin — a facedown site is revealed from the vault as they arrive (R-5.6.2)', () => {
        const s = rulerTable([PALANQUIN], [], {}, { siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes' } })
        s.vault = createOathVault({ siteFacedown: { h1: 'site.mountain' } }, getPrng(1))
        const a = actionPowerUse('ruler', PALANQUIN, [player('other'), site('h1')])
        a.apply(s)
        expect(a.revealsInfo).toBe(true)
        expect(s.siteCardAt('h1')).toBe('site.mountain')
        expect(s.getPlayerState('other').siteId).toBe('h1')
        expect(s.getPlayerState('ruler').siteId).toBe('h1')
    })

    it('Palanquin — "a site that they can travel to": their travel restrictions bind and their after-travel powers fire', () => {
        const lake = rulerTable([PALANQUIN], [], {}, { denizensBySite: { c1: [PALANQUIN], c2: ['denizen.discord.boiling-lake'], p1: [], h1: [] } })
        actionPowerUse('ruler', PALANQUIN, [player('other'), site('c2')]).apply(lake)
        expect(lake.getPlayerState('other').warbandsOnBoard[Color.Blue]).toBe(0)
        const vowed = rulerTable([PALANQUIN], [], { other: { advisers: [{ cardId: 'denizen.beast.vow-of-union', faceUp: true }] } }, { warbandsBySite: { c1: { [Color.Blue]: 1 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } } })
        expect(() => actionPowerUse('ruler', PALANQUIN, [player('other'), site('c2')]).apply(vowed)).toThrow(/Vow of Union/)
    })

    it("Palanquin — carried out of a Shrouded Wood their enemy rules, the Wood's ruler chooses where they go (R-11.7)", () => {
        const s = rulerTable([PALANQUIN], [], {}, {
            siteCards: { c1: 'site.shrouded-wood', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            warbandsBySite: { c1: { [Color.Yellow]: 2 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } }
        })
        actionPowerUse('ruler', PALANQUIN, [player('other'), site('c2')]).apply(s)
        expect(s.getPlayerState('ruler').siteId).toBe('c2')
        expect(s.getPlayerState('other').siteId).toBe('c1')
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'away', travelerPlayerId: 'other', fromSiteId: 'c1' })

        new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'away', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'p1' } })).apply(s)
        expect(s.getPlayerState('other').siteId).toBe('p1')
    })
})
