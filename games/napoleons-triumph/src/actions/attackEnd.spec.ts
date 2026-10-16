import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import {
    advanceAfterARepulse,
    bombardment,
    bombardmentLossChosen,
    brokenInCombat,
    feintAgainstBlockers,
    feintAgainstOneReserve,
    gunsStayAfterARetreat,
    moveIn,
    regroupedAfterARepulse,
    repulsedByBlockers,
    retreatBeforeCombat,
    retreatToTheRefuge,
    wonBeforeTheRetreat,
    type BattleGame
} from '../testing/battles.js'
import { attackEndedBy, type EndedAttack } from './attackEnd.js'

interface Ending {
    name: string
    fight: () => BattleGame
    endedBy: ActionType
    source?: ActionSource
    recorded: Partial<EndedAttack>
    demoralized?: Side
}

const ENDINGS: Ending[] = [
    {
        name: 'a counter-attack declined against an attack thrown back',
        fight: repulsedByBlockers,
        endedBy: ActionType.CounterAttack,
        recorded: { attackingUnitIds: ['F01', 'F02'], finalResult: -2, attackerWon: false }
    },
    {
        name: 'the retreat after a lost fight',
        fight: () => retreatToTheRefuge(wonBeforeTheRetreat()),
        endedBy: ActionType.Retreat,
        recorded: {
            attackLeaderIds: ['F01', 'F02'],
            defendingUnitIds: ['A01', 'A02'],
            attackerWon: true
        }
    },
    {
        name: 'a retreat that breaks the defending army',
        fight: () => retreatToTheRefuge(wonBeforeTheRetreat(4)),
        endedBy: ActionType.Retreat,
        recorded: { attackerWon: true },
        demoralized: Side.Allied
    },
    {
        name: 'the declaration of a bombardment nothing can counter-attack',
        fight: bombardment,
        endedBy: ActionType.DeclareAttack,
        recorded: { attackingUnitIds: ['F01'], artilleryLed: true, attackerWon: true }
    },
    {
        name: 'the loss a bombardment made the defender choose',
        fight: bombardmentLossChosen,
        endedBy: ActionType.AssignLosses,
        recorded: { attackingUnitIds: ['F01'], artilleryLed: true, defenderStepsLost: 1 }
    },
    {
        name: 'a feint against blockers',
        fight: feintAgainstBlockers,
        endedBy: ActionType.DeclareFeint,
        recorded: { feint: true }
    },
    {
        name: 'the advance the game makes for a lone defender after a feint',
        fight: feintAgainstOneReserve,
        endedBy: ActionType.Advance,
        source: ActionSource.System,
        recorded: { feint: true, defendingUnitIds: ['A01'] }
    },
    {
        name: 'the advance a defender chooses after holding',
        fight: advanceAfterARepulse,
        endedBy: ActionType.Advance,
        recorded: { attackerWon: false, defendersBlocking: false }
    },
    {
        name: 'the regroup of a corps thrown back',
        fight: regroupedAfterARepulse,
        endedBy: ActionType.Regroup,
        recorded: { attackingUnitIds: ['F01', 'F02', 'F03'], attackerWon: false }
    },
    {
        name: 'the move into a locale given up before combat',
        fight: () => moveIn(retreatBeforeCombat()),
        endedBy: ActionType.Occupy,
        recorded: { retreatBeforeCombat: true }
    },
    {
        name: 'guns staying in place after a retreat before combat',
        fight: gunsStayAfterARetreat,
        endedBy: ActionType.Occupy,
        recorded: { retreatBeforeCombat: true }
    },
    {
        name: 'a retreat before combat that breaks the defending army',
        fight: () => retreatBeforeCombat(1),
        endedBy: ActionType.Retreat,
        recorded: { retreatBeforeCombat: true },
        demoralized: Side.Allied
    },
    {
        name: 'a fight whose losses break the defending army',
        fight: brokenInCombat,
        endedBy: ActionType.CounterAttack,
        recorded: { attackerWon: true },
        demoralized: Side.Allied
    }
]

describe('the action that ends an attack', () => {
    it.each(ENDINGS)(
        'records the attack: $name',
        ({ fight, endedBy, source, recorded, demoralized }) => {
            const game = fight()
            const last = game.played.at(-1)
            expect(game.state.attack).toBeUndefined()
            expect(last?.type).toBe(endedBy)
            expect(last?.source).toBe(source ?? ActionSource.User)
            expect(attackEndedBy(last)).toMatchObject(recorded)
            expect(attackEndedBy(last)?.demoralizedId).toBe(
                demoralized === undefined ? undefined : game.playerOf(demoralized)
            )
        }
    )

    it('records nothing while the attack goes on', () => {
        const game = wonBeforeTheRetreat()
        expect(game.state.attack).toBeDefined()
        expect(game.played.map(attackEndedBy)).toEqual(game.played.map(() => undefined))
    })

    it.each([Side.French, Side.Allied])(
        'shows %s the record without either side’s plans',
        (side) => {
            const game = bombardment()
            const last = game.played.at(-1)
            assertExists(last, 'Expected the bombardment to be played')
            const ending = NapoleonsTriumphRuntime.visibility.actions.project(last, {
                kind: 'player',
                playerId: game.playerOf(side)
            })
            const ended = attackEndedBy(ending)
            expect(ended).toMatchObject({ attackingUnitIds: ['F01'] })
            for (const field of ['attackPlan', 'defensePlan', 'pending', 'orders', 'awaits']) {
                expect(ended).not.toHaveProperty(field)
            }
        }
    )
})
