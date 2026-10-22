import { describe, expect, it } from 'vitest'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { Banner, Region, Suit } from '../model/oathEnums.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { advisersTowardLimit } from '../util/continuous.js'
import '../powers/index.js'
import { createOathVault } from '../model/vault.js'
import { getPrng } from '@tabletop/common'
import { adviserDiscardsNeeded, playCard, reasonCannotPlayCard } from '../util/cardPlay.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathRevision } from '../util/revision.js'
import { served } from '../testing/projection.js'
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
        // Its Q&A: played, it prompts no discard; held, it "still counts toward your total number of advisers".
        const s = rulerTable([], [PIPER, WOLVES, INN], {}, { oathRevision: OathRevision.EngineFixes7 })
        expect(advisersTowardLimit(s, 'ruler')).toBe(3)
        expect(() => playDrawnCard(s, ELDERS, SearchPlay.Adviser)).toThrow(/adviser limit/)
        // Before revision 11 it never counted, so a fourth adviser was kept.
        const old = rulerTable([], [PIPER, WOLVES, INN], {}, { oathRevision: OathRevision.EngineFixes6 })
        expect(advisersTowardLimit(old, 'ruler')).toBe(2)
        playDrawnCard(old, ELDERS, SearchPlay.Adviser)
        expect(old.getPlayerState('ruler').advisers).toHaveLength(4)
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

    // Its Q&A: "count and discard cards at all sites. Do not count or discard advisers"; "other" spares Riots alone.
    describe('Riots — from revision 10, played to a site it is one of the cards on the map it counts', () => {
        const MERCENARIES = 'denizen.discord.mercenaries'
        const STORYTELLER = 'denizen.hearth.storyteller'
        const BOILING_LAKE = 'denizen.discord.boiling-lake'

        const riot = (revision: OathRevision, denizens: Record<string, string[]>) =>
            rulerTable([], [], {}, { ...mob, oathRevision: revision, denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizens } })
        /** Discord 2 with Riots at c1, Hearth 2. */
        const tied = (revision: OathRevision) => riot(revision, { c2: [MERCENARIES], h1: [INN, STORYTELLER] })
        /** Discord 2 with Riots at c1, Hearth 1. */
        const discordLeads = (revision: OathRevision) => riot(revision, { c2: [MERCENARIES], h1: [INN] })

        it('a tie with Discord, Riots counted, lets its player name Discord: the other Discord cards go, Riots stays', () => {
            const s = tied(OathRevision.EngineFixes6)
            const a = playDrawnCard(s, RIOTS, SearchPlay.Site, [bank(Suit.Discord)])
            expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [INN, STORYTELLER] })
            expect(a.metadata?.whenPlayed).toBe('Riots: discarded 1 discord cards from the map')
        })

        it('the same tie may be broken for Hearth instead, and must be broken', () => {
            const s = tied(OathRevision.EngineFixes6)
            playDrawnCard(s, RIOTS, SearchPlay.Site, [bank(Suit.Hearth)])
            expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [MERCENARIES], p1: [], h1: [] })
            expect(() => playDrawnCard(tied(OathRevision.EngineFixes6), RIOTS, SearchPlay.Site)).toThrow(/the most common suit is tied/)
        })

        it('Discord leading with Riots counted needs no pick, and no other suit may be named', () => {
            const s = discordLeads(OathRevision.EngineFixes6)
            playDrawnCard(s, RIOTS, SearchPlay.Site)
            expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [INN] })
            expect(() => playDrawnCard(discordLeads(OathRevision.EngineFixes6), RIOTS, SearchPlay.Site, [bank(Suit.Hearth)])).toThrow(
                /hearth is not the most common suit on the map \(discord\)/
            )
        })

        it('played to the advisers it is neither counted nor discarded', () => {
            expect(() => playDrawnCard(discordLeads(OathRevision.EngineFixes6), RIOTS, SearchPlay.Adviser)).toThrow(/the most common suit is tied/)
            const s = discordLeads(OathRevision.EngineFixes6)
            playDrawnCard(s, RIOTS, SearchPlay.Adviser, [bank(Suit.Discord)])
            expect(s.denizensBySite).toEqual({ c1: [], c2: [], p1: [], h1: [INN] })
            expect(s.getPlayerState('ruler').advisers).toEqual([{ cardId: RIOTS, faceUp: true }])
        })

        it('a locked Discord card at a site is counted and stays (R-7.2.2)', () => {
            const s = riot(OathRevision.EngineFixes6, { c2: [BOILING_LAKE], h1: [INN] })
            const a = playDrawnCard(s, RIOTS, SearchPlay.Site)
            expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [BOILING_LAKE], p1: [], h1: [INN] })
            expect(a.metadata?.whenPlayed).toBe('Riots: discarded 0 discord cards from the map')
        })

        it('alone on the map it is the most common suit, and discards nothing', () => {
            const s = riot(OathRevision.EngineFixes6, {})
            const a = playDrawnCard(s, RIOTS, SearchPlay.Site)
            expect(s.denizensBySite['c1']).toEqual([RIOTS])
            expect(a.metadata?.whenPlayed).toBe('Riots: discarded 0 discord cards from the map')
        })

        it('off the Mob side nothing is counted or discarded', () => {
            const s = rulerTable([], [], {}, { oathRevision: OathRevision.EngineFixes6, denizensBySite: { c1: [], c2: [MERCENARIES], p1: [], h1: [INN, STORYTELLER] } })
            const a = playDrawnCard(s, RIOTS, SearchPlay.Site)
            expect(a.metadata?.whenPlayed).toMatch(/not on the Mob side/)
            expect(s.denizensBySite['c2']).toEqual([MERCENARIES])
        })

        it("the table checks the pick on the player's own view as the server does", () => {
            const own = (s: ReturnType<typeof riot>) => new HydratedOathGameState(served(s, { kind: 'player', playerId: 'ruler' }))
            for (const scene of [tied, discordLeads]) {
                const s = scene(OathRevision.EngineFixes6)
                for (const choices of [[], [bank(Suit.Discord)], [bank(Suit.Hearth)]]) {
                    for (const play of [SearchPlay.Site, SearchPlay.Adviser]) {
                        const reason = (state: HydratedOathGameState) => reasonCannotPlayCard(state, 'ruler', RIOTS, play, { faceUp: true, choices })
                        expect(reason(own(s)), `${scene.name} ${play} ${JSON.stringify(choices)}`).toEqual(reason(s))
                    }
                }
            }
            expect(reasonCannotPlayCard(own(tied(OathRevision.EngineFixes6)), 'ruler', RIOTS, SearchPlay.Site, { choices: [bank(Suit.Discord)] })).toBeUndefined()
        })

        it('before revision 10 a game keeps the count it was recorded with: Riots left itself out', () => {
            expect(() => playDrawnCard(tied(OathRevision.EngineFixes5), RIOTS, SearchPlay.Site, [bank(Suit.Discord)])).toThrow(
                /discord is not the most common suit on the map \(hearth\)/
            )
            expect(() => playDrawnCard(discordLeads(OathRevision.EngineFixes5), RIOTS, SearchPlay.Site)).toThrow(/the most common suit is tied/)
            const s = discordLeads(OathRevision.EngineFixes5)
            playDrawnCard(s, RIOTS, SearchPlay.Site, [bank(Suit.Hearth)])
            expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [MERCENARIES], p1: [], h1: [] })
        })

        it('the resolve judges a named suit on its own count: one that is not the most common is not followed', () => {
            const s = discordLeads(OathRevision.EngineFixes6)
            playCard(s, 'ruler', RIOTS, SearchPlay.Site, Region.Cradle, { choices: [bank(Suit.Hearth)] })
            expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [INN] })
        })

        // The People's Favor, the Great Slum (R-11.10) and Crop Rotation discard a card before the site play, and
        // Land Warden's kept card lands before the second card: the check counts the map as Riots will resolve on it.
        describe('the check counts the map as it will be when Riots resolves', () => {
            const SCRYER = 'denizen.discord.scryer'
            const LAND_WARDEN = 'denizen.hearth.land-warden'
            const CROP_ROTATION = 'denizen.hearth.crop-rotation'
            const now = OathRevision.EngineFixes6
            const table = (revision: OathRevision, denizens: Record<string, string[]>, extra: Record<string, unknown> = {}) =>
                rulerTable([], [], {}, { ...mob, oathRevision: revision, ...extra, denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizens } })
            const favorHeld = { banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: true, holderPlayerId: 'ruler' }, [Banner.DarkestSecret]: { value: 1 } } }
            /** Discord 2 with Riots at c1 against Hearth 2; the Inn at c2 discarded first leaves Discord leading 2–1. */
            const innFirstLeavesDiscord = (revision: OathRevision) => table(revision, { c2: [INN, STORYTELLER], p1: [MERCENARIES] }, favorHeld)
            /** Hearth 3 against Discord 2 with Riots; the Inn discarded first makes it a tie. */
            const innFirstTies = (revision: OathRevision) => table(revision, { c2: [INN, STORYTELLER], p1: [MERCENARIES], h1: [HOMESTEADERS] }, favorHeld)
            const riotsKept = (extra: Record<string, unknown>) => ({ keptCardId: RIOTS, discardOrder: [FILLER], play: SearchPlay.Site, ...extra })
            const check = (s: HydratedOathGameState, extra: Record<string, unknown>) => {
                s.getPlayerState('ruler').handIds = [RIOTS, FILLER]
                return HydratedSearchResolve.reasonCannotResolve(s, 'ruler', riotsKept(extra))
            }
            const resolve = (s: HydratedOathGameState, extra: Record<string, unknown>) => {
                s.getPlayerState('ruler').handIds = [RIOTS, FILLER]
                const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', ...riotsKept(extra) }))
                a.apply(s)
                return a
            }
            const innFirst = { discardFirstCardId: INN }

            it("the People's Favor: with a Hearth card discarded first Discord leads, so Hearth may not be named and Discord goes", () => {
                expect(check(innFirstLeavesDiscord(now), { ...innFirst, choices: [bank(Suit.Hearth)] })).toMatch(
                    /hearth is not the most common suit on the map \(discord\)/
                )
                expect(check(innFirstLeavesDiscord(now), innFirst)).toBeUndefined()
                const s = innFirstLeavesDiscord(now)
                const a = resolve(s, innFirst)
                expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [STORYTELLER], p1: [], h1: [] })
                expect(a.metadata?.discardedCardIds).toEqual([FILLER, INN])
                expect(a.metadata?.whenPlayed).toBe('Riots: discarded 1 discord cards from the map')
            })

            it('a card discarded first that turns a lead into a tie asks for a suit, and either tied suit may be named', () => {
                expect(check(innFirstTies(now), innFirst)).toMatch(/the most common suit is tied \(.+\); name one/)
                const s = innFirstTies(now)
                resolve(s, { ...innFirst, choices: [bank(Suit.Discord)] })
                expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [STORYTELLER], p1: [], h1: [HOMESTEADERS] })
                const t = innFirstTies(now)
                resolve(t, { ...innFirst, choices: [bank(Suit.Hearth)] })
                expect(t.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [MERCENARIES], h1: [] })
            })

            it('the Great Slum: the card discarded there first is not counted', () => {
                const slum = () =>
                    table(now, { c1: [INN], c2: [STORYTELLER], p1: [MERCENARIES] }, { siteCards: { c1: 'site.great-slums', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
                expect(check(slum(), { ...innFirst, choices: [bank(Suit.Hearth)] })).toMatch(/hearth is not the most common suit on the map \(discord\)/)
                const s = slum()
                resolve(s, innFirst)
                expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [STORYTELLER], p1: [], h1: [] })
            })

            it('Crop Rotation: the card discarded at the site first is not counted', () => {
                const s = table(now, { c1: [CROP_ROTATION, INN], p1: [MERCENARIES] })
                s.getPlayerState('ruler').handIds = []
                s.requireVault().worldDeck = [RIOTS, FILLER]
                new HydratedSearch(buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(CROP_ROTATION)] })).apply(s)
                expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', riotsKept({ ...innFirst, choices: [bank(Suit.Hearth)] }))).toMatch(
                    /hearth is not the most common suit on the map \(discord\)/
                )
                new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', ...riotsKept(innFirst) })).apply(s)
                expect(s.denizensBySite).toEqual({ c1: [CROP_ROTATION, RIOTS], c2: [], p1: [], h1: [] })
            })

            /** The ruler holds Land Warden and has searched with it, drawing these cards. */
            const searched = (revision: OathRevision, drawn: string[], denizens: Record<string, string[]>) => {
                const s = table(revision, denizens)
                s.getPlayerState('ruler').advisers = [{ cardId: LAND_WARDEN, faceUp: true }]
                s.getPlayerState('ruler').handIds = []
                s.requireVault().worldDeck = drawn
                new HydratedSearch(buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })).apply(s)
                return s
            }
            const both = (kept: string, second: string) => ({
                keptCardId: kept,
                discardOrder: [FILLER],
                play: SearchPlay.Site,
                secondPlay: { cardId: second, play: SearchPlay.Site }
            })
            /** Discord 2 with Riots, Hearth 1 — and Hearth 2 once Storyteller, kept, lands first: a tie the second card cannot name. */
            const hearthKept = (revision: OathRevision) => searched(revision, [STORYTELLER, RIOTS, FILLER], { p1: [MERCENARIES], h1: [INN] })
            /** Discord 2 with Riots against Hearth 2 — and Discord 3 once Scryer, kept, lands first. */
            const discordKept = (revision: OathRevision) => searched(revision, [SCRYER, RIOTS, FILLER], { p1: [MERCENARIES], h1: [INN, STORYTELLER] })

            describe("Land Warden: the kept card's site play lands before the second card's Riots resolves", () => {
                it('a kept card that makes a tie is counted at the check, which refuses the second card (it names no suit)', () => {
                    expect(HydratedSearchResolve.reasonCannotResolve(hearthKept(now), 'ruler', both(STORYTELLER, RIOTS))).toMatch(
                        /second card: the most common suit is tied \(.+\); name one/
                    )
                })

                it('a kept card that breaks a tie is counted at the check, and Riots discards it with the other Discord cards', () => {
                    const s = discordKept(now)
                    expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', both(SCRYER, RIOTS))).toBeUndefined()
                    const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', ...both(SCRYER, RIOTS) }))
                    a.apply(s)
                    expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [INN, STORYTELLER] })
                    expect(a.metadata?.secondWhenPlayed).toBe('Riots: discarded 2 discord cards from the map')
                })

                it('Riots kept resolves before the second card lands, at the check and at the resolve', () => {
                    const s = searched(now, [RIOTS, STORYTELLER, FILLER], { p1: [MERCENARIES], h1: [INN] })
                    expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', both(RIOTS, STORYTELLER))).toBeUndefined()
                    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', ...both(RIOTS, STORYTELLER) })).apply(s)
                    expect(s.denizensBySite).toEqual({ c1: [RIOTS, STORYTELLER], c2: [], p1: [], h1: [INN] })
                })
            })

            // Riots' Q&A counts the cards at all sites when it resolves; played second it resolves after the kept card's
            // own When Played power, which may discard or move cards off the map. The second card names no suit
            // (docs/known-deviations.md), so a tie on that map refuses it and a lead on that map lets it go.
            describe("Land Warden from revision 26: Riots played second counts the map after the kept card's When Played power", () => {
                const DAZZLE = 'denizen.arcane.dazzle'
                const ROAR = 'denizen.beast.threatening-roar'
                const SALT = 'denizen.discord.salt-the-earth'
                const PILGRIMAGE = 'denizen.nomad.pilgrimage'
                const before = OathRevision.EngineFixes21
                const fixed = OathRevision.EngineFixes22
                const keptThenRiots = (kept: string, keptPlay: Record<string, unknown> = {}, riotsPlay: Record<string, unknown> = {}) => ({
                    keptCardId: kept,
                    discardOrder: [FILLER],
                    play: SearchPlay.Site,
                    ...keptPlay,
                    secondPlay: { cardId: RIOTS, play: SearchPlay.Site, ...riotsPlay }
                })
                /** The ruler holds Land Warden and has searched with it, drawing the kept card, Riots and a filler. */
                const warden = (revision: OathRevision, kept: string, denizens: Record<string, string[]>) => {
                    const s = rulerTable([], [LAND_WARDEN], {}, { ...mob, oathRevision: revision, denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizens } })
                    s.getPlayerState('ruler').handIds = []
                    s.requireVault().worldDeck = [kept, RIOTS, FILLER]
                    new HydratedSearch(buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })).apply(s)
                    s.requireVault().dispossessed = [SCRYER]
                    s.dispossessedCount = 1
                    return s
                }
                const checkOf = (s: HydratedOathGameState, choice: ReturnType<typeof keptThenRiots>) =>
                    HydratedSearchResolve.reasonCannotResolve(s, 'ruler', choice)
                const resolveOf = (s: HydratedOathGameState, choice: ReturnType<typeof keptThenRiots>) => {
                    const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', ...choice }))
                    a.apply(s)
                    return a
                }
                const tiedSecond = /second card: the most common suit is tied \(.+\); name one/
                /** Hearth 3 against Discord 2 with Riots; Dazzle at c1 discards the Inn in the Cradle, which ties them 2–2. */
                const dazzleTies = (revision: OathRevision) =>
                    warden(revision, DAZZLE, { c2: [INN], p1: [MERCENARIES], h1: [STORYTELLER, HOMESTEADERS] })
                /** Hearth 2 against Discord 2 with Riots; Dazzle discards the Inn in the Cradle, which leaves Discord leading. */
                const dazzleBreaks = (revision: OathRevision) =>
                    warden(revision, DAZZLE, { c2: [INN], p1: [MERCENARIES], h1: [STORYTELLER] })
                const dazzleThenRiots = keptThenRiots(DAZZLE)

                it('Dazzle makes a tie: the check sees it and refuses Riots second, which names no suit, so no suit is picked for the player', () => {
                    expect(checkOf(dazzleTies(fixed), dazzleThenRiots)).toMatch(tiedSecond)
                    expect(() => resolveOf(dazzleTies(fixed), dazzleThenRiots)).toThrow(tiedSecond)
                })

                it('Dazzle breaks a tie: the check accepts Riots second, and Riots discards the Discord cards that lead', () => {
                    const s = dazzleBreaks(fixed)
                    expect(checkOf(s, dazzleThenRiots)).toBeUndefined()
                    const a = resolveOf(s, dazzleThenRiots)
                    expect(s.denizensBySite).toEqual({ c1: [DAZZLE, RIOTS], c2: [], p1: [], h1: [STORYTELLER] })
                    expect(a.metadata?.secondWhenPlayed).toBe('Riots: discarded 1 discord cards from the map')
                })

                it('Dazzle played as a faceup adviser discards as it does at a site; played facedown it has no When Played power', () => {
                    const faceup = keptThenRiots(DAZZLE, { play: SearchPlay.Adviser, faceUp: true })
                    const s = dazzleBreaks(fixed)
                    expect(checkOf(s, faceup)).toBeUndefined()
                    resolveOf(s, faceup)
                    expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [STORYTELLER] })
                    const facedown = keptThenRiots(DAZZLE, { play: SearchPlay.Adviser, faceUp: false })
                    expect(checkOf(dazzleBreaks(fixed), facedown)).toMatch(tiedSecond)
                })

                it('Threatening Roar discards itself with the Beast cards in the region, so neither is counted', () => {
                    const roarThenRiots = keptThenRiots(ROAR)
                    // Beast 2 with Roar against Discord 2 with Riots, and none of the Beast cards left once Roar resolves.
                    const s = warden(fixed, ROAR, { c2: [WOLVES], p1: [MERCENARIES] })
                    expect(checkOf(s, roarThenRiots)).toBeUndefined()
                    resolveOf(s, roarThenRiots)
                    expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [] })
                    // Beast 3 with Roar against Discord 2: Pied Piper, outside the region, is the one Beast card left.
                    const t = warden(fixed, ROAR, { c2: [WOLVES], p1: [MERCENARIES], h1: [PIPER] })
                    expect(checkOf(t, roarThenRiots)).toBeUndefined()
                    resolveOf(t, roarThenRiots)
                    expect(t.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [PIPER] })
                })

                it('Salt the Earth discards the other denizens at its site; Riots, a faceup adviser, then finds Discord leading', () => {
                    const saltThenRiots = keptThenRiots(SALT, {}, { play: SearchPlay.Adviser, faceUp: true })
                    // Hearth 2 against Discord 2 with Salt the Earth; the Inn at c1 is discarded by Salt.
                    const s = warden(fixed, SALT, { c1: [INN], p1: [MERCENARIES], h1: [STORYTELLER] })
                    expect(checkOf(s, saltThenRiots)).toBeUndefined()
                    resolveOf(s, saltThenRiots)
                    expect(s.denizensBySite).toEqual({ c1: [SALT], c2: [], p1: [], h1: [STORYTELLER] })
                    expect(s.getPlayerState('ruler').advisers.map((a) => a.cardId)).toContain(RIOTS)
                })

                it('Pilgrimage moves the denizens at your site to the Dispossessed before Riots counts', () => {
                    const pilgrimageThenRiots = keptThenRiots(PILGRIMAGE, { play: SearchPlay.Adviser, faceUp: true })
                    // Hearth 2 against Discord 2 with Riots; the Inn at c1 goes to the Dispossessed.
                    const s = warden(fixed, PILGRIMAGE, { c1: [INN], p1: [MERCENARIES], h1: [STORYTELLER] })
                    expect(checkOf(s, pilgrimageThenRiots)).toBeUndefined()
                    resolveOf(s, pilgrimageThenRiots)
                    expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [], h1: [STORYTELLER] })
                })

                it("the table judges the pair on the player's own view as the server does", () => {
                    const own = (s: HydratedOathGameState) => new HydratedOathGameState(served(s, { kind: 'player', playerId: 'ruler' }))
                    const scenes: [string, () => HydratedOathGameState, ReturnType<typeof keptThenRiots>][] = [
                        ['dazzle ties', () => dazzleTies(fixed), dazzleThenRiots],
                        ['dazzle breaks', () => dazzleBreaks(fixed), dazzleThenRiots],
                        ['dazzle adviser', () => dazzleBreaks(fixed), keptThenRiots(DAZZLE, { play: SearchPlay.Adviser, faceUp: true })],
                        ['roar', () => warden(fixed, ROAR, { c2: [WOLVES], p1: [MERCENARIES] }), keptThenRiots(ROAR)],
                        ['salt', () => warden(fixed, SALT, { c1: [INN], p1: [MERCENARIES], h1: [STORYTELLER] }), keptThenRiots(SALT, {}, { play: SearchPlay.Adviser, faceUp: true })],
                        ['pilgrimage', () => warden(fixed, PILGRIMAGE, { c1: [INN], p1: [MERCENARIES], h1: [STORYTELLER] }), keptThenRiots(PILGRIMAGE, { play: SearchPlay.Adviser, faceUp: true })]
                    ]
                    for (const [name, scene, choice] of scenes) {
                        const s = scene()
                        expect(checkOf(own(s), choice), name).toEqual(checkOf(s, choice))
                    }
                })

                it('before revision 26 a game keeps the check it was recorded with: the map before the kept card resolves', () => {
                    expect(checkOf(dazzleBreaks(before), dazzleThenRiots)).toMatch(tiedSecond)
                    const s = dazzleTies(before)
                    expect(checkOf(s, dazzleThenRiots)).toBeUndefined()
                    const a = resolveOf(s, dazzleThenRiots)
                    expect(s.denizensBySite).toEqual({ c1: [DAZZLE, RIOTS], c2: [], p1: [], h1: [STORYTELLER, HOMESTEADERS] })
                    expect(a.metadata?.secondWhenPlayed).toBe('Riots: discarded 1 discord cards from the map')
                })
            })

            it('before revision 10 a game keeps the count it was recorded with: the card discarded first was counted', () => {
                expect(check(innFirstLeavesDiscord(OathRevision.EngineFixes5), { ...innFirst, choices: [bank(Suit.Hearth)] })).toBeUndefined()
                const s = innFirstLeavesDiscord(OathRevision.EngineFixes5)
                resolve(s, { ...innFirst, choices: [bank(Suit.Hearth)] })
                expect(s.denizensBySite).toEqual({ c1: [RIOTS], c2: [], p1: [MERCENARIES], h1: [] })
            })

            it("the table checks the pick on the player's own view as the server does", () => {
                const own = (s: HydratedOathGameState) => new HydratedOathGameState(served(s, { kind: 'player', playerId: 'ruler' }))
                for (const choices of [[], [bank(Suit.Discord)], [bank(Suit.Hearth)]]) {
                    for (const scene of [innFirstLeavesDiscord, innFirstTies]) {
                        const s = scene(now)
                        const reason = (state: HydratedOathGameState) =>
                            reasonCannotPlayCard(state, 'ruler', RIOTS, SearchPlay.Site, { ...innFirst, choices })
                        expect(reason(own(s)), `${scene.name} ${JSON.stringify(choices)}`).toEqual(reason(s))
                    }
                }
                for (const [scene, kept] of [[hearthKept, STORYTELLER], [discordKept, SCRYER]] as const) {
                    const s = scene(now)
                    const reason = (state: HydratedOathGameState) => HydratedSearchResolve.reasonCannotResolve(state, 'ruler', both(kept, RIOTS))
                    expect(reason(own(s)), kept).toEqual(reason(s))
                }
                expect(
                    reasonCannotPlayCard(own(innFirstLeavesDiscord(now)), 'ruler', RIOTS, SearchPlay.Site, { ...innFirst, choices: [bank(Suit.Hearth)] })
                ).toMatch(/hearth is not the most common suit on the map \(discord\)/)
                expect(HydratedSearchResolve.reasonCannotResolve(own(discordKept(now)), 'ruler', both(SCRYER, RIOTS))).toBeUndefined()
            })
        })
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
        const swapped = playDrawnCard(s, TWIN, SearchPlay.Adviser, [card(TENTS)])
        expect(swapped.metadata?.whenPlayed).toBe(`Twin Brother went to other's advisers; ${TENTS} to ruler's advisers`)
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
        const contested = { warbandsBySite: { c1: { other: 1 }, p1: { other: 3 } } }
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
        const carried = actionPowerUse('ruler', PALANQUIN, [player('other'), site('c2')])
        carried.apply(lake)
        expect(lake.getPlayerState('other').warbandsOnBoard['other']).toBe(0)
        expect(carried.metadata?.summary).toMatch(/^Palanquin: ruler and other went to c2, spending no Supply \(Boiling Lake: killed \d warbands on other's board\)$/)
        const vowed = rulerTable([PALANQUIN], [], { other: { advisers: [{ cardId: 'denizen.beast.vow-of-union', faceUp: true }] } }, { warbandsBySite: { c1: { other: 1 }, c2: { ruler: 2 }, p1: { other: 3 } } })
        expect(() => actionPowerUse('ruler', PALANQUIN, [player('other'), site('c2')]).apply(vowed)).toThrow(/Vow of Union/)
    })

    it("Palanquin — carried out of a Shrouded Wood their enemy rules, the Wood's ruler chooses where they go (R-11.7)", () => {
        const s = rulerTable([PALANQUIN], [], {}, {
            siteCards: { c1: 'site.shrouded-wood', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            warbandsBySite: { c1: { away: 2 }, c2: { ruler: 2 }, p1: { other: 3 } }
        })
        actionPowerUse('ruler', PALANQUIN, [player('other'), site('c2')]).apply(s)
        expect(s.getPlayerState('ruler').siteId).toBe('c2')
        expect(s.getPlayerState('other').siteId).toBe('c1')
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'away', travelerPlayerId: 'other', fromSiteId: 'c1' })

        new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'away', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'p1' } })).apply(s)
        expect(s.getPlayerState('other').siteId).toBe('p1')
    })
})
