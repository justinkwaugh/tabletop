import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { bank, card } from '../testing/choices.js'
import { discardInListedOrder, playDrawnCard } from '../testing/steps.js'
import { FILLER } from '../testing/cards.js'

/** `away` stands at h1, in the Hinterland, a region apart from `ruler` and `other` at c1. */
function board(over: Record<string, Record<string, unknown>> = {}, denizens: Record<string, string[]> = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 2,
                warbandsOnBoard: { ruler: 2 },
                warbandsInPersonalBank: { ruler: 6 },
                ...over['ruler']
            }),
            testPlayer({ playerId: 'other', color: Color.Blue, siteId: 'c1', favor: 2, secrets: 2, ...over['other'] }),
            testPlayer({ playerId: 'away', color: Color.Yellow, siteId: 'h1', favor: 3, secrets: 1, ...over['away'] })
        ],
        {
            denizensBySite: { c1: [], c2: [], h1: [], ...denizens },
            warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', h1: 'site.wastes' }
        }
    )
    openTurn(s, 'ruler')
    return s
}

describe('Hearth', () => {
    it('Salad Days — one favor from each of three DIFFERENT banks', () => {
        const s = board()
        const a = playDrawnCard(s, 'denizen.hearth.salad-days', SearchPlay.Site, [bank(Suit.Beast), bank(Suit.Nomad), bank(Suit.Order)])
        // R-5.1.4.I — the site play's hearth favor comes first: 3 + 1 + 3.
        expect(s.getPlayerState('ruler').favor).toBe(7)
        expect(s.favorBank[Suit.Beast]).toBe(2)
        expect(a.metadata?.whenPlayed).toMatch(/gained 3 favor/)
    })

    it('Salad Days — the same bank twice is refused by the cross-check, before anything moves', () => {
        const s = board()
        expect(() =>
            playDrawnCard(s, 'denizen.hearth.salad-days', SearchPlay.Site, [bank(Suit.Beast), bank(Suit.Beast), bank(Suit.Order)])
        ).toThrow(/three favor banks must be different/)
        expect(s.denizensBySite['c1']).toEqual([])
    })

    it('Fabled Feast — X = hearth cards you rule, itself included', () => {
        const s = board({}, { c2: ['denizen.hearth.rowdy-pub'] })
        s.favorBank[Suit.Beast] = 5
        const a = playDrawnCard(s, 'denizen.hearth.fabled-feast', SearchPlay.Site, [bank(Suit.Beast)])
        expect(a.metadata?.whenPlayed).toMatch(/took 2 favor \(of 2 hearth cards ruled\)/)
        expect(s.favorBank[Suit.Beast]).toBe(3)
    })
})

describe('Arcane', () => {
    it('Dazzle — discards every hearth and order card at sites in your region, locked ones excepted', () => {
        const s = board({}, { c1: ['denizen.hearth.rowdy-pub'], c2: ['denizen.order.captains', 'denizen.beast.rangers'], h1: ['denizen.hearth.storyteller'] })
        const a = playDrawnCard(s, 'denizen.arcane.dazzle', SearchPlay.Adviser)
        discardInListedOrder(s)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(s.denizensBySite['c2']).toEqual(['denizen.beast.rangers'])
        expect(s.denizensBySite['h1']).toEqual(['denizen.hearth.storyteller'])
        expect(a.metadata?.whenPlayed).toMatch(/discarded 2/)
        // R-10.5 — discards go to the pile one region along (Cradle to Provinces), plus the filler.
        expect(s.discardPileCounts.provinces).toBe(3)
    })
})

describe('Beast', () => {
    it('Animal Host — warbands equal to beast cards at sites, itself included', () => {
        const s = board({}, { c2: ['denizen.beast.rangers'], h1: ['denizen.beast.wolves'] })
        const a = playDrawnCard(s, 'denizen.beast.animal-host', SearchPlay.Site)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(5)
        expect(a.metadata?.whenPlayed).toMatch(/gained 3 warbands \(3 beast cards/)
    })

    it('Threatening Roar — discards nomad and beast in the region, itself included (R-9.1, literal)', () => {
        const s = board({}, { c2: ['denizen.nomad.tents'] })
        const a = playDrawnCard(s, 'denizen.beast.threatening-roar', SearchPlay.Site)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(s.denizensBySite['c2']).toEqual([])
        expect(a.metadata?.whenPlayed).toMatch(/discarded 2/)
    })
})

describe('Discord', () => {
    it('A Small Favor — four warbands from your bank, adviser-only so played faceup there', () => {
        const s = board()
        playDrawnCard(s, 'denizen.discord.a-small-favor', SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(6)
        expect(s.getPlayerState('ruler').warbandsInPersonalBank['ruler']).toBe(2)
    })

    it('Charlatan — burns the Darkest Secret down to one, and fires from the R-6.1 flip too', () => {
        const s = board()
        s.banners[Banner.DarkestSecret].value = 4
        s.getPlayerState('ruler').setAdvisers([{ cardId: 'denizen.discord.charlatan', faceUp: false }])
        const a = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: 'ruler', cardId: 'denizen.discord.charlatan', play: SearchPlay.Site })
        )
        a.apply(s)
        expect(s.banners[Banner.DarkestSecret].value).toBe(1)
        expect(a.metadata?.whenPlayed).toMatch(/burned 3 secrets/)
    })
})

describe('Nomad', () => {
    it('Faithful Friend — 4 Supply, capped at the track', () => {
        const s = board({ ruler: { supply: 5 } })
        const a = playDrawnCard(s, 'denizen.nomad.faithful-friend', SearchPlay.Adviser)
        expect(s.getPlayerState('ruler').supply).toBe(7)
        expect(a.metadata?.whenPlayed).toMatch(/gained 2 Supply/)
    })

    it('Great Herd — may swap with a Nomad card at any site; declining keeps it where it landed', () => {
        const s = board({}, { h1: ['denizen.nomad.tents'] })
        playDrawnCard(s, 'denizen.nomad.great-herd', SearchPlay.Site, [card('denizen.nomad.tents')])
        expect(s.denizensBySite['c1']).toEqual(['denizen.nomad.tents'])
        expect(s.denizensBySite['h1']).toEqual(['denizen.nomad.great-herd'])

        const keep = board({}, { h1: ['denizen.nomad.tents'] })
        const a = playDrawnCard(keep, 'denizen.nomad.great-herd', SearchPlay.Site)
        expect(keep.denizensBySite['c1']).toEqual(['denizen.nomad.great-herd'])
        expect(a.metadata?.whenPlayed).toMatch(/kept Great Herd/)
    })

    it('Great Herd — a non-Nomad site card is not among the options', () => {
        const s = board({}, { h1: ['denizen.beast.rangers'] })
        expect(() => playDrawnCard(s, 'denizen.nomad.great-herd', SearchPlay.Site, [card('denizen.beast.rangers')])).toThrow(
            /not among the options/
        )
    })
})

describe('Order', () => {
    it('Garrison — one warband per ruled site, then one from the board onto each', () => {
        const s = board()
        const a = playDrawnCard(s, 'denizen.order.garrison', SearchPlay.Site)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(2)
        expect(s.warbandsBySite['c1']['ruler']).toBe(2)
        expect(s.warbandsBySite['c2']['ruler']).toBe(3)
        expect(a.metadata?.whenPlayed).toMatch(/gained 2 warbands and placed 2 across 2/)

        // R-9.2 — under Ring of Devotion the warbands are gained and none placed.
        const ring = board({ ruler: { relicIds: ['relic.ring-of-devotion'] } })
        const b = playDrawnCard(ring, 'denizen.order.garrison', SearchPlay.Site)
        expect(ring.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)
        expect(ring.warbandsBySite['c1']['ruler']).toBe(1)
        expect(b.metadata?.whenPlayed).toMatch(/placed none/)
    })

    it('Royal Tax — two favor from each player at a ruled site in your region; elsewhere untaxed', () => {
        const s = board()
        const a = playDrawnCard(s, 'denizen.order.royal-tax', SearchPlay.Site)
        expect(s.getPlayerState('other').favor).toBe(0)
        expect(s.getPlayerState('away').favor).toBe(3)
        // R-5.1.4.I — the site play's order favor comes before the tax: 3 + 1 + 2.
        expect(s.getPlayerState('ruler').favor).toBe(6)
        expect(a.metadata?.whenPlayed).toMatch(/taxed 2 favor/)
    })
})

describe('the trigger itself', () => {
    it('does not fire for a facedown adviser play, and fires for a faceup one', () => {
        const down = board()
        down.getPlayerState('ruler').handIds = ['denizen.discord.a-small-favor', FILLER]
        new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'ruler', keptCardId: 'denizen.discord.a-small-favor', discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: false })
        ).apply(down)
        expect(down.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(2)
    })

    it('a card with no When Played power plays fine, stays inert, and refuses stray choices', () => {
        const s = board()
        const a = playDrawnCard(s, 'denizen.nomad.tents', SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toBeUndefined()
        expect(() => playDrawnCard(board(), 'denizen.nomad.tents', SearchPlay.Adviser, [{ kind: PowerChoiceKind.Yes }])).toThrow(
            /takes no choices on this play/
        )
    })

    it('choices survive the wire on both play actions', () => {
        const s = board()
        s.getPlayerState('ruler').handIds = ['denizen.hearth.fabled-feast', FILLER]
        const a = new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'ruler', keptCardId: 'denizen.hearth.fabled-feast', discardOrder: [FILLER], play: SearchPlay.Site, choices: [bank(Suit.Beast)] })
        )
        expect(a.dehydrate().choices).toEqual([bank(Suit.Beast)])
    })
})
