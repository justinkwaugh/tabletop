import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { bank, card } from '../testing/choices.js'
import { discardInListedOrder, playDrawnCard } from '../testing/steps.js'
import { FILLER } from '../testing/cards.js'
import { OathRevision } from '../util/revision.js'
import { placedDenizens } from '../testing/census.js'
import { swapPlayedCardWithSiteCard } from './vocabulary.js'
import { advisersOfSuit } from '../util/persistent.js'

const SALAD_DAYS = 'denizen.hearth.salad-days'

/** `away` stands at h1, in the Hinterland, a region apart from `ruler` and `other` at c1. */
function board(
    over: Record<string, Record<string, unknown>> = {},
    denizens: Record<string, string[]> = {}
) {
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
            testPlayer({
                playerId: 'other',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                ...over['other']
            }),
            testPlayer({
                playerId: 'away',
                color: Color.Yellow,
                siteId: 'h1',
                favor: 3,
                secrets: 1,
                ...over['away']
            })
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
        const a = playDrawnCard(s, 'denizen.hearth.salad-days', SearchPlay.Site, [
            bank(Suit.Beast),
            bank(Suit.Nomad),
            bank(Suit.Order)
        ])
        // R-5.1.4.I — the site play's hearth favor comes first: 3 + 1 + 3.
        expect(s.getPlayerState('ruler').favor).toBe(7)
        expect(s.favorBank[Suit.Beast]).toBe(2)
        expect(a.metadata?.whenPlayed).toMatch(/gained 3 favor/)
    })

    it('Salad Days — the same bank twice is refused by the cross-check, before anything moves', () => {
        const s = board()
        expect(() =>
            playDrawnCard(s, 'denizen.hearth.salad-days', SearchPlay.Site, [
                bank(Suit.Beast),
                bank(Suit.Beast),
                bank(Suit.Order)
            ])
        ).toThrow(/three favor banks must be different/)
        expect(s.denizensBySite['c1']).toEqual([])
    })

    describe('Salad Days — "one each from three different favor banks", as far as the banks hold favor (R-7.1.3)', () => {
        /** Every bank holds 3 but those named in `empty`. */
        const table = (revision: OathRevision, empty: Suit[]) => {
            const s = board()
            s.oathRevision = revision
            for (const suit of empty) s.favorBank[suit] = 0
            return s
        }
        const play = (s: ReturnType<typeof table>, suits: Suit[]) =>
            playDrawnCard(s, SALAD_DAYS, SearchPlay.Adviser, suits.map(bank))

        it('from revision 8, an empty bank named while three banks hold favor is refused; before it, accepted for 2', () => {
            const picks = [Suit.Beast, Suit.Order, Suit.Nomad]
            const now = table(OathRevision.EngineFixes4, [Suit.Nomad])
            expect(() => play(now, picks)).toThrow(/the banks named yield 2, and 3 can be had/)
            expect(now.getPlayerState('ruler').favor).toBe(3)

            const before = table(OathRevision.EngineFixes3, [Suit.Nomad])
            const a = play(before, picks)
            expect(before.getPlayerState('ruler').favor).toBe(5)
            expect(a.metadata?.whenPlayed).toMatch(/gained 2 favor/)
        })

        it('from revision 8, with two banks holding favor, both are named and an empty one makes the third', () => {
            const two = () =>
                table(OathRevision.EngineFixes4, [
                    Suit.Discord,
                    Suit.Hearth,
                    Suit.Arcane,
                    Suit.Nomad
                ])
            const s = two()
            const a = play(s, [Suit.Beast, Suit.Order, Suit.Nomad])
            expect(s.getPlayerState('ruler').favor).toBe(5)
            expect(a.metadata?.whenPlayed).toMatch(/gained 2 favor/)
            expect(() => play(two(), [Suit.Beast, Suit.Nomad, Suit.Arcane])).toThrow(
                /the banks named yield 1, and 2 can be had/
            )
        })

        it('from revision 8, with one bank holding favor it gives 1, and with none the play gains nothing', () => {
            const one = table(OathRevision.EngineFixes4, [
                Suit.Discord,
                Suit.Hearth,
                Suit.Arcane,
                Suit.Nomad,
                Suit.Order
            ])
            play(one, [Suit.Beast, Suit.Nomad, Suit.Arcane])
            expect(one.getPlayerState('ruler').favor).toBe(4)

            const none = table(OathRevision.EngineFixes4, Object.values(Suit))
            const a = play(none, [Suit.Beast, Suit.Nomad, Suit.Arcane])
            expect(none.getPlayerState('ruler').favor).toBe(3)
            expect(a.metadata?.whenPlayed).toMatch(/gained 0 favor/)
        })
    })

    it('Fabled Feast — X = hearth cards you rule, itself included when played to a site you rule', () => {
        const s = board({}, { c2: ['denizen.hearth.rowdy-pub'] })
        s.favorBank[Suit.Beast] = 5
        const a = playDrawnCard(s, 'denizen.hearth.fabled-feast', SearchPlay.Site, [
            bank(Suit.Beast)
        ])
        expect(a.metadata?.whenPlayed).toMatch(/took 2 favor \(of 2 hearth cards ruled\)/)
        expect(s.favorBank[Suit.Beast]).toBe(3)
    })
})

describe('Arcane', () => {
    it('Dazzle — discards every hearth and order card at sites in your region, locked ones excepted', () => {
        const s = board(
            {},
            {
                c1: ['denizen.hearth.rowdy-pub'],
                c2: ['denizen.order.captains', 'denizen.beast.rangers'],
                h1: ['denizen.hearth.storyteller']
            }
        )
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
    it('Animal Host — warbands equal to beast cards at sites, itself included when played to one', () => {
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
        s.getPlayerState('ruler').setAdvisers([
            { cardId: 'denizen.discord.charlatan', faceUp: false }
        ])
        const a = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, {
                playerId: 'ruler',
                cardId: 'denizen.discord.charlatan',
                play: SearchPlay.Site
            })
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
        expect(() =>
            playDrawnCard(s, 'denizen.nomad.great-herd', SearchPlay.Site, [
                card('denizen.beast.rangers')
            ])
        ).toThrow(/not among the options/)
    })

    describe('Great Herd and a Nomad card at its own site: two cards at one site swap to the same place (R-10.25)', () => {
        const HERD = 'denizen.nomad.great-herd'
        const TENTS = 'denizen.nomad.tents'
        const SACRED_GROUND = 'denizen.nomad.sacred-ground'
        const at = (
            revision: OathRevision,
            denizens: Record<string, string[]>,
            over: Parameters<typeof board>[0] = {}
        ) => {
            const s = board(over, denizens)
            s.oathRevision = revision
            return s
        }

        it('played to the site that holds the Nomad card and swapped with it, both cards stay where they are', () => {
            const s = at(OathRevision.EngineFixes6, { c1: [TENTS] })
            const before = placedDenizens(s)
            const a = playDrawnCard(s, HERD, SearchPlay.Site, [card(TENTS)])
            expect(s.denizensBySite['c1']).toEqual([TENTS, HERD])
            expect(placedDenizens(s)).toEqual([...before, HERD].sort())
            expect(a.metadata?.whenPlayed).toMatch(/swapped Great Herd with denizen.nomad.tents/)
        })

        it('a Nomad card at another site still trades places with it, beside one at its own site', () => {
            const s = at(OathRevision.EngineFixes6, { c1: [TENTS], h1: ['denizen.nomad.oracle'] })
            const before = placedDenizens(s)
            playDrawnCard(s, HERD, SearchPlay.Site, [card('denizen.nomad.oracle')])
            expect(s.denizensBySite['c1']).toEqual([TENTS, 'denizen.nomad.oracle'])
            expect(s.denizensBySite['h1']).toEqual([HERD])
            expect(placedDenizens(s)).toEqual([...before, HERD].sort())
        })

        it('a locked Nomad card at its own site is not among the options (its Q&A)', () => {
            const s = at(OathRevision.EngineFixes6, { c1: [SACRED_GROUND] })
            expect(() => playDrawnCard(s, HERD, SearchPlay.Site, [card(SACRED_GROUND)])).toThrow(
                /not among the options/
            )
        })

        it('the swap itself: same site changes nothing; different sites and an adviser trade places', () => {
            const same = at(OathRevision.EngineFixes6, { c1: [TENTS, HERD] })
            swapPlayedCardWithSiteCard(same, 'ruler', HERD, TENTS)
            expect(same.denizensBySite['c1']).toEqual([TENTS, HERD])

            const apart = at(OathRevision.EngineFixes6, { c1: [HERD], h1: [TENTS] })
            swapPlayedCardWithSiteCard(apart, 'ruler', HERD, TENTS)
            expect(apart.denizensBySite['c1']).toEqual([TENTS])
            expect(apart.denizensBySite['h1']).toEqual([HERD])

            // Horned Mask's case: one of the user's faceup advisers and a card at a site.
            const held = at(
                OathRevision.EngineFixes6,
                { c1: [TENTS] },
                { ruler: { advisers: [{ cardId: HERD, faceUp: true }] } }
            )
            const before = placedDenizens(held)
            swapPlayedCardWithSiteCard(held, 'ruler', HERD, TENTS)
            expect(held.denizensBySite['c1']).toEqual([HERD])
            expect(held.getPlayerState('ruler').advisers).toEqual([{ cardId: TENTS, faceUp: true }])
            expect(placedDenizens(held)).toEqual(before)
        })

        it('before revision 10 a recorded game replays as it was recorded: the site is left with Great Herd twice', () => {
            const s = at(OathRevision.EngineFixes5, { c1: [TENTS] })
            playDrawnCard(s, HERD, SearchPlay.Site, [card(TENTS)])
            expect(s.denizensBySite['c1']).toEqual([HERD, HERD])
        })
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
            buildAction(SearchResolve, {
                playerId: 'ruler',
                keptCardId: 'denizen.discord.a-small-favor',
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: false
            })
        ).apply(down)
        expect(down.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(2)
    })

    it('a card with no When Played power plays fine, stays inert, and refuses stray choices', () => {
        const s = board()
        const a = playDrawnCard(s, 'denizen.nomad.tents', SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toBeUndefined()
        expect(() =>
            playDrawnCard(board(), 'denizen.nomad.tents', SearchPlay.Adviser, [
                { kind: PowerChoiceKind.Yes }
            ])
        ).toThrow(/takes no choices on this play/)
    })

    it('choices survive the wire on both play actions', () => {
        const s = board()
        s.getPlayerState('ruler').handIds = ['denizen.hearth.fabled-feast', FILLER]
        const a = new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: 'ruler',
                keptCardId: 'denizen.hearth.fabled-feast',
                discardOrder: [FILLER],
                play: SearchPlay.Site,
                choices: [bank(Suit.Beast)]
            })
        )
        expect(a.dehydrate().choices).toEqual([bank(Suit.Beast)])
    })
})

describe('from revision 10, Animal Host and Fabled Feast count themselves only where their text counts cards', () => {
    const ANIMAL_HOST = 'denizen.beast.animal-host'
    const FABLED_FEAST = 'denizen.hearth.fabled-feast'
    const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
    const BEASTS = { c2: ['denizen.beast.rangers'], h1: ['denizen.beast.wolves'] }

    type Board = ReturnType<typeof board>
    const at = (revision: OathRevision, s: Board) => {
        s.oathRevision = revision
        return s
    }
    const now = (
        over: Parameters<typeof board>[0] = {},
        denizens: Parameters<typeof board>[1] = {}
    ) => at(OathRevision.EngineFixes6, board(over, denizens))
    const before = (
        over: Parameters<typeof board>[0] = {},
        denizens: Parameters<typeof board>[1] = {}
    ) => at(OathRevision.EngineFixes5, board(over, denizens))
    const warbands = (s: Board) => s.getPlayerState('ruler').warbandsOnBoard['ruler']

    /** `cit`, a Citizen at c1, where only the Empire's warbands stand; the Chancellor's bank holds `imperial`. */
    function citizenBoard(
        revision: OathRevision,
        denizens: Record<string, string[]> = {},
        imperial = 10
    ) {
        const s = testState(
            [
                testPlayer({
                    playerId: 'cit',
                    color: Color.Yellow,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1',
                    favor: 3,
                    secrets: 2,
                    supply: 2,
                    warbandsOnBoard: {},
                    warbandsInPersonalBank: { cit: 10 }
                }),
                testPlayer({
                    playerId: 'chan',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'h1',
                    warbandsOnBoard: {},
                    warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: imperial }
                })
            ],
            {
                oathRevision: revision,
                chancellorPlayerId: 'chan',
                denizensBySite: { c1: [], c2: [], h1: [], ...denizens },
                warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
                siteCards: { c1: 'site.plains', c2: 'site.river', h1: 'site.wastes' }
            }
        )
        openTurn(s, 'cit')
        return s
    }

    describe('Animal Host — "the total number of beast cards (including Animal Host) at any sites"', () => {
        it('played to the advisers it is not at a site, so it gains one warband per beast card at a site', () => {
            const s = now({}, BEASTS)
            const a = playDrawnCard(s, ANIMAL_HOST, SearchPlay.Adviser)
            expect(warbands(s)).toBe(4)
            expect(a.metadata?.whenPlayed).toBe('gained 2 warbands (2 beast cards at sites)')
        })

        it('played to a site it is one of them', () => {
            const s = now({}, BEASTS)
            const a = playDrawnCard(s, ANIMAL_HOST, SearchPlay.Site)
            expect(s.denizensBySite['c1']).toEqual([ANIMAL_HOST])
            expect(warbands(s)).toBe(5)
            expect(a.metadata?.whenPlayed).toBe('gained 3 warbands (3 beast cards at sites)')
        })

        it('with no beast card at a site, played to the advisers it gains none', () => {
            const s = now()
            const a = playDrawnCard(s, ANIMAL_HOST, SearchPlay.Adviser)
            expect(warbands(s)).toBe(2)
            expect(s.getPlayerState('ruler').warbandsInPersonalBank['ruler']).toBe(6)
            expect(a.metadata?.whenPlayed).toBe('gained 0 warbands (0 beast cards at sites)')
        })

        it('turned faceup from the advisers (R-6.1) it is still not at a site', () => {
            const s = now({}, BEASTS)
            s.getPlayerState('ruler').setAdvisers([{ cardId: ANIMAL_HOST, faceUp: false }])
            const a = new HydratedPlayFacedownAdviser(
                buildAction(PlayFacedownAdviser, {
                    playerId: 'ruler',
                    cardId: ANIMAL_HOST,
                    play: SearchPlay.Adviser
                })
            )
            a.apply(s)
            expect(s.getPlayerState('ruler').advisers).toEqual([
                { cardId: ANIMAL_HOST, faceUp: true }
            ])
            expect(warbands(s)).toBe(4)
            expect(a.metadata?.whenPlayed).toBe('gained 2 warbands (2 beast cards at sites)')
        })

        it('a short bank gives as many as it holds (R-9.3); the count stays the card’s', () => {
            const s = now({ ruler: { warbandsInPersonalBank: { ruler: 1 } } }, BEASTS)
            const a = playDrawnCard(s, ANIMAL_HOST, SearchPlay.Adviser)
            expect(warbands(s)).toBe(3)
            expect(s.getPlayerState('ruler').warbandsInPersonalBank['ruler']).toBe(0)
            expect(a.metadata?.whenPlayed).toBe('gained 1 warband (2 beast cards at sites)')
        })

        it('a Citizen gains the Empire’s warbands from the Chancellor’s bank, as many as it holds', () => {
            const s = citizenBoard(OathRevision.EngineFixes6, BEASTS)
            const a = playDrawnCard(s, ANIMAL_HOST, SearchPlay.Adviser, [], 'cit')
            expect(s.getPlayerState('cit').warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(2)
            expect(s.getPlayerState('chan').warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(8)
            expect(a.metadata?.whenPlayed).toBe(
                'gained 2 Imperial warbands (2 beast cards at sites)'
            )

            const short = citizenBoard(OathRevision.EngineFixes6, BEASTS, 1)
            const b = playDrawnCard(short, ANIMAL_HOST, SearchPlay.Adviser, [], 'cit')
            expect(short.getPlayerState('cit').warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(1)
            expect(short.getPlayerState('chan').warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(0)
            expect(b.metadata?.whenPlayed).toBe(
                'gained 1 Imperial warband (2 beast cards at sites)'
            )
        })

        it('before revision 10 a game keeps the count it was recorded with: played to the advisers it counted itself', () => {
            const s = before({}, BEASTS)
            const a = playDrawnCard(s, ANIMAL_HOST, SearchPlay.Adviser)
            expect(warbands(s)).toBe(5)
            expect(a.metadata?.whenPlayed).toBe('gained 3 warbands (3 beast cards at sites)')

            const none = before()
            playDrawnCard(none, ANIMAL_HOST, SearchPlay.Adviser)
            expect(warbands(none)).toBe(3)

            const site = before({}, BEASTS)
            playDrawnCard(site, ANIMAL_HOST, SearchPlay.Site)
            expect(warbands(site)).toBe(5)
        })
    })

    describe('Fabled Feast — "the number of hearth cards you rule (including Fabled Feast)"', () => {
        const feast = (s: Board, to: SearchPlay) =>
            playDrawnCard(s, FABLED_FEAST, to, [bank(Suit.Beast)])

        it('as an adviser it is ruled, so it counts with the other ruled hearth cards', () => {
            const s = now({}, { c2: [ROWDY_PUB] })
            const a = feast(s, SearchPlay.Adviser)
            expect(a.metadata?.whenPlayed).toBe(
                'took 2 favor (of 2 hearth cards ruled) from the beast bank'
            )
            expect(s.favorBank[Suit.Beast]).toBe(1)
        })

        it('played to a site you rule it is ruled, so it counts', () => {
            const s = now({}, { c2: [ROWDY_PUB] })
            const a = feast(s, SearchPlay.Site)
            expect(s.denizensBySite['c1']).toEqual([FABLED_FEAST])
            expect(a.metadata?.whenPlayed).toBe(
                'took 2 favor (of 2 hearth cards ruled) from the beast bank'
            )
        })

        it('played to a site you do not rule it is not yours, so it does not count', () => {
            const s = now({}, { c2: [ROWDY_PUB] })
            s.warbandsBySite['c1'] = {}
            const a = feast(s, SearchPlay.Site)
            expect(s.denizensBySite['c1']).toEqual([FABLED_FEAST])
            expect(a.metadata?.whenPlayed).toBe(
                'took 1 favor (of 1 hearth cards ruled) from the beast bank'
            )
            expect(s.favorBank[Suit.Beast]).toBe(2)
        })

        it('a Citizen rules a site the Empire’s warbands hold (R-6.6.3), so played there it counts; at a site no one rules it does not', () => {
            const s = citizenBoard(OathRevision.EngineFixes6, { c1: [ROWDY_PUB] })
            const a = playDrawnCard(s, FABLED_FEAST, SearchPlay.Site, [bank(Suit.Beast)], 'cit')
            expect(a.metadata?.whenPlayed).toBe(
                'took 2 favor (of 2 hearth cards ruled) from the beast bank'
            )

            const unruled = citizenBoard(OathRevision.EngineFixes6, { c1: [ROWDY_PUB] })
            unruled.warbandsBySite['c1'] = {}
            const b = playDrawnCard(
                unruled,
                FABLED_FEAST,
                SearchPlay.Site,
                [bank(Suit.Beast)],
                'cit'
            )
            expect(b.metadata?.whenPlayed).toBe(
                'took 0 favor (of 0 hearth cards ruled) from the beast bank'
            )
        })

        it('before revision 10 a game keeps the count it was recorded with: at a site you do not rule it counted itself', () => {
            const s = before({}, { c2: [ROWDY_PUB] })
            s.warbandsBySite['c1'] = {}
            const a = feast(s, SearchPlay.Site)
            expect(a.metadata?.whenPlayed).toBe(
                'took 2 favor (of 2 hearth cards ruled) from the beast bank'
            )
        })
    })
})

describe('Fabled Feast with Marriage, "counts as two hearth advisers", counted as two hearth cards ruled (R-2.2.2-H1)', () => {
    const FABLED_FEAST = 'denizen.hearth.fabled-feast'
    const MARRIAGE = 'denizen.hearth.marriage'
    const KINSHIP = 'denizen.nomad.vow-of-kinship'
    const marriage = (faceUp = true) => ({ advisers: [{ cardId: MARRIAGE, faceUp }] })
    const table = (
        revision: OathRevision,
        over: Parameters<typeof board>[0] = {},
        beastBank = 6
    ) => {
        const s = board(over)
        s.oathRevision = revision
        s.favorBank[Suit.Beast] = beastBank
        return s
    }
    const feast = (s: ReturnType<typeof board>, to: SearchPlay, playerId = 'ruler') =>
        playDrawnCard(s, FABLED_FEAST, to, [bank(Suit.Beast)], playerId)
    const now = OathRevision.EngineFixes12

    it('Marriage faceup and the Feast played as an adviser: X = 3, three favor taken', () => {
        const s = table(now, { ruler: marriage() })
        const a = feast(s, SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toBe(
            'took 3 favor (of 3 hearth cards ruled) from the beast bank'
        )
        expect(s.getPlayerState('ruler').favor).toBe(6)
        expect(s.favorBank[Suit.Beast]).toBe(3)
        // Trade and the Conspiracy count the same three hearth advisers.
        expect(advisersOfSuit(s, 'ruler', Suit.Hearth)).toBe(3)
    })

    it('the Feast played to a site its player rules counts with Marriage; at a site they do not rule only Marriage counts', () => {
        const ruled = table(now, { ruler: marriage() })
        expect(feast(ruled, SearchPlay.Site).metadata?.whenPlayed).toBe(
            'took 3 favor (of 3 hearth cards ruled) from the beast bank'
        )

        const unruled = table(now, { ruler: marriage() })
        unruled.warbandsBySite['c1'] = {}
        expect(feast(unruled, SearchPlay.Site).metadata?.whenPlayed).toBe(
            'took 2 favor (of 2 hearth cards ruled) from the beast bank'
        )
    })

    it('a facedown Marriage is not ruled faceup, so it counts for nothing', () => {
        const s = table(now, { ruler: marriage(false) })
        expect(feast(s, SearchPlay.Adviser).metadata?.whenPlayed).toBe(
            'took 1 favor (of 1 hearth cards ruled) from the beast bank'
        )
    })

    it("another player's Marriage counts for its holder only, not for the Feast's player", () => {
        const s = table(now, { other: marriage() })
        expect(feast(s, SearchPlay.Adviser).metadata?.whenPlayed).toBe(
            'took 1 favor (of 1 hearth cards ruled) from the beast bank'
        )
    })

    it('the bank gives what it holds (R-9.3)', () => {
        const s = table(now, { ruler: marriage() }, 2)
        expect(feast(s, SearchPlay.Adviser).metadata?.whenPlayed).toBe(
            'took 2 favor (of 3 hearth cards ruled) from the beast bank'
        )
        expect(s.favorBank[Suit.Beast]).toBe(0)
    })

    it('with Vow of Kinship the three favor go to the nomad bank', () => {
        const s = table(now, {
            ruler: {
                favor: 0,
                advisers: [
                    { cardId: MARRIAGE, faceUp: true },
                    { cardId: KINSHIP, faceUp: true }
                ]
            }
        })
        const nomad = s.favorBank[Suit.Nomad]
        expect(feast(s, SearchPlay.Adviser).metadata?.whenPlayed).toBe(
            'took 3 favor (of 3 hearth cards ruled) from the beast bank'
        )
        expect(s.favorBank[Suit.Nomad]).toBe(nomad + 3)
        expect(s.getPlayerState('ruler').favor).toBe(0)
    })

    it('R-X.4 — before revision 16 Marriage counts once: X = 2', () => {
        const s = table(OathRevision.EngineFixes11, { ruler: marriage() })
        expect(feast(s, SearchPlay.Adviser).metadata?.whenPlayed).toBe(
            'took 2 favor (of 2 hearth cards ruled) from the beast bank'
        )
        expect(s.favorBank[Suit.Beast]).toBe(4)
    })
})
