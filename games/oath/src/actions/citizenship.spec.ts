import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedOfferCitizenship, OfferCitizenship } from './offerCitizenship.js'
import { HydratedResolveCitizenshipOffer, ResolveCitizenshipOffer } from './resolveCitizenshipOffer.js'
import { ConsentRequestKind } from '../model/consent.js'
import { MachineState } from '../definition/states.js'
import { Banner, IMPERIAL_COLOR, PlayerStatus, Region } from '../model/oathEnums.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { Color } from '@tabletop/common'
import type { OathVault } from '../model/vault.js'
import type { HydratedOathGameState } from '../model/gameState.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { expectRecolorExchange, expectWarbandsConserved, expectWarbandTotalConserved, warbandCensus } from '../testing/census.js'
import { MAX_SUPPLY } from '../util/rest.js'

const RELIQUARY_RELIC = 'relic.unnamed-1'
const OTHER_RELIC = 'relic.unnamed-2'

function table(exileOverrides = {}, stateOverrides = {}) {
    const state = testState(
        [
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 5,
                secrets: 2,
                relicIds: [GRAND_SCEPTER_ID],
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 20 }
            }),
            testPlayer({
                playerId: 'ex',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 3,
                secrets: 1,
                supply: 2,
                warbandsOnBoard: { [Color.Red]: 3 },
                warbandsInPersonalBank: { [Color.Red]: 9 },
                ...exileOverrides
            })
        ],
        {
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [Color.Red]: 2 } },
            reliquary: [{ slotId: 'rel-1' }],
            ...stateOverrides
        }
    )
    const vault = testVaultWithRelics({})
    vault.relicFacedown['rel-1'] = RELIQUARY_RELIC
    return { state, vault }
}

function offer(state: HydratedOathGameState, fields: Partial<OfferCitizenship> = {}) {
    const action = buildAction(OfferCitizenship, {
        playerId: 'chan',
        exilePlayerId: 'ex',
        reliquarySlotId: 'rel-1',
        ...fields
    })
    const hydrated = new HydratedOfferCitizenship(action)
    hydrated.apply(state)
    return hydrated
}

/** R-6.6.2 — the answer, not the offer, reads the relic from the vault. */
function answer(
    state: HydratedOathGameState,
    vault: OathVault,
    fields: Partial<ResolveCitizenshipOffer> = {}
) {
    const action = buildAction(ResolveCitizenshipOffer, {
        playerId: state.pendingConsent?.askedPlayerId ?? 'ex',
        granted: true,
        ...fields
    })
    state.vault = vault
    const hydrated = new HydratedResolveCitizenshipOffer(action)
    hydrated.apply(state)
    return hydrated
}

function serverOffer(
    state: HydratedOathGameState,
    vault: OathVault,
    offerFields: Partial<OfferCitizenship> = {},
    answerFields: Partial<ResolveCitizenshipOffer> = {}
) {
    offer(state, offerFields)
    return answer(state, vault, answerFields)
}

describe('Offering Citizenship (R-6.6.1)', () => {
    it('requires the Grand Scepter, not the Chancellor’s seat', () => {
        const { state, vault } = table()
        state.getPlayerState('chan').relicIds = []
        expect(() => serverOffer(state, vault, {})).toThrow(/requires the Grand Scepter/)

        state.getPlayerState('ex').relicIds = [GRAND_SCEPTER_ID]
        expect(
            HydratedOfferCitizenship.reasonCannotOffer(state, 'ex', {
                exilePlayerId: 'ex',
                reliquarySlotId: 'rel-1'
            })
        ).toBeUndefined()
    })

    it('may be offered to yourself if you are an Exile holding the Scepter', () => {
        const { state, vault } = table({ relicIds: [GRAND_SCEPTER_ID] })
        state.getPlayerState('chan').relicIds = []
        serverOffer(state, vault, { playerId: 'ex' })
        expect(state.getPlayerState('ex').status).toBe(PlayerStatus.Citizen)
    })

    it('refuses a target who is not an Exile', () => {
        const { state, vault } = table()
        state.getPlayerState('ex').status = PlayerStatus.Citizen
        expect(() => serverOffer(state, vault, {})).toThrow(/is a citizen, not an Exile/)
    })

    it('must name exactly one occupied Reliquary space (R-2.3)', () => {
        const { state, vault } = table()
        expect(() => serverOffer(state, vault, { reliquarySlotId: 'rel-9' })).toThrow(
            /not an occupied space in the Imperial Reliquary/
        )
    })

    it('hands over the Reliquary relic and uncovers its space (R-2.3, R-6.6.2.a)', () => {
        const { state, vault } = table()
        const action = serverOffer(state, vault, {})

        expect(state.getPlayerState('ex').relicIds).toContain(RELIQUARY_RELIC)
        expect(state.reliquarySlots()).toEqual([])
        // R-6.6.2.a — the uncovered modifier is recorded now, though inert until built.
        expect(action.metadata?.outcome?.reliquarySpacesUncovered).toBe(4)
        expect(action.revealsInfo).toBe(true)
    })

    it('changes nothing and asks the Exile instead (R-X.1)', () => {
        const { state } = table()
        const action = offer(state)

        expect(state.getPlayerState('ex').status).toBe(PlayerStatus.Exile)
        expect(state.reliquarySlots()).toHaveLength(1)
        expect(state.getPlayerState('ex').relicIds).toEqual([])

        expect(state.pendingConsent).toEqual({
            request: {
                kind: ConsentRequestKind.CitizenshipOffer,
                exilePlayerId: 'ex',
                reliquarySlotId: 'rel-1',
                terms: undefined
            },
            askingPlayerId: 'chan',
            askedPlayerId: 'ex',
            resumeMachineState: MachineState.ActPhase
        })
        // R-X.3 — no vault read and nothing moved, so the offer stays undoable.
        expect(action.revealsInfo).toBe(false)
    })

    it('will not open a second question while one is unanswered (R-4.2)', () => {
        const { state } = table()
        offer(state)
        expect(() => offer(state)).toThrow(/a question is already open and unanswered/)
    })

    it('costs no Supply (R-6)', () => {
        const { state, vault } = table()
        const before = state.getPlayerState('chan').supply
        serverOffer(state, vault, {})
        expect(state.getPlayerState('chan').supply).toBe(before)
        expect(state.getPlayerState('chan').supplySpentThisTurn).toBe(0)
    })
})

describe('The binding exchange (R-6.6.1, R-7.6.3-H1, R-9.6)', () => {
    it('moves favor, secrets and relics in both directions and enforces them', () => {
        const { state, vault } = table()
        state.getPlayerState('chan').relicIds.push(OTHER_RELIC)

        serverOffer(state, vault, {
            terms: {
                fromScepterHolder: { favor: 2, relicCardIds: [OTHER_RELIC] },
                fromExile: { secrets: 1 }
            }
        })

        const chan = state.getPlayerState('chan')
        const ex = state.getPlayerState('ex')
        expect(chan.favor).toBe(3)
        expect(ex.favor).toBe(5)
        expect(chan.secrets).toBe(3)
        expect(ex.secrets).toBe(0)
        expect(ex.relicIds).toEqual(expect.arrayContaining([OTHER_RELIC, RELIQUARY_RELIC]))
        expect(chan.relicIds).toEqual([GRAND_SCEPTER_ID])
    })

    it('refuses a promise of something the giver does not have', () => {
        const { state, vault } = table()
        expect(() =>
            serverOffer(state, vault, { terms: { fromExile: { favor: 99 } } })
        ).toThrow(/ex promised 99 favor but has 3/)
        expect(() =>
            serverOffer(state, vault, {
                terms: { fromScepterHolder: { relicCardIds: [OTHER_RELIC] } }
            })
        ).toThrow(/chan promised relic.unnamed-2, which they do not hold/)
    })

    it('gives a promised banner without the seize penalty (the banners\' Q&A)', () => {
        // The banners' Q&A — a banner given changes hands and nothing else happens.
        const { state, vault } = table()
        state.banners[Banner.PeoplesFavor] = {
            holderPlayerId: 'chan',
            value: 5,
            mobSide: false
        }

        const action = serverOffer(state, vault, {
            terms: { fromScepterHolder: { banners: [Banner.PeoplesFavor] } }
        })

        const banner = state.banners[Banner.PeoplesFavor]
        expect(banner.holderPlayerId).toBe('ex')
        expect(banner.value).toBe(5)
        expect(banner.mobSide).toBe(false)
        expect(action.metadata?.outcome?.givenBanners).toEqual([Banner.PeoplesFavor])
    })

    it('refuses a promised banner the giver does not hold', () => {
        const { state, vault } = table()
        expect(() =>
            serverOffer(state, vault, {
                terms: { fromExile: { banners: [Banner.DarkestSecret] } }
            })
        ).toThrow(/ex promised the darkestSecret, which they do not hold/)
    })
})

describe('Accepting Citizenship (R-6.6.2)', () => {
    it('applies all five board changes at once', () => {
        const { state, vault } = table({ revealedVisionId: 'vision.conquest' })
        state.oathkeeperPlayerId = 'ex'
        state.oathkeeperIsUsurper = true

        const action = serverOffer(state, vault, {})
        const ex = state.getPlayerState('ex')

        expect(ex.status).toBe(PlayerStatus.Citizen)
        expect(ex.warbandsOnBoard).toEqual({ [Color.Red]: 0, [IMPERIAL_COLOR]: 3 })
        expect(state.warbandsBySite['c1']).toEqual({
            [Color.Red]: 0,
            [IMPERIAL_COLOR]: 2
        })
        expect(ex.revealedVisionId).toBeUndefined()
        expect(state.oathkeeperIsUsurper).toBe(false)
        expect(state.oathkeeperPlayerId).toBe('ex')
        expect(ex.supply).toBe(MAX_SUPPLY)
        expect(action.metadata?.outcome?.flippedUsurperToOathkeeper).toBe(true)
    })

    it('recolours the map as well as the board — unlike being exiled (R-6.7)', () => {
        const { state, vault } = table()
        serverOffer(state, vault, {})

        expect(state.getPlayerState('ex').warbandsOnBoard[Color.Red]).toBe(0)
        expect(state.warbandsBySite['c1'][Color.Red]).toBe(0)
    })

    it('discards the revealed Vision to the NEXT region’s pile (R-10.5)', () => {
        const { state, vault } = table({ revealedVisionId: 'vision.conquest' })
        const action = serverOffer(state, vault, {})

        expect(action.metadata?.outcome?.discardedCardIds).toEqual(['vision.conquest'])
        // The pawn is in the Cradle.
        expect(action.metadata?.outcome?.discardPileRegion).toBe(Region.Provinces)
        expect(state.discardPileCounts[Region.Provinces]).toBe(1)
    })

    it('R-X.3(b) — an acceptance that discards a Vision is non-undoable', () => {
        // The Vision discard writes into the vault's secret pile, which undo never rolls back.
        const { state, vault } = table({ revealedVisionId: 'vision.conquest' })
        const action = serverOffer(state, vault, {})
        expect(action.revealsInfo).toBe(true)
    })

    it('R-X.3, R-9.4 — an acceptance takes the relic out of the vault, so it cannot be undone', () => {
        const { state, vault } = table()
        const action = serverOffer(state, vault, {})
        expect(action.revealsInfo).toBe(true)
        expect(vault.relicFacedown['rel-1']).toBeUndefined()
        expect(state.getPlayerState('ex').relicIds).toContain(RELIQUARY_RELIC)
    })

    it('does not flip a title the Exile does not hold', () => {
        const { state, vault } = table()
        state.oathkeeperPlayerId = 'chan'
        state.oathkeeperIsUsurper = true
        const action = serverOffer(state, vault, {})

        expect(state.oathkeeperIsUsurper).toBe(true)
        expect(action.metadata?.outcome?.flippedUsurperToOathkeeper).toBe(false)
    })

    it('reports the end of the Act Phase rather than applying it (R-6.6.2)', () => {
        const { state, vault } = table()
        state.turnManager.startNextTurn(0)
        expect(state.turnManager.currentTurn()?.playerId).toBe('chan')

        const notTheirTurn = serverOffer(state, vault, {})
        expect(notTheirTurn.metadata?.outcome?.endsActPhase).toBe(false)
    })

    it('reports endsActPhase when it IS the Exile’s turn', () => {
        const { state, vault } = table()
        state.turnManager.turnOrder = ['ex', 'chan']
        state.turnManager.startNextTurn(0)
        expect(state.turnManager.currentTurn()?.playerId).toBe('ex')

        expect(serverOffer(state, vault, {}).metadata?.outcome?.endsActPhase).toBe(true)
    })
})

describe('Refusing a Citizenship offer (R-6.6.2, R-X.1)', () => {
    it('changes nothing, and leaves the relic in the vault', () => {
        const { state, vault } = table()
        offer(state)
        const action = answer(state, vault, { granted: false })

        expect(state.getPlayerState('ex').status).toBe(PlayerStatus.Exile)
        expect(state.reliquarySlots()).toHaveLength(1)
        expect(state.getPlayerState('ex').relicIds).toEqual([])
        expect(vault.relicFacedown['rel-1']).toBe(RELIQUARY_RELIC)
        expect(action.revealsInfo).toBe(false)
        expect(action.metadata).toEqual({
            granted: false,
            resumeMachineState: MachineState.ActPhase
        })
        expect(state.pendingConsent).toBeUndefined()
    })

    it('an acceptance DOES take the relic out of the vault', () => {
        const { state, vault } = table()
        offer(state)
        const action = answer(state, vault)

        expect(vault.relicFacedown['rel-1']).toBeUndefined()
        expect(action.metadata?.outcome?.relicCardId).toBe(RELIQUARY_RELIC)
        // R-X.3 — the identity crossed out of the vault, so undo stops here.
        expect(action.revealsInfo).toBe(true)
        expect(state.pendingConsent).toBeUndefined()
    })

    it('refuses an answer from anybody but the Exile who was asked (R-X.1)', () => {
        const { state, vault } = table()
        offer(state)
        expect(() => answer(state, vault, { playerId: 'chan' })).toThrow(
            /the offer was made to ex, not to chan/
        )
    })

    it('refuses an answer when no question is open — silence is not refusal', () => {
        const { state, vault } = table()
        expect(() => answer(state, vault)).toThrow(/no Citizenship offer is open/)
    })

    it('refuses a recolour choice attached to a refusal', () => {
        const { state, vault } = table()
        offer(state)
        expect(() =>
            answer(state, vault, {
                granted: false,
                recolorChoice: [
                    { at: { kind: 'board', playerId: 'ex' }, color: Color.Red, count: 1 }
                ]
            })
        ).toThrow(/a refusal chooses no warbands/)
    })
})

describe('the recolour conserves components (R-6.6.2, R-9.3)', () => {
    it('moves warbands between pools rather than minting them — per colour AND in total', () => {
        const { state, vault } = table()
        expectWarbandTotalConserved(state, () => {
            expectWarbandsConserved(state, () => {
                serverOffer(state, vault, {})
            })
        })
    })

    it('exchanges exactly as many purple as it displaced red', () => {
        const { state, vault } = table()
        const before = warbandCensus(state)
        const action = serverOffer(state, vault, {})

        expect(action.metadata?.outcome?.recoloredCount).toBe(5)
        expect(action.metadata?.outcome?.unreplacedCount).toBe(0)

        expect(state.getPlayerState('ex').warbandsInPersonalBank[Color.Red]).toBe(14)
        expect(state.getPlayerState('chan').warbandsInPersonalBank[IMPERIAL_COLOR]).toBe(15)
        expectRecolorExchange(before, warbandCensus(state), Color.Red, IMPERIAL_COLOR, 0)
    })
})

describe('when the Empire runs short of purple (R-6.6.2 clar., R-9.3, R-X.1)', () => {
    function short() {
        const { state, vault } = table()
        state.getPlayerState('chan').warbandsInPersonalBank[IMPERIAL_COLOR] = 2
        return { state, vault }
    }

    it('requires the Exile to choose which warbands are replaced', () => {
        const { state, vault } = short()
        expect(() => serverOffer(state, vault, {})).toThrow(
            /only 2 purple warbands are available for 5 warbands; the Exile must choose/
        )
    })

    it('requires the choice to use every purple available (R-9.3)', () => {
        const { state, vault } = short()
        expect(() =>
            serverOffer(state, vault, {}, {
                recolorChoice: [
                    { at: { kind: 'board', playerId: 'ex' }, color: Color.Red, count: 1 }
                ]
            })
        ).toThrow(/must choose exactly 2 warbands to replace, not 1/)
    })

    it('refuses a choice naming warbands the Exile does not have', () => {
        const { state, vault } = short()
        expect(() =>
            serverOffer(state, vault, {}, {
                recolorChoice: [
                    { at: { kind: 'site', siteId: 'h3' }, color: Color.Red, count: 2 }
                ]
            })
        ).toThrow(/is not in the force/)
    })

    it('removes the unchosen warbands: "the Exile chooses which warbands to remove and which to replace" (R-6.6.2)', () => {
        const { state, vault } = short()
        const action = serverOffer(state, vault, {}, {
            recolorChoice: [
                { at: { kind: 'board', playerId: 'ex' }, color: Color.Red, count: 2 }
            ]
        })

        const ex = state.getPlayerState('ex')
        expect(ex.warbandsOnBoard[Color.Red] ?? 0).toBe(0)
        expect(ex.warbandsOnBoard[IMPERIAL_COLOR]).toBe(2)
        expect(state.warbandsBySite['c1']?.[Color.Red] ?? 0).toBe(0)
        expect(action.metadata?.outcome?.recoloredCount).toBe(2)
        expect(action.metadata?.outcome?.unreplacedCount).toBe(3)
    })

    it('still conserves warbands when it runs short', () => {
        const { state, vault } = short()
        expectWarbandTotalConserved(state, () => {
            expectWarbandsConserved(state, () => {
                serverOffer(state, vault, {}, {
                    recolorChoice: [
                        { at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 2 }
                    ]
                })
            })
        })
    })

    it('refuses a choice when the Empire has purple enough', () => {
        const { state, vault } = table()
        expect(() =>
            serverOffer(state, vault, {}, {
                recolorChoice: [
                    { at: { kind: 'board', playerId: 'ex' }, color: Color.Red, count: 1 }
                ]
            })
        ).toThrow(/purple enough to replace every warband, so there is nothing to choose/)
    })
})

describe('what R-6.6.1 offers', () => {
    it('is offered to the Scepter’s holder while an Exile and a Reliquary space remain', () => {
        const { state } = table()
        expect(HydratedOfferCitizenship.canDoOfferCitizenship(state, 'chan')).toBe(true)
        expect(HydratedOfferCitizenship.canDoOfferCitizenship(state, 'ex')).toBe(false)
    })

    it('is not offered once the Reliquary is empty (R-6.6.1)', () => {
        const { state } = table()
        state.reliquary = []
        expect(HydratedOfferCitizenship.canDoOfferCitizenship(state, 'chan')).toBe(false)
    })

    it('is not offered when nobody is an Exile', () => {
        const { state } = table()
        state.getPlayerState('ex').status = PlayerStatus.Citizen
        expect(HydratedOfferCitizenship.canDoOfferCitizenship(state, 'chan')).toBe(false)
    })
})
