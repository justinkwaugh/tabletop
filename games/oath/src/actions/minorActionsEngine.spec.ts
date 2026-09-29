import { describe, expect, it } from 'vitest'
import { OathHydrator } from '../definition/hydrator.js'
import { OathApiActions } from '../definition/apiActions.js'
import { ActionType } from '../definition/actions.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { HydratedPeek, Peek, PeekTargetKind } from './peek.js'
import { HydratedMoveWarbands, MoveWarbands } from './moveWarbands.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { HydratedOfferCitizenship, OfferCitizenship } from './offerCitizenship.js'
import { ExileCitizen, HydratedExileCitizen } from './exileCitizen.js'
import { HydratedSelfExile, SelfExile } from './selfExile.js'
import { SearchPlay } from './searchResolve.js'
import { ActionSource, Color } from '@tabletop/common'
import { buildAction } from '../testing/actions.js'

const UNKNOWN_ACTION = { id: 'a1', gameId: 'game-1', source: ActionSource.User, playerId: 'p1' }

const MINOR_ACTIONS = [
    {
        type: ActionType.PlayFacedownAdviser,
        hydrated: HydratedPlayFacedownAdviser,
        action: buildAction(PlayFacedownAdviser, { playerId: 'p1', cardId: 'denizen.hearth.any', play: SearchPlay.Discard })
    },
    {
        type: ActionType.UseActionPower,
        hydrated: HydratedUseActionPower,
        action: buildAction(UseActionPower, { playerId: 'p1', cardId: 'denizen.hearth.any', powerIndex: 0 })
    },
    {
        type: ActionType.Peek,
        hydrated: HydratedPeek,
        action: buildAction(Peek, { playerId: 'p1', target: { kind: PeekTargetKind.SiteRelic, slotId: 'slot-1' } })
    },
    {
        type: ActionType.MoveWarbands,
        hydrated: HydratedMoveWarbands,
        action: buildAction(MoveWarbands, { playerId: 'p1', move: { kind: WarbandMoveKind.SiteToBoard }, color: Color.Red, count: 1 })
    },
    {
        type: ActionType.OfferCitizenship,
        hydrated: HydratedOfferCitizenship,
        action: buildAction(OfferCitizenship, { playerId: 'p1', exilePlayerId: 'p2', reliquarySlotId: 'rel-1' })
    },
    {
        type: ActionType.ExileCitizen,
        hydrated: HydratedExileCitizen,
        action: buildAction(ExileCitizen, { playerId: 'p1', citizenPlayerId: 'p2' })
    },
    { type: ActionType.SelfExile, hydrated: HydratedSelfExile, action: buildAction(SelfExile, { playerId: 'p1' }) }
] as const

describe('minor action wiring (R-6.1–R-6.8)', () => {
    it.each(MINOR_ACTIONS)('the hydrator knows $type', ({ hydrated, action }) => {
        expect(new OathHydrator().hydrateAction(action)).toBeInstanceOf(hydrated)
    })

    it.each(MINOR_ACTIONS)('the API exposes $type', ({ type }) => {
        expect(OathApiActions[type]).toBeDefined()
    })

    it('every minor action type is registered in all three places', () => {
        const minorTypes = [
            ActionType.PlayFacedownAdviser,
            ActionType.UseActionPower,
            ActionType.Peek,
            ActionType.MoveWarbands,
            ActionType.OfferCitizenship,
            ActionType.ExileCitizen,
            ActionType.SelfExile
        ]
        expect(MINOR_ACTIONS.map((a) => a.type).sort()).toEqual([...minorTypes].sort())
        for (const type of minorTypes) {
            expect(Object.keys(OathApiActions)).toContain(type)
        }
    })

    it('R-6 — a minor action neither spends nor refreshes Supply', () => {
        const state = testState(
            [
                testPlayer({
                    playerId: 'p1',
                    color: Color.Red,
                    siteId: 'c1',
                    supply: 5,
                    supplySpentThisTurn: 2,
                    warbandsOnBoard: { [Color.Red]: 2 },
                    warbandsInPersonalBank: { [Color.Red]: 9 },
                    advisers: [{ cardId: 'denizen.hearth.marriage', faceUp: false }]
                })
            ],
            { warbandsBySite: { c1: { [Color.Red]: 3 } } }
        )

        new HydratedMoveWarbands(
            buildAction(MoveWarbands, {
                playerId: 'p1',
                move: { kind: WarbandMoveKind.SiteToBoard },
                color: Color.Red,
                count: 1
            })
        ).apply(state)

        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, {
                playerId: 'p1',
                cardId: 'denizen.hearth.marriage',
                play: SearchPlay.Discard
            })
        ).apply(state)

        const player = state.getPlayerState('p1')
        expect(player.supply).toBe(5)
        expect(player.supplySpentThisTurn).toBe(2)
    })

    it('refuses an action type the hydrator does not know', () => {
        expect(() =>
            new OathHydrator().hydrateAction({ ...UNKNOWN_ACTION, type: 'notAnAction' })
        ).toThrow(/Unknown action type/)
    })
})
