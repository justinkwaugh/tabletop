import { describe, expect, it } from 'vitest'
import { assert, assertExists, Color } from '@tabletop/common'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { CampaignDefend, HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState, OathGameStateValidator } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type CagePlacement } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { battlePlanUse } from '../testing/choices.js'
import { INN } from '../testing/cards.js'
import { openTurn, testBanners, testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { served } from '../testing/projection.js'
import { ongoingCampaign } from '../testing/required.js'
import { OathRevision, CURRENT_OATH_REVISION } from '../util/revision.js'
import '../powers/index.js'

// Relic Hunter: "You may target facedown relics at targeted sites, adding 1 [defenseDie] per relic.
// You may put any relics you take on the bottom of the relic deck." Law 5.5.7 step 7.II takes all
// targeted relics; Relic Thief's Q&A counts a relic taken from the defender as taken.
const HUNTER = 'denizen.order.relic-hunter'
const RELIC_THIEF = 'denizen.discord.relic-thief'
const DRUM = 'relic.dragonskin-drum'
const HORN = 'relic.cracked-horn'
const CAGE = 'relic.obsidian-cage'
const SCEPTER = 'relic.grand-scepter'
const CUP = 'relic.cup-of-plenty'
const DECK = 'relic.whistle'
const SLOT = 'p1-r1'

const HOME: CampaignTarget = { kind: CampaignTargetKind.Site, siteId: 'c1' }
const MARSHES: CampaignTarget = { kind: CampaignTargetKind.Site, siteId: 'p1' }
const SITE_RELIC: CampaignTarget = { kind: CampaignTargetKind.SiteRelic, slotId: SLOT }
const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const held = (cardId: string): CampaignTarget => ({ kind: CampaignTargetKind.Relic, cardId })

/** Ann attacks Bea, both at c1; Bea holds the Drum and the Horn; a facedown Cup lies at p1. */
function board(
    over: Record<string, Partial<OathPlayerState>> = {},
    state: Record<string, unknown> = {},
    extra: OathPlayerState[] = []
) {
    const s = testState(
        [
            testPlayer({ playerId: 'ann', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { ann: 4 }, warbandsInPersonalBank: { ann: 6 }, advisers: [{ cardId: HUNTER, faceUp: true }], ...over['ann'] }),
            testPlayer({ playerId: 'bea', color: Color.Blue, siteId: 'c1', favor: 4, secrets: 2, supply: 4, relicIds: [DRUM, HORN], warbandsOnBoard: { bea: 2 }, warbandsInPersonalBank: { bea: 5 }, ...over['bea'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 }, ...over['chan'] }),
            ...extra
        ],
        {
            chancellorPlayerId: 'chan',
            oathRevision: CURRENT_OATH_REVISION,
            denizensBySite: { c1: [], c2: [INN], p1: [], h1: [] },
            warbandsBySite: { c1: { bea: 2 }, c2: { ann: 2 }, p1: { bea: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { p1: [{ slotId: SLOT }] },
            vault: testVaultWithRelics({ [SLOT]: CUP }),
            ...state
        }
    )
    s.requireVault().relicDeck = [DECK]
    openTurn(s, 'ann')
    return s
}
type Board = ReturnType<typeof board>

/** Ann wins against Bea with the targets and plans given. */
function win(s: Board, targets: CampaignTarget[], plans = [battlePlanUse(HUNTER)], defenderId = 'bea') {
    new HydratedCampaign(buildAction(Campaign, { playerId: 'ann', defender: { kind: 'player', playerId: defenderId }, targets, attackDice: 3, plans })).apply(s)
    // The Cage is a battle plan its holder may use: Bea declines.
    while (s.campaign?.pendingDefenderPlans) {
        const playerId = s.campaign.pendingDefenderPlans.queue[0]
        assertExists(playerId, 'the battle-plan step is open with nobody to answer it')
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId, plans: [] })).apply(s)
    }
    ongoingCampaign(s).swords = 9
    ongoingCampaign(s).defense = 0
    new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'ann', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
    defendingSideChooses(s)
}

type Bottoms = { bottomRelicIds?: string[]; bottomRelicSlotIds?: string[]; cagePlacement?: CagePlacement; banishToSiteId?: string }
const reason = (s: HydratedOathGameState, bottoms: Bottoms = {}) =>
    HydratedCampaignResolveVictory.reasonCannotResolveVictory(s, 'ann', { placements: [], burnFavor: false, ...bottoms })
function resolve(s: Board, bottoms: Bottoms = {}) {
    const v = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'ann', placements: [], burnFavor: false, ...bottoms }))
    v.apply(s)
    return v
}
const relicsOf = (s: Board, playerId: string) => s.getPlayerState(playerId).relicIds

describe('Relic Hunter — any relic the attacker takes may go to the bottom of the relic deck', () => {
    it("a relic taken from the defender's board and kept is the attacker's, as without Relic Hunter", () => {
        const s = board()
        win(s, [HOME, held(DRUM)])
        expect(reason(s)).toBeUndefined()
        const v = resolve(s)
        expect(relicsOf(s, 'ann')).toEqual([DRUM])
        expect(relicsOf(s, 'bea')).toEqual([HORN])
        expect(v.metadata?.relicsTaken).toEqual([DRUM])
        expect(v.metadata?.relicsToDeckBottom).toBeUndefined()
        expect(s.requireVault().relicDeck).toEqual([DECK])
        expect(v.revealsInfo).toBe(false)
    })

    it("a relic taken from the defender's board may go to the bottom: the deck's last card, held by neither, and known to the whole table", () => {
        const s = board()
        win(s, [HOME, held(DRUM)])
        expect(reason(s, { bottomRelicIds: [DRUM] })).toBeUndefined()
        const v = resolve(s, { bottomRelicIds: [DRUM] })
        expect(s.requireVault().relicDeck).toEqual([DECK, DRUM])
        expect(relicsOf(s, 'bea')).toEqual([HORN])
        expect(relicsOf(s, 'ann')).toEqual([])
        expect(v.metadata?.relicsTaken).toEqual([])
        expect(v.metadata?.relicsToDeckBottom).toEqual([DRUM])
        // R-X.3(b) — a card moved into the vault: undo stops here.
        expect(v.revealsInfo).toBe(true)
        // The Drum lay faceup on Bea's board: the table saw where it went (as Fae Merchant's held relic).
        expect(s.seenRelicDeckBottom).toEqual([DRUM])
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([[DRUM], [DRUM], [DRUM]])
    })

    it('a facedown relic at a site keeps both choices, as before', () => {
        const kept = board()
        win(kept, [HOME, MARSHES, SITE_RELIC])
        expect(resolve(kept).metadata?.relicsTaken).toEqual([CUP])
        expect(relicsOf(kept, 'ann')).toEqual([CUP])
        const down = board()
        win(down, [HOME, MARSHES, SITE_RELIC])
        expect(reason(down, { bottomRelicSlotIds: [SLOT] })).toBeUndefined()
        expect(resolve(down, { bottomRelicSlotIds: [SLOT] }).metadata?.relicsToDeckBottom).toEqual([CUP])
        expect(down.requireVault().relicDeck).toEqual([DECK, CUP])
        expect(down.players.map((player) => player.knownRelicDeckBottom)).toEqual([[CUP], [], []])
    })

    it("both together, in the targets' order: each goes where its own choice sends it", () => {
        const s = board()
        win(s, [HOME, MARSHES, held(DRUM), SITE_RELIC, held(HORN)])
        const bottoms = { bottomRelicIds: [HORN, DRUM], bottomRelicSlotIds: [SLOT] }
        expect(reason(s, bottoms)).toBeUndefined()
        const v = resolve(s, bottoms)
        expect(s.requireVault().relicDeck).toEqual([DECK, DRUM, CUP, HORN])
        expect(relicsOf(s, 'bea')).toEqual([])
        expect(relicsOf(s, 'ann')).toEqual([])
        expect(v.metadata?.relicsToDeckBottom).toEqual([DRUM, CUP, HORN])
        // The Cup was facedown: only Ann knows which card lies between the two the table saw.
        expect(s.players.map((player) => player.knownRelicDeckBottom)).toEqual([[DRUM, CUP, HORN], [DRUM, null, HORN], [DRUM, null, HORN]])

        const mixed = board()
        win(mixed, [HOME, MARSHES, held(DRUM), SITE_RELIC, held(HORN)])
        const w = resolve(mixed, { bottomRelicIds: [HORN] })
        expect(relicsOf(mixed, 'ann')).toEqual([DRUM, CUP])
        expect(w.metadata?.relicsTaken).toEqual([DRUM, CUP])
        expect(mixed.requireVault().relicDeck).toEqual([DECK, HORN])
    })

    it('without Relic Hunter as the attacker’s plan, neither bottom choice is accepted, and the relic is the attacker’s', () => {
        const s = board()
        win(s, [HOME, held(DRUM)], [])
        expect(ongoingCampaign(s).plansUsedBy).toEqual({})
        const NO_HUNTER = 'only Relic Hunter, used as your battle plan, puts the relics you take on the bottom of the relic deck'
        expect(reason(s, { bottomRelicIds: [DRUM] })).toBe(NO_HUNTER)
        expect(reason(s, { bottomRelicSlotIds: [SLOT] })).toBe(NO_HUNTER)
        expect(() => resolve(s, { bottomRelicIds: [DRUM] })).toThrow(NO_HUNTER)
        expect(relicsOf(s, 'bea')).toEqual([DRUM, HORN])
        expect(reason(s, { bottomRelicIds: [] })).toBeUndefined()
        resolve(s)
        expect(relicsOf(s, 'ann')).toEqual([DRUM])
    })

    it('only a relic taken in this Campaign: one not targeted, one the attacker holds, a slot not targeted, or one named twice is refused', () => {
        const s = board({ ann: { relicIds: [CUP] } })
        win(s, [HOME, held(DRUM)])
        expect(reason(s, { bottomRelicIds: [HORN] })).toBe(`you did not take ${HORN} from the defender in this Campaign`)
        expect(reason(s, { bottomRelicIds: [CUP] })).toBe(`you did not take ${CUP} from the defender in this Campaign`)
        expect(reason(s, { bottomRelicIds: [DECK] })).toBe(`you did not take ${DECK} from the defender in this Campaign`)
        expect(reason(s, { bottomRelicSlotIds: [SLOT] })).toBe(`you did not take the facedown relic ${SLOT} in this Campaign`)
        expect(reason(s, { bottomRelicIds: [DRUM, DRUM] })).toBe(`${DRUM} is named twice`)
        expect(() => resolve(s, { bottomRelicIds: [HORN] })).toThrow(/did not take/)
        expect(relicsOf(s, 'bea')).toEqual([DRUM, HORN])
    })

    it('a banner is never sent down: it is seized as ever, and its name is no relic taken', () => {
        const s = board({}, { banners: testBanners({ [Banner.DarkestSecret]: 'bea' }) })
        win(s, [HOME, { kind: CampaignTargetKind.Banner, banner: Banner.DarkestSecret }])
        expect(reason(s, { bottomRelicIds: [Banner.DarkestSecret] })).toBe(`you did not take ${Banner.DarkestSecret} from the defender in this Campaign`)
        const v = resolve(s)
        expect(v.metadata?.bannersSeized).toEqual([Banner.DarkestSecret])
        expect(s.banners[Banner.DarkestSecret].holderPlayerId).toBe('ann')
        expect(s.requireVault().relicDeck).toEqual([DECK])
    })

    it('the Grand Scepter taken from the Chancellor may go down too: the card says "any relics", and only Fae Merchant excepts the Scepter', () => {
        const s = board({ ann: { siteId: 'h1' }, chan: { relicIds: [SCEPTER] } }, { warbandsBySite: { c1: { bea: 2 }, c2: { ann: 2 }, p1: { bea: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } } })
        win(s, [{ kind: CampaignTargetKind.Site, siteId: 'h1' }, held(SCEPTER)], [battlePlanUse(HUNTER)], 'chan')
        expect(reason(s, { bottomRelicIds: [SCEPTER] })).toBeUndefined()
        resolve(s, { bottomRelicIds: [SCEPTER] })
        expect(s.requireVault().relicDeck).toEqual([DECK, SCEPTER])
        expect(s.relicHolderOf(SCEPTER)).toBeUndefined()
        expect(s.grandScepterTakenBy).toBeUndefined()
    })
})

describe('Relic Hunter — what follows a relic sent down', () => {
    it('Relic Thief: a relic sent down was not kept, so its holder is asked about the kept ones only, and not at all when none is kept', () => {
        const thief = testPlayer({ playerId: 'rhys', color: Color.Yellow, siteId: 'c2', favor: 2, secrets: 2, advisers: [{ cardId: RELIC_THIEF, faceUp: true }] })
        const none = board({}, {}, [thief])
        win(none, [HOME, held(DRUM), held(HORN)])
        const v = resolve(none, { bottomRelicIds: [DRUM, HORN] })
        expect(none.pendingQuestions?.queue ?? []).toEqual([])
        expect(v.metadata?.triggered).toBeUndefined()

        const one = board({}, {}, [thief])
        win(one, [HOME, held(DRUM), held(HORN)])
        resolve(one, { bottomRelicIds: [DRUM] })
        expect(one.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.RelicThiefRoll, askedPlayerId: 'rhys', takerPlayerId: 'ann', relicCardIds: [HORN] })
    })

    it('Dragonskin Drum sent down has left Bea before the banish, so they are not asked to gain a warband; left on their board, they are', () => {
        const down = board()
        win(down, [HOME, held(DRUM), PAWN])
        resolve(down, { bottomRelicIds: [DRUM], banishToSiteId: 'c2' })
        expect(down.getPlayerState('bea').siteId).toBe('c2')
        expect(down.requireVault().relicDeck).toEqual([DECK, DRUM])
        expect(relicsOf(down, 'ann')).toEqual([])
        expect(down.pendingQuestions?.queue ?? []).toEqual([])

        const kept = board()
        win(kept, [HOME, held(HORN), PAWN])
        resolve(kept, { bottomRelicIds: [HORN], banishToSiteId: 'c2' })
        expect(kept.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.DragonskinDrum, askedPlayerId: 'bea' })
    })

    describe('the Obsidian Cage sent down returns its warbands to boards, as Fae Merchant sends it (R-10.13-H1)', () => {
        const caged = (over: Record<string, number>) => ({ warbandsOnCards: { [CAGE]: over } })
        const onBoard = (s: Board, playerId: string, owner: string) => s.getPlayerState(playerId).warbandsOnBoard[owner] ?? 0
        const inBank = (s: Board, playerId: string, owner: string) => s.getPlayerState(playerId).warbandsInPersonalBank[owner] ?? 0

        it("an Exile's caged warbands go to their own board, and the History names it", () => {
            const s = board({ bea: { relicIds: [CAGE] } }, caged({ ann: 2 }))
            win(s, [HOME, held(CAGE)])
            expect(reason(s, { bottomRelicIds: [CAGE] })).toBeUndefined()
            const before = { board: onBoard(s, 'ann', 'ann'), bank: inBank(s, 'ann', 'ann') }
            let v: HydratedCampaignResolveVictory | undefined
            expectWarbandsConserved(s, () => (v = resolve(s, { bottomRelicIds: [CAGE] })))
            expect(s.warbandsOnCard(CAGE)).toEqual({ ann: 0 })
            expect({ board: onBoard(s, 'ann', 'ann'), bank: inBank(s, 'ann', 'ann') }).toEqual({ board: before.board + 2, bank: before.bank })
            expect(s.requireVault().relicDeck).toEqual([DECK, CAGE])
            expect(v?.metadata?.triggered).toEqual(["Obsidian Cage: its warbands went back: 2 to ann's board"])
        })

        it("the Empire's warbands with two Imperial boards go as the attacker places them; without a placement the victory is refused", () => {
            const cit = testPlayer({ playerId: 'cit', color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'h1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 1 }, warbandsInPersonalBank: { cit: 14 } })
            const s = board({ bea: { relicIds: [CAGE] } }, caged({ [IMPERIAL_WARBANDS]: 2 }), [cit])
            win(s, [HOME, held(CAGE)])
            expect(reason(s, { bottomRelicIds: [CAGE] })).toBe('place the Obsidian Cage’s 2 Imperial warbands on Imperial boards')
            expect(reason(s, { bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'bea', count: 2 }] })).toBe("bea's board is not an Imperial board")
            const placement = [{ playerId: 'chan', count: 1 }, { playerId: 'cit', count: 1 }]
            expect(reason(s, { bottomRelicIds: [CAGE], cagePlacement: placement })).toBeUndefined()
            // Kept, the Cage keeps its warbands, and a placement is refused.
            expect(reason(s, { cagePlacement: placement })).toBe('only the Obsidian Cage sent down places warbands')
            expectWarbandsConserved(s, () => resolve(s, { bottomRelicIds: [CAGE], cagePlacement: placement }))
            expect([onBoard(s, 'chan', IMPERIAL_WARBANDS), onBoard(s, 'cit', IMPERIAL_WARBANDS)]).toEqual([4, 2])
            expect(s.warbandsOnCard(CAGE)).toEqual({ [IMPERIAL_WARBANDS]: 0 })
        })

        it('kept, the Cage goes to the attacker with its warbands on it', () => {
            const s = board({ bea: { relicIds: [CAGE] } }, caged({ ann: 2 }))
            win(s, [HOME, held(CAGE)])
            resolve(s)
            expect(relicsOf(s, 'ann')).toEqual([CAGE])
            expect(s.warbandsOnCard(CAGE)).toEqual({ ann: 2 })
        })

        it('in a game created before revision 17 (R-X.4) its warbands return to their banks, as the Cage sent down did then', () => {
            const s = board({ bea: { relicIds: [CAGE] } }, { ...caged({ ann: 2 }), oathRevision: OathRevision.EngineFixes12 })
            win(s, [HOME, held(CAGE)])
            expect(reason(s, { bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'chan', count: 2 }] })).toBe('only the Obsidian Cage sent down places warbands')
            const before = { board: onBoard(s, 'ann', 'ann'), bank: inBank(s, 'ann', 'ann') }
            expectWarbandsConserved(s, () => resolve(s, { bottomRelicIds: [CAGE] }))
            expect(s.warbandsOnCard(CAGE)).toEqual({ ann: 0 })
            expect({ board: onBoard(s, 'ann', 'ann'), bank: inBank(s, 'ann', 'ann') }).toEqual({ board: before.board, bank: before.bank + 2 })
        })
    })
})

describe("Relic Hunter's bottom choice on a player's own view", () => {
    it("the attacker's served view gives every bottom choice the host's answer, reading nothing hidden, and the deck's order is not needed", () => {
        const s = board()
        win(s, [HOME, MARSHES, held(DRUM), SITE_RELIC])
        const view = { kind: 'player' as const, playerId: 'ann' }
        const before = JSON.stringify(served(s, view))
        // The guard throws on any read of a host-only or another player's hidden value.
        const guarded = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
        const choices: Bottoms[] = [{}, { bottomRelicIds: [DRUM] }, { bottomRelicSlotIds: [SLOT] }, { bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] }, { bottomRelicIds: [HORN] }, { bottomRelicIds: [DRUM, DRUM] }, { bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'chan', count: 1 }] }]
        for (const choice of choices) expect(reason(guarded, choice)).toBe(reason(s, choice))
        // The view judges, and does not just pass everything: Relic Hunter's two choices are accepted, the rest refused.
        expect(reason(guarded, { bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] })).toBeUndefined()
        expect(reason(guarded, { bottomRelicIds: [HORN] })).toMatch(/did not take/)
        expect(reason(guarded, { bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'chan', count: 1 }] })).toMatch(/did not take/)
        expect(JSON.stringify(served(s, view))).toBe(before)
    })

    it("the record names the defender's relic sent down to everyone; a facedown relic sent down stays the attacker's alone", () => {
        const s = board()
        win(s, [HOME, MARSHES, held(DRUM), SITE_RELIC])
        const record = resolve(s, { bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] }).dehydrate()
        for (const perspective of [{ kind: 'player', playerId: 'bea' } as const, { kind: 'spectator' } as const]) {
            const theirs = OathVisibility.actions.project(record, perspective)
            expect(theirs).toMatchObject({ bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] })
            expect(JSON.stringify(theirs)).not.toContain(CUP)
            const state = s.dehydrate()
            assert(OathGameStateValidator.Check(state), 'the engine holds canonical state')
            expect(JSON.stringify(OathVisibility.state.project(state, perspective))).not.toContain(CUP)
        }
    })
})
