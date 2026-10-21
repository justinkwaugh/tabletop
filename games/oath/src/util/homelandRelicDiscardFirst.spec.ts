import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve, type SearchResolveChoice } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedRecover, Recover, RecoverTargetKind } from '../actions/recover.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignResolveVictory, HydratedCampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { CompleteRest, HydratedCompleteRest } from '../actions/completeRest.js'
import { HydratedPeek, Peek, PeekTargetKind } from '../actions/peek.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { Banner } from '../model/oathEnums.js'
import type { HydratedOathGameState } from '../model/gameState.js'
import { openTurn, testPlayer, testState, testVaultWithRelics, withChancellor } from '../testing/fixture.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { FILLER, INN } from '../testing/cards.js'
import { siteDiscardLedgerKey } from './discard.js'
import { homelandPowerFor, homelandRelicSlot } from './sitePowers.js'
import { OathRevision } from './revision.js'
import '../powers/index.js'

const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const HUNTER = 'denizen.order.relic-hunter'
const RELIC = 'relic.ring-of-devotion'
const SLOT = 'c2-r1'

/**
 * Dana stands at c2, the Deep Woods (Homeland: a Beast card played there takes its relic, unless a Beast card was
 * discarded there this turn), holding the People's Favor, with Rangers drawn; Wolves, a Beast card, stands at c2 beside
 * the Wayside Inn (c2 holds two), and the relic in c2's slot is facedown in the vault. Bea, at c2, holds Relic Hunter faceup.
 */
function table(revision: OathRevision = OathRevision.EngineFixes12, c2: string[] = [WOLVES, INN], dana: Record<string, unknown> = {}) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c2', favor: 6, secrets: 4, supply: 6, warbandsOnBoard: { dana: 3 }, handIds: [RANGERS, FILLER], ...dana }),
            testPlayer({ playerId: 'bea', color: Color.Blue, siteId: 'c2', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { bea: 4 }, warbandsInPersonalBank: { bea: 6 }, advisers: [{ cardId: HUNTER, faceUp: true }] })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2, p1: [], h1: [] },
            warbandsBySite: { c2: { dana: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.deep-woods', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { c2: [{ slotId: SLOT }] },
            vault: testVaultWithRelics({ [SLOT]: RELIC })
        }
    )
    openTurn(s, 'dana')
    s.banners[Banner.PeoplesFavor].holderPlayerId = 'dana'
    return s
}

const rangersPlay = (first?: string): SearchResolveChoice => ({ keptCardId: RANGERS, discardOrder: [FILLER], play: SearchPlay.Site, ...(first ? { discardFirstCardId: first } : {}) })

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
    expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)).toBeUndefined()
    const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'dana', ...choice }))
    a.apply(s)
    return a
}

/** Where the relic is: still facedown in the vault behind its slot, or Dana's. */
function relicState(s: HydratedOathGameState) {
    return {
        inVault: s.requireVault().relicFacedown[SLOT],
        slotLeft: s.relicSlotsAt('c2').some((slot) => slot.slotId === SLOT),
        danaHolds: s.getPlayerState('dana').relicIds.includes(RELIC)
    }
}

const stays = { inVault: RELIC, slotLeft: true, danaHolds: false }
const taken = { inVault: undefined, slotLeft: false, danaHolds: true }

describe('a relic Homeland keeps its relic when a card of its suit is discarded there first (R-11.2)', () => {
    it("Rangers played to the Deep Woods with the People's Favor, Wolves discarded there first: no relic, it stays in the vault and its slot, nothing is revealed", () => {
        const s = table()
        const a = resolve(s, rangersPlay(WOLVES))
        expect(relicState(s)).toEqual(stays)
        expect(a.metadata?.reveal).toBeUndefined()
        expect(a.metadata?.sitePower).toMatch(/^Deep Woods: no Homeland gain/)
        // The play is otherwise as before: Wolves goes first, Rangers takes its place and its favor.
        expect(s.denizensAt('c2')).toEqual([INN, RANGERS])
        expect(a.metadata?.discardedCardIds).toContain(WOLVES)
        expect(a.metadata?.favorGained).toBe(1)
    })

    it('a facedown Rangers turned faceup there (R-6.1) with the same discard first leaves the relic too', () => {
        const s = table(OathRevision.EngineFixes12, [WOLVES, INN], { handIds: [], advisers: [{ cardId: RANGERS, faceUp: false }] })
        const a = new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'dana', cardId: RANGERS, play: SearchPlay.Site, discardFirstCardId: WOLVES }))
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', a)).toBeUndefined()
        a.apply(s)
        expect(relicState(s)).toEqual(stays)
        expect(a.metadata?.reveal).toBeUndefined()
    })

    it('a card of another suit discarded first bars nothing: the relic is taken, as before', () => {
        const s = table()
        const a = resolve(s, rangersPlay(INN))
        expect(relicState(s)).toEqual(taken)
        expect(a.metadata?.reveal).toEqual({ kind: 'relic', relicCardId: RELIC })
    })

    it('with nothing discarded first the relic is taken, as before', () => {
        const s = table(OathRevision.EngineFixes12, [WOLVES])
        resolve(s, rangersPlay())
        expect(relicState(s)).toEqual(taken)
    })

    it("the resolver's slot and the play's Homeland judge the same discard first: the planner's and the payout's check", () => {
        const s = table()
        const first = [siteDiscardLedgerKey(s, WOLVES) ?? '']
        expect(homelandPowerFor(s, 'dana', 'c2', RANGERS, first)?.barred).toBe(true)
        expect(homelandRelicSlot(s, 'dana', RANGERS, 'c2', WOLVES)).toBeUndefined()
        expect(homelandPowerFor(s, 'dana', 'c2', RANGERS, [siteDiscardLedgerKey(s, INN) ?? ''])?.barred).toBe(false)
        expect(homelandRelicSlot(s, 'dana', RANGERS, 'c2', INN)).toBe(SLOT)
    })

    describe('the relic left behind can still be had', () => {
        it('a later Recover of it by Dana', () => {
            const s = table()
            resolve(s, rangersPlay(WOLVES))
            const target = { kind: RecoverTargetKind.Relic as const, slotId: SLOT }
            expect(HydratedRecover.reasonCannotRecover(s, 'dana', { target })).toBeUndefined()
            new HydratedRecover(buildAction(Recover, { playerId: 'dana', target })).apply(s)
            expect(relicState(s)).toEqual(taken)
        })

        it("Bea's Campaign with Relic Hunter for it, won, finishes", () => {
            const s = table()
            resolve(s, rangersPlay(WOLVES))
            openTurn(s, 'bea')
            const targets: CampaignTarget[] = [{ kind: CampaignTargetKind.Site, siteId: 'c2' }, { kind: CampaignTargetKind.SiteRelic, slotId: SLOT }]
            const choice = { defender: { kind: 'player' as const, playerId: 'dana' }, targets, attackDice: 3, plans: [battlePlanUse(HUNTER)] }
            expect(HydratedCampaign.reasonCannotCampaign(s, 'bea', choice)).toBeUndefined()
            new HydratedCampaign(buildAction(Campaign, { playerId: 'bea', ...choice })).apply(s)
            ongoingCampaign(s).swords = 9
            ongoingCampaign(s).defense = 0
            new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'bea', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
            defendingSideChooses(s)
            new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'bea', placements: [], burnFavor: false })).apply(s)
            expect(s.getPlayerState('bea').relicIds).toContain(RELIC)
        })

        it('a Peek of it by Dana is offered and applies', () => {
            const s = table()
            resolve(s, rangersPlay(WOLVES))
            const target = { kind: PeekTargetKind.SiteRelic as const, slotId: SLOT }
            expect(HydratedPeek.legalTargets(s, 'dana')).toContainEqual(target)
            expect(HydratedPeek.reasonCannotPeek(s, 'dana', target)).toBeUndefined()
            new HydratedPeek(buildAction(Peek, { playerId: 'dana', target })).apply(s)
            expect(s.getPlayerState('dana').peekedRelicSlotIds).toContain(SLOT)
            expect(relicState(s)).toEqual(stays)
        })
    })

    it("with the turn's ledger: a Beast discard Dana made there in Bea's turn is cleared at Bea's Rest, and Dana's play takes the relic", () => {
        const s = table(OathRevision.EngineFixes12, [WOLVES])
        openTurn(s, 'bea')
        s.getPlayerState('dana').homelandUsedThisTurn = ['c2:beast']
        expect(homelandRelicSlot(s, 'dana', RANGERS, 'c2')).toBeUndefined()
        new HydratedCompleteRest(buildAction(CompleteRest, { playerId: 'bea' })).apply(s)
        openTurn(s, 'dana')
        const a = resolve(s, rangersPlay())
        expect(relicState(s)).toEqual(taken)
        expect(a.metadata?.reveal).toEqual({ kind: 'relic', relicCardId: RELIC })
    })

    it('before revision 16 a recorded game replays as it was recorded: the relic leaves the vault and nobody takes it', () => {
        const s = table(OathRevision.EngineFixes11)
        const a = resolve(s, rangersPlay(WOLVES))
        expect(relicState(s)).toEqual({ inVault: undefined, slotLeft: true, danaHolds: false })
        expect(a.metadata?.reveal).toEqual({ kind: 'relic', relicCardId: RELIC })
    })
})
