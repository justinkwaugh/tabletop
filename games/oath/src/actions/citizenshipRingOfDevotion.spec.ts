import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { buildAction } from '../testing/actions.js'
import { HydratedOfferCitizenship, OfferCitizenship } from './offerCitizenship.js'
import {
    HydratedResolveCitizenshipOffer,
    ResolveCitizenshipOffer
} from './resolveCitizenshipOffer.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import type { WarbandGroup } from '../model/campaign.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { testPlayer, testState, testVaultWithRelics, openTurn } from '../testing/fixture.js'
import { served } from '../testing/projection.js'
import { warbandCensus } from '../testing/census.js'
import { citizenshipReplacementGroups } from '../util/citizenship.js'
import { rulesSite } from '../util/rule.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const DANA = 'dana'
const RHYS = 'rhys'
const RING = 'relic.ring-of-devotion'
const RELIQUARY_RELIC = 'relic.unnamed-1'
const BALLOT_BOX = 'denizen.hearth.ballot-box'

const atRevision = OathRevision.EngineFixes27
const before = OathRevision.EngineFixes26

const RHYS_BANK = 9
const IMPERIAL_BANK = 20

/**
 * Dana the Chancellor holds the Grand Scepter. Rhys, an Exile, has 2 warbands on their board and 3
 * at the Plains (c1), the only site they rule.
 */
function table(
    revision: number,
    rhys: Partial<OathPlayerState> = {},
    imperialBank = IMPERIAL_BANK
) {
    const state = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                relicIds: [GRAND_SCEPTER_ID],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: imperialBank }
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { [RHYS]: 2 },
                warbandsInPersonalBank: { [RHYS]: RHYS_BANK },
                ...rhys
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: DANA,
            warbandsBySite: { c1: { [RHYS]: 3 } },
            reliquary: [{ slotId: 'rel-1' }]
        }
    )
    const vault = testVaultWithRelics({})
    vault.relicFacedown['rel-1'] = RELIQUARY_RELIC
    state.vault = vault
    return state
}

function offer(state: HydratedOathGameState) {
    new HydratedOfferCitizenship(
        buildAction(OfferCitizenship, {
            playerId: DANA,
            exilePlayerId: RHYS,
            reliquarySlotId: 'rel-1'
        })
    ).apply(state)
}

function accept(state: HydratedOathGameState, replacementChoice?: WarbandGroup[]) {
    const answer = new HydratedResolveCitizenshipOffer(
        buildAction(ResolveCitizenshipOffer, {
            playerId: RHYS,
            granted: true,
            ...(replacementChoice ? { replacementChoice } : {})
        })
    )
    answer.apply(state)
    return answer
}

const board = (s: HydratedOathGameState) => s.getPlayerState(RHYS).warbandsOnBoard
const rhysBank = (s: HydratedOathGameState) =>
    s.getPlayerState(RHYS).warbandsInPersonalBank[RHYS] ?? 0
const imperialBank = (s: HydratedOathGameState) =>
    s.getPlayerState(DANA).warbandsInPersonalBank[IMPERIAL_WARBANDS] ?? 0
const atPlains = (s: HydratedOathGameState) => s.warbandsBySite['c1'] ?? {}

const onBoard = (count: number): WarbandGroup => ({
    at: { kind: 'board', playerId: RHYS },
    owner: RHYS,
    count
})
const atSite = (count: number): WarbandGroup => ({
    at: { kind: 'site', siteId: 'c1' },
    owner: RHYS,
    count
})

describe('Ring of Devotion and Citizenship (R-6.6.2, revision 32)', () => {
    it("Rhys holds the Ring and accepts: the Plains' 3 leave, not replaced; the board's 2 become Imperial", () => {
        const s = table(atRevision, { relicIds: [RING] })
        offer(s)
        const before = warbandCensus(s)
        const answer = accept(s)
        expect(warbandCensus(s)).toEqual(before)
        expect(s.getPlayerState(RHYS).status).toBe(PlayerStatus.Citizen)
        expect(atPlains(s)).toEqual({ [RHYS]: 0 })
        expect(board(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 2 })
        // All five go back to Rhys's own bank, as a removed warband does (R-6.6.2, R-10.13).
        expect(rhysBank(s)).toBe(RHYS_BANK + 5)
        expect(imperialBank(s)).toBe(IMPERIAL_BANK - 2)
        // R-10.21: with no warbands left there, Rhys no longer rules the Plains.
        expect(rulesSite(s, RHYS, 'c1')).toBe(false)
        expect(answer.metadata?.outcome).toMatchObject({
            replacedCount: 2,
            unreplacedCount: 0,
            removedFromSitesCount: 3
        })
    })

    it('control: without the Ring all five become Imperial, as before', () => {
        const s = table(atRevision)
        offer(s)
        const answer = accept(s)
        expect(atPlains(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 3 })
        expect(board(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 2 })
        expect(answer.metadata?.outcome?.replacedCount).toBe(5)
        expect(answer.metadata?.outcome?.removedFromSitesCount).toBeUndefined()
    })

    it('R-X.4 — before revision 32 the Ring changes nothing: all five become Imperial', () => {
        const s = table(before, { relicIds: [RING] })
        offer(s)
        const answer = accept(s)
        expect(atPlains(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 3 })
        expect(board(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 2 })
        expect(answer.metadata?.outcome?.replacedCount).toBe(5)
        expect(answer.metadata?.outcome?.removedFromSitesCount).toBeUndefined()
    })

    it("the Ring as the offer's relic arrives after the replacement (R-6.6.2's order): all five become Imperial", () => {
        const s = table(atRevision)
        s.requireVault().relicFacedown['rel-1'] = RING
        offer(s)
        const answer = accept(s)
        expect(s.getPlayerState(RHYS).relicIds).toContain(RING)
        expect(atPlains(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 3 })
        expect(answer.metadata?.outcome?.replacedCount).toBe(5)
    })

    describe('the Empire short of Imperial warbands (R-9.3): only the board competes', () => {
        it("one Imperial warband for the board's 2: Rhys picks one of them; a pick at the site is refused", () => {
            const s = table(atRevision, { relicIds: [RING] }, 1)
            offer(s)
            expect(citizenshipReplacementGroups(s, RHYS)).toEqual([onBoard(2)])
            expect(
                HydratedResolveCitizenshipOffer.reasonCannotResolve(s, RHYS, {
                    granted: true,
                    replacementChoice: [atSite(1)]
                })
            ).toBeDefined()
            expect(
                HydratedResolveCitizenshipOffer.reasonCannotResolve(s, RHYS, { granted: true })
            ).toBe(
                'only 1 Imperial warbands are available for 2 warbands; the Exile must choose which are replaced'
            )
            const answer = accept(s, [onBoard(1)])
            expect(board(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 1 })
            expect(atPlains(s)).toEqual({ [RHYS]: 0 })
            expect(rhysBank(s)).toBe(RHYS_BANK + 5)
            expect(answer.metadata?.outcome).toMatchObject({
                replacedCount: 1,
                unreplacedCount: 1,
                removedFromSitesCount: 3
            })
        })

        it('enough for the board alone: nothing to choose, though the site holds more', () => {
            const s = table(atRevision, { relicIds: [RING] }, 2)
            offer(s)
            expect(
                HydratedResolveCitizenshipOffer.reasonCannotResolve(s, RHYS, { granted: true })
            ).toBeUndefined()
            expect(
                HydratedResolveCitizenshipOffer.reasonCannotResolve(s, RHYS, {
                    granted: true,
                    replacementChoice: [onBoard(2)]
                })
            ).toBe(
                'the Empire has Imperial warbands enough to replace every warband, so there is nothing to choose'
            )
            accept(s)
            expect(board(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 2 })
            expect(imperialBank(s)).toBe(0)
        })

        it('R-X.4 — before revision 32 the site still competes for the one Imperial warband', () => {
            const s = table(before, { relicIds: [RING] }, 1)
            offer(s)
            expect(citizenshipReplacementGroups(s, RHYS)).toEqual([onBoard(2), atSite(3)])
            accept(s, [atSite(1)])
            expect(atPlains(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 1 })
        })
    })

    it("on Rhys's own view the warbands offered and the answer's check are the full state's", () => {
        for (const imperial of [IMPERIAL_BANK, 1]) {
            const s = table(atRevision, { relicIds: [RING] }, imperial)
            offer(s)
            const own = new HydratedOathGameState(served(s, { kind: 'player', playerId: RHYS }))
            expect(citizenshipReplacementGroups(own, RHYS)).toEqual(
                citizenshipReplacementGroups(s, RHYS)
            )
            expect(citizenshipReplacementGroups(own, RHYS)).toEqual([onBoard(2)])
            for (const replacementChoice of [undefined, [onBoard(1)], [atSite(1)]]) {
                const choice = { granted: true, replacementChoice }
                expect(HydratedResolveCitizenshipOffer.reasonCannotResolve(own, RHYS, choice)).toBe(
                    HydratedResolveCitizenshipOffer.reasonCannotResolve(s, RHYS, choice)
                )
            }
        }
    })

    describe("a card's Citizenship (Ballot Box)", () => {
        function ballotBox(revision: number) {
            const s = table(revision, { relicIds: [RING] })
            s.denizensBySite = { c1: [BALLOT_BOX] }
            s.banners = {
                ...s.banners,
                [Banner.PeoplesFavor]: { holderPlayerId: RHYS, value: 1 }
            }
            openTurn(s, RHYS)
            const used = new HydratedUseActionPower(
                buildAction(UseActionPower, { playerId: RHYS, cardId: BALLOT_BOX, powerIndex: 0 })
            )
            used.apply(s)
            return { s, used }
        }

        it("the Ring's holder: the Plains' 3 leave, the board's 2 become Imperial, and the summary says so", () => {
            const { s, used } = ballotBox(atRevision)
            expect(s.getPlayerState(RHYS).status).toBe(PlayerStatus.Citizen)
            expect(atPlains(s)).toEqual({ [RHYS]: 0 })
            expect(board(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 2 })
            expect(used.metadata?.summary).toBe(
                'Ballot Box: became a Citizen (2 warbands became Imperial; 3 on the map removed, Ring of Devotion); Supply refreshed, Act Phase over'
            )
        })

        it('R-X.4 — before revision 32 all five become Imperial, in the same words as before', () => {
            const { s, used } = ballotBox(before)
            expect(atPlains(s)).toEqual({ [RHYS]: 0, [IMPERIAL_WARBANDS]: 3 })
            expect(used.metadata?.summary).toBe(
                'Ballot Box: became a Citizen (5 warbands became Imperial); Supply refreshed, Act Phase over'
            )
        })
    })
})
