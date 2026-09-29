import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { cardPower, PowerTiming } from '../data/cardPowers.js'
import { HydratedLetPeek, LetPeekSubjectKind } from '../actions/letPeek.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOfferCitizenship } from '../actions/offerCitizenship.js'

describe("the Grand Scepter's continuous lockout is dead while its three permissions are live", () => {
    function board() {
        return testState(
            [
                testPlayer({
                    playerId: 'chancellor',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1'
                }),
                testPlayer({
                    playerId: 'holder',
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    siteId: 'c2',
                    relicIds: [GRAND_SCEPTER_ID]
                }),
                testPlayer({ playerId: 'target', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c2' })
            ],
            {
                chancellorPlayerId: 'chancellor',
                reliquary: [{ slotId: 'reliquary.0' }]
            }
        )
    }

    it('the registry knows the lockout, and the state can represent it', () => {
        const lockout = cardPower(GRAND_SCEPTER_ID, 0)
        expect(lockout?.timing).toBe(PowerTiming.Continuous)
        expect(lockout?.text).toMatch(/cannot use this if you took it on this turn/i)
    })

    it('taken this turn: showing an Exile a Reliquary relic is refused; next turn it opens', () => {
        const state = board()
        state.turnManager.series = [{ type: 'turn', playerId: 'holder', start: 4 }]
        state.grandScepterTakenOnTurnStart = 4

        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toMatch(/cannot be used on the turn it was taken/)

        state.turnManager.series = [{ type: 'turn', playerId: 'holder', start: 9 }]
        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toBeUndefined()
    })

    it('a holder who did not take it this turn shows it freely (no over-lock)', () => {
        const state = board()
        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toBeUndefined()
    })
})

describe('Scepter double delivery: the same act is reachable through two doors with different gates', () => {
    function board() {
        return testState(
            [
                testPlayer({
                    playerId: 'chancellor',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1'
                }),
                testPlayer({
                    playerId: 'holder',
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    siteId: 'c2',
                    relicIds: [GRAND_SCEPTER_ID]
                }),
                testPlayer({
                    playerId: 'target',
                    color: Color.Blue,
                    status: PlayerStatus.Exile,
                    siteId: 'c2'
                })
            ],
            {
                chancellorPlayerId: 'chancellor',
                reliquary: [{ slotId: 'reliquary.0' }]
            }
        )
    }

    it('the R-6 minor actions are open while the R-6.2 card power refuses', () => {
        const state = board()

        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toBeUndefined()
        expect(
            HydratedOfferCitizenship.canDoOfferCitizenship(state, 'holder')
        ).toBe(true)

        // Power 1 is the Scepter's printed Peek.
        const holderHasAccess = HydratedUseActionPower.reasonCannotUse(
            state,
            'holder',
            GRAND_SCEPTER_ID,
            1
        )
        expect(holderHasAccess).toMatch(/not implemented yet/)
    })
})
