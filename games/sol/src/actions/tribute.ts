import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type TributeMetadata = Type.Static<typeof TributeMetadata>
export const TributeMetadata = Type.Object({
    payments: Type.Record(Type.String(), Type.Number())
})

export type Tribute = Type.Static<typeof Tribute>
export const Tribute = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Tribute),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            metadata: Type.Optional(TributeMetadata)
        })
    ])
)

export const TributeValidator = Compile(Tribute)

export function isTribute(action?: GameAction): action is Tribute {
    return action?.type === ActionType.Tribute
}

export class HydratedTribute extends HydratableAction<typeof Tribute> implements Tribute {
    declare type: ActionType.Tribute
    declare playerId: string
    declare coords: OffsetCoordinates
    declare metadata?: TributeMetadata
    constructor(data: Tribute) {
        super(data, TributeValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        assert(HydratedTribute.canTributeAt(state, this.playerId, this.coords), 'Invalid tribute')
        const otherPlayers = state.board
            .playersWithSundiversAt(this.coords)
            .filter((id) => id !== this.playerId)

        this.metadata = { payments: {} }

        const playerState = state.getPlayerState(this.playerId)
        for (const otherPlayerId of otherPlayers) {
            const numSundivers = state.board.sundiversForPlayerAt(otherPlayerId, this.coords).length
            const otherPlayerState = state.getPlayerState(otherPlayerId)
            const payment = Math.min(numSundivers, otherPlayerState.energyCubes)

            if (payment > 0) {
                otherPlayerState.energyCubes -= payment
                playerState.energyCubes += payment
                this.metadata.payments[otherPlayerId] =
                    (this.metadata.payments[otherPlayerId] ?? 0) + payment
            }
        }
    }

    static canTribute(state: HydratedSolGameState, playerId: string): boolean {
        return Iterator.from(state.board).some((cell) =>
            HydratedTribute.canTributeAt(state, playerId, cell.coords)
        )
    }

    static canTributeAt(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const cell = state.board.cellAt(coords)
        if (!cell.station || cell.station.playerId !== playerId) {
            return false
        }
        const otherPlayers = state.board
            .playersWithSundiversAt(coords)
            .filter((id) => id !== playerId)
        return otherPlayers.length > 0
    }
}
