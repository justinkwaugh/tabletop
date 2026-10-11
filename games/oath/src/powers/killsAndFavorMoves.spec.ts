import { describe, expect, it } from 'vitest'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedRecover, RecoverTargetKind, Recover } from '../actions/recover.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { testVaultWithRelics } from '../testing/fixture.js'
import { banditsPerSite } from '../util/bandits.js'
import { collectDefendingBandits, type CampaignParties } from '../util/campaign.js'
import { CampaignTargetKind } from '../model/campaign.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { required } from '../testing/required.js'
import { actionPowerUse, bank, card, modifierUse, player, boardWarbands, siteWarbands } from '../testing/choices.js'
import { rulerTable } from '../testing/tables.js'
import { playDrawnCard } from '../testing/steps.js'
import { INN, TENTS } from '../testing/cards.js'

const PLAGUE = 'denizen.arcane.plague-engines'
const TERROR = 'denizen.arcane.terror-spells'
const BLOOD = 'denizen.arcane.blood-pact'
const TAMING = 'denizen.arcane.taming-charm'
const PATHS = 'denizen.beast.forest-paths'
const BEASTKIN = 'denizen.beast.vow-of-beastkin'
const SECOND = 'denizen.beast.second-chance'
const CHIEF = 'denizen.discord.bandit-chief'
const ENCHANTRESS = 'denizen.discord.enchantress'
const KEY = 'denizen.discord.key-to-the-city'
const ALE = 'denizen.hearth.a-round-of-ale'
const MOB = 'denizen.hearth.armed-mob'
const LEVELERS = 'denizen.hearth.levelers'
const NEWS = 'denizen.hearth.news-from-afar'
const WORSHIP = 'denizen.nomad.relic-worship'

const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'


function board(cards: string[], advisers: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    return rulerTable(cards, advisers, { ...over, other: { advisers: [{ cardId: SCOUTS, faceUp: true }], ...over['other'] } }, state)
}

describe('Arcane', () => {
    it('Plague Engines — every player puts one favor per ruled site into the arcane bank, as much as they have', () => {
        const s = board([PLAGUE])
        const before = s.favorBank[Suit.Arcane]
        actionPowerUse('ruler', PLAGUE).apply(s)
        // ruler rules c1 and c2 → 2; other rules p1 → 1; away rules nothing.
        expect(s.getPlayerState('ruler').favor).toBe(1)
        expect(s.getPlayerState('other').favor).toBe(1)
        expect(s.getPlayerState('away').favor).toBe(1)
        expect(s.favorBank[Suit.Arcane]).toBe(before + 3)
        expect(s.getPlayerState('ruler').secrets).toBe(1)
    })

    it('Terror Spells — two warbands in your region, anywhere, only while you hold the Darkest Secret', () => {
        const dark = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'ruler', value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const s = board([TERROR], [], {}, dark)
        actionPowerUse('ruler', TERROR, [siteWarbands('c2', 'ruler', 1), boardWarbands('other', 'other', 1)]).apply(s)
        expect(s.warbandsBySite['c2']['ruler']).toBe(1)
        expect(s.getPlayerState('other').warbandsOnBoard['other']).toBe(1)

        const noBanner = board([TERROR])
        expect(() => actionPowerUse('ruler', TERROR, [siteWarbands('c2', 'ruler', 2)]).apply(noBanner)).toThrow(/Darkest Secret/)
        const one = board([TERROR], [], {}, dark)
        expect(() => actionPowerUse('ruler', TERROR, [siteWarbands('c2', 'ruler', 1)]).apply(one)).toThrow(/1 named, 2 to kill/)
        // p1 is another region: not in the domain.
        const far = board([TERROR], [], {}, dark)
        expect(() => actionPowerUse('ruler', TERROR, [siteWarbands('p1', 'other', 2)]).apply(far)).toThrow()
    })

    it('Blood Pact — an even number from your board, one secret per pair', () => {
        const s = board([BLOOD])
        actionPowerUse('ruler', BLOOD, [boardWarbands('ruler', 'ruler', 4)]).apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(0)
        expect(s.getPlayerState('ruler').secrets).toBe(3 - 1 + 2)
        expect(() => actionPowerUse('ruler', BLOOD, [boardWarbands('ruler', 'ruler', 3)]).apply(board([BLOOD]))).toThrow(/even number/)
    })

    it('Taming Charm — discards a beast or nomad card at your site for two favor from its bank', () => {
        const s = board([TAMING, WOLVES])
        const before = s.favorBank[Suit.Beast]
        actionPowerUse('ruler', TAMING, [card(WOLVES)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([TAMING])
        expect(s.favorBank[Suit.Beast]).toBe(before - 2)
        expect(s.getPlayerState('ruler').favor).toBe(5)
        expect(() => actionPowerUse('ruler', TAMING, [card(INN)]).apply(board([TAMING, INN]))).toThrow()
    })
})

describe('Beast', () => {
    it('Forest Paths — free Travel to a site with a beast card, none elsewhere', () => {
        const s = board([PATHS], [], {}, { denizensBySite: { c1: [PATHS], c2: [WOLVES], p1: [], h1: [] } })
        expect(HydratedTravel.plan(s, 'ruler', 'c2', [modifierUse(PATHS)]).cost).toBe(0)
        expect(HydratedTravel.plan(s, 'ruler', 'c2').cost).toBeGreaterThan(0)
        expect(HydratedTravel.reasonCannotTravel(s, 'ruler', 'p1', [modifierUse(PATHS)])).toMatch(/no beast card/)
        new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c2', modifiers: [modifierUse(PATHS)] })).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(4)
        expect(s.tokensOn(PATHS).favor).toBe(1)
    })

    it('Vow of Beastkin — must muster on a card matching an adviser, and gains one more', () => {
        const s = board([INN, WOLVES], [BEASTKIN, TENTS])
        expect(HydratedMuster.reasonCannotMuster(s, 'ruler', INN)).toMatch(/must muster on a card matching/)
        expect(HydratedMuster.reasonCannotMuster(s, 'ruler', WOLVES)).toBeUndefined()
        const plain = board([INN, WOLVES], [TENTS])
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: WOLVES })).apply(plain)
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: WOLVES })).apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(required(plain.getPlayerState('ruler').warbandsOnBoard['ruler'], 'the ruler’s red warbands') + 1)
    })

    it('Second Chance — kills one on the board of a player with an order or discord adviser, gaining one', () => {
        const s = board([SECOND])
        actionPowerUse('ruler', SECOND, [player('other')]).apply(s)
        expect(s.getPlayerState('other').warbandsOnBoard['other']).toBe(1)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(5)
        expect(() => actionPowerUse('ruler', SECOND, [player('away')]).apply(board([SECOND]))).toThrow()
        const empty = board([SECOND], [], { other: { warbandsOnBoard: {} } })
        const a = actionPowerUse('ruler', SECOND, [player('other')])
        a.apply(empty)
        expect(empty.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)
        expect(a.metadata?.summary).toMatch(/nothing gained/)
    })
})

describe('Discord', () => {
    it('Bandit Chief — one warband dies at each site when played; the bandits are three per site while it is faceup', () => {
        const s = board([])
        expect(banditsPerSite(s)).toBe(1)
        playDrawnCard(s, CHIEF, SearchPlay.Site)
        expect(s.warbandsBySite['c1']['ruler'] ?? 0).toBe(0)
        expect(s.warbandsBySite['c2']['ruler']).toBe(1)
        expect(s.warbandsBySite['p1']['other']).toBe(2)
        expect(banditsPerSite(s)).toBe(3)
        const parties: CampaignParties = { attackerPlayerId: 'ruler', defenderPlayerId: undefined, targets: [{ kind: CampaignTargetKind.Site, siteId: 'h1' }], allyPlayerIds: [], nonImperialPlayerIds: [], attackerSiteId: 'c1', forceSiteIds: [] }
        expect(collectDefendingBandits(s, parties)).toBe(3)
        s.denizensBySite['c1'] = []
        expect(banditsPerSite(s)).toBe(1)
        s.getPlayerState('away').setAdvisers([{ cardId: CHIEF, faceUp: false }])
        expect(banditsPerSite(s)).toBe(1)
        s.getPlayerState('away').setAdvisers([{ cardId: CHIEF, faceUp: true }])
        expect(banditsPerSite(s)).toBe(3)
    })

    it('Enchantress — swaps places with any faceup adviser, from a site or from your advisers', () => {
        const s = board([ENCHANTRESS])
        actionPowerUse('ruler', ENCHANTRESS, [card(SCOUTS)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual([SCOUTS])
        expect(s.getPlayerState('other').advisers).toEqual([{ cardId: ENCHANTRESS, faceUp: true }])
        expect(s.getPlayerState('ruler').secrets).toBe(2)

        const held = board([], [ENCHANTRESS])
        actionPowerUse('ruler', ENCHANTRESS, [card(SCOUTS)]).apply(held)
        expect(held.getPlayerState('ruler').advisers).toEqual([{ cardId: SCOUTS, faceUp: true }])
        expect(held.getPlayerState('other').advisers).toEqual([{ cardId: ENCHANTRESS, faceUp: true }])
    })

    it('Enchantress — never swaps a locked adviser, nor sends an adviser-only card to a site (R-7.2.1, R-7.2.2)', () => {
        const locked = board([], [ENCHANTRESS], { other: { advisers: [{ cardId: 'denizen.nomad.faithful-friend', faceUp: true }] } })
        expect(() => actionPowerUse('ruler', ENCHANTRESS, [card('denizen.nomad.faithful-friend')]).apply(locked)).toThrow(/not among the options/)
        const atSite = board([ENCHANTRESS], [], { other: { advisers: [{ cardId: 'denizen.hearth.charming-friend', faceUp: true }] } })
        expect(() => actionPowerUse('ruler', ENCHANTRESS, [card('denizen.hearth.charming-friend')]).apply(atSite)).toThrow(/not among the options/)
    })

    it("Key to the City — with the ruler's pawn away, kills the site's warbands and garrisons one of yours", () => {
        const s = board([], [], {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        s.getPlayerState('ruler').siteId = 'c1'
        const here = playDrawnCard(s, KEY, SearchPlay.Site)
        expect(here.metadata?.whenPlayed).toMatch(/ruler's pawn is at c1/)
        expect(s.warbandsBySite['c1']['ruler']).toBe(1)

        // `other` rules p1 but stands on c1.
        const t = board([], [], { ruler: { siteId: 'p1' } }, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        const a = playDrawnCard(t, KEY, SearchPlay.Site)
        expect(a.metadata?.whenPlayed).toMatch(/killed 3 at p1/)
        expect(t.warbandsBySite['p1']['other'] ?? 0).toBe(0)
        expect(t.warbandsBySite['p1']['ruler']).toBe(1)
        expect(t.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)

        // R-7.2.1's placement: the card can only be played to a site.
        expect(() => playDrawnCard(board([]), KEY, SearchPlay.Adviser)).toThrow(/only be played to a site/)
    })
})

describe('Hearth', () => {
    it('A Round of Ale — returns favor and secrets as at Rest, keeping the favor on itself', () => {
        const s = board([ALE, INN], [], { ruler: { secretsFacedown: 1 } }, {
            cardTokens: { [INN]: { favor: 2, secrets: 1 }, [WOLVES]: { favor: 1, secrets: 0 } }
        })
        s.denizensBySite['c2'] = [WOLVES]
        const hearth = s.favorBank[Suit.Hearth]
        const beast = s.favorBank[Suit.Beast]
        actionPowerUse('ruler', ALE).apply(s)
        expect(s.tokensOn(ALE).favor).toBe(1)
        expect(s.tokensOn(INN)).toEqual({ favor: 0, secrets: 0 })
        expect(s.favorBank[Suit.Hearth]).toBe(hearth + 2)
        expect(s.favorBank[Suit.Beast]).toBe(beast + 1)
        expect(s.getPlayerState('ruler').secrets).toBe(3 + 1 + 1)
        expect(s.getPlayerState('ruler').secretsFacedown).toBe(0)
    })

    it("Armed Mob — discards a faceup adviser of a Darkest Secret holder without the People's Favor", () => {
        const dark = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'other', value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const s = board([MOB], [], {}, dark)
        actionPowerUse('ruler', MOB, [player('other'), card(SCOUTS)]).apply(s)
        expect(s.getPlayerState('other').advisers).toEqual([])
        expect(s.discardPileCounts.provinces).toBe(1)

        const both = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'other', value: 1 }, [Banner.PeoplesFavor]: { holderPlayerId: 'other', value: 1 } } }
        expect(() => actionPowerUse('ruler', MOB, [player('other'), card(SCOUTS)]).apply(board([MOB], [], {}, both))).toThrow()
    })

    it('Armed Mob — a locked adviser cannot be discarded (R-7.2.2)', () => {
        const dark = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'other', value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const s = board([MOB], [], { other: { advisers: [{ cardId: 'denizen.nomad.faithful-friend', faceUp: true }] } }, dark)
        expect(() => actionPowerUse('ruler', MOB, [player('other'), card('denizen.nomad.faithful-friend')]).apply(s)).toThrow(/not among the options/)
    })

    it('Levelers — two favor from the fullest bank to the emptiest, ties yours to break', () => {
        const s = board([LEVELERS])
        s.favorBank = { ...s.favorBank, [Suit.Order]: 5, [Suit.Beast]: 5, [Suit.Hearth]: 1, [Suit.Nomad]: 1 }
        actionPowerUse('ruler', LEVELERS, [bank(Suit.Beast), bank(Suit.Nomad)]).apply(s)
        expect(s.favorBank[Suit.Beast]).toBe(3)
        expect(s.favorBank[Suit.Nomad]).toBe(3)
        const t = board([LEVELERS])
        t.favorBank = { ...t.favorBank, [Suit.Order]: 5, [Suit.Hearth]: 1 }
        expect(() => actionPowerUse('ruler', LEVELERS, [bank(Suit.Arcane), bank(Suit.Hearth)]).apply(t)).toThrow(/does not have the most/)
        expect(() => actionPowerUse('ruler', LEVELERS, [bank(Suit.Order), bank(Suit.Arcane)]).apply(t)).toThrow(/does not have the least/)
    })

    it('News from Afar — a free Search for two favor on the card', () => {
        const s = board([NEWS], [], {}, { discardPileCounts: { cradle: 3, provinces: 3, hinterland: 3 } })
        expect(HydratedSearch.plan(s, 'ruler', SearchSource.WorldDeck, [modifierUse(NEWS)]).cost).toBe(0)
        expect(HydratedSearch.plan(s, 'ruler', SearchSource.WorldDeck).cost).toBe(2)
        new HydratedSearch(
            buildAction(Search, {
                playerId: 'ruler',
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers: [modifierUse(NEWS)]
            })
        ).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(4)
        expect(s.tokensOn(NEWS).favor).toBe(2)
        expect(s.getPlayerState('ruler').favor).toBe(1)
    })
})

describe('Nomad', () => {
    it('Relic Worship — three Supply after a relic Recover, unasked', () => {
        const relics = {
            relicsBySite: { c1: [{ slotId: 'slot-1' }] },
            vault: testVaultWithRelics({ 'slot-1': 'relic.cup-of-plenty' }),
            siteCards: { c1: 'site.marshes', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
        }
        const recover = () =>
            new HydratedRecover(
                buildAction(Recover, { playerId: 'ruler', target: { kind: RecoverTargetKind.Relic, slotId: 'slot-1' } })
            )
        const plain = board([], [TENTS], { ruler: { favor: 6, secrets: 4 } }, relics)
        recover().apply(plain)
        const s = board([], [WORSHIP], { ruler: { favor: 6, secrets: 4 } }, relics)
        const a = recover()
        a.apply(s)
        expect(s.getPlayerState('ruler').relicIds).toEqual(['relic.cup-of-plenty'])
        expect(s.getPlayerState('ruler').supply).toBe(plain.getPlayerState('ruler').supply + 3)
        expect(a.metadata?.modifierNotes).toEqual(['Relic Worship: gained 3 Supply'])
    })
})
