import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { addSettlements, canUnload } from '../model/settling.js'
import { TurnStep } from '../model/turn.js'

export type UnloadSettlementsMetadata = Type.Static<typeof UnloadSettlementsMetadata>
export const UnloadSettlementsMetadata = Type.Object({
    systemId: Type.String(),
    foundedBase: Type.Boolean(),
    baseSettlements: Type.Number()
})

export type UnloadSettlements = Type.Static<typeof UnloadSettlements>
export const UnloadSettlements = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UnloadSettlements),
            playerId: Type.String(),
            shipId: Type.String(),
            count: Type.Number(),
            metadata: Type.Optional(UnloadSettlementsMetadata)
        })
    ])
)

export const UnloadSettlementsValidator = Compile(UnloadSettlements)

export function isUnloadSettlements(action?: GameAction): action is UnloadSettlements {
    return action?.type === ActionType.UnloadSettlements
}

export class HydratedUnloadSettlements
    extends HydratableAction<typeof UnloadSettlements>
    implements UnloadSettlements
{
    declare type: ActionType.UnloadSettlements
    declare playerId: string
    declare shipId: string
    declare count: number
    declare metadata?: UnloadSettlementsMetadata

    constructor(data: UnloadSettlements) {
        super(data, UnloadSettlementsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            state.getPlayerState(this.playerId).step !== TurnStep.Cargo ||
            !canUnload(state, ship) ||
            !Number.isInteger(this.count) ||
            this.count < 1 ||
            this.count > ship.settlements
        ) {
            throw Error('Invalid UnloadSettlements action')
        }
        const foundedBase = state.base(this.playerId, ship.systemId) === undefined
        ship.settlements -= this.count
        addSettlements(state, this.playerId, ship.systemId, this.count)
        const base = state.base(this.playerId, ship.systemId)
        assertExists(base, 'Unloading settlements must leave a base')
        this.metadata = { systemId: ship.systemId, foundedBase, baseSettlements: base.settlements }
    }

    static canUnloadSettlements(state: HydratedStellarHorizonsGameState, playerId: string) {
        return (
            state.getPlayerState(playerId).step === TurnStep.Cargo &&
            state.shipsOf(playerId).some((ship) => canUnload(state, ship))
        )
    }
}
