import { describe, expect, it } from 'vitest'
import { OathTestEngine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import {
    Color,
    Game
} from '@tabletop/common'
import { OathRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { UseRestPower } from '../actions/useRestPower.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { bank } from '../testing/choices.js'
import { Travel } from '../actions/travel.js'
import { type OathProjectedState } from '../model/gameState.js'
import { type OathPlayerState } from '../model/playerState.js'
import { testGame } from '../testing/game.js'

/** R-4.3 — the Rest refresh runs once per turn, however often the phase is re-entered. */

describe('RestPhase.enter() is re-entry-safe', () => {
    const engine = new OathTestEngine(OathRuntime)
    const POVERTY = 'denizen.beast.vow-of-poverty'
    function buildState(): OathProjectedState {
        const seats: OathPlayerState[] = [
            testPlayer({
                playerId: 'p1',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                supply: 4,
                warbandsInPersonalBank: { purple: 5 }, // R-4.3.3 — band 4-10, base 4
                advisers: [{ cardId: POVERTY, faceUp: true }]
            }),
            testPlayer({
                playerId: 'p2',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c2',
                warbandsInPersonalBank: { [Color.Red]: 4 }
            })
        ]
        const state = testState(seats, {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'p1'
        }).dehydrate()
        state.turnManager = {
            series: [{ type: 'turn', playerId: 'p1', start: 0 }],
            turnOrder: ['p1', 'p2'],
            turnCounts: { p1: 0, p2: 0 }
        }
        state.activePlayerIds = ['p1']
        return state
    }

    function spendAllAndRest(game: Game): OathProjectedState {
        let state = buildState()
        state = engine.runNext(buildAction(Travel, { playerId: 'p1', siteId: 'h1' }), state, game).updatedState
        expect(state.players.find((p) => p.playerId === 'p1')?.supply).toBe(0)
        state = engine.runNext(buildAction(EndActPhase, { playerId: 'p1' }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.RestPhase)
        return state
    }

    it('refreshes correctly on the first (legitimate) entry: spent-out player rests to base 4', () => {
        const game = testGame(['p1', 'p2'])
        const state = spendAllAndRest(game)
        expect(state.players.find((p) => p.playerId === 'p1')?.supply).toBe(4)
    })

    it('the Rest refresh is idempotent: a Rest power during Rest does not change Supply', () => {
        const game = testGame(['p1', 'p2'])
        let state = spendAllAndRest(game)

        // The engine enters the next state after every action, so the Rest power re-enters RestPhase.
        state = engine.runNext(buildAction(UseRestPower, {
            playerId: 'p1',
            cardId: POVERTY,
            powerIndex: powerIndexOf(POVERTY, PowerTiming.Rest),
            choices: [bank(Suit.Beast)]
        }), state, game).updatedState

        expect(state.machineState).toBe(MachineState.RestPhase)
        expect(state.players.find((p) => p.playerId === 'p1')?.supply).toBe(4)
        expect(state.players.find((p) => p.playerId === 'p1')?.favor).toBe(2)
    })
})
