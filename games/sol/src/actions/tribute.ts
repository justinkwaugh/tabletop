import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type TributeMetadata = Static<typeof TributeMetadata>
export const TributeMetadata = Type.Object({})

export type Tribute = Static<typeof Tribute>
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
        if (!HydratedTribute.canTributeAt(state, this.playerId, this.coords)) {
            throw Error('Invalid tribute')
        }

        const otherPlayers = state.board
            .playersWithSundiversAt(this.coords)
            .filter((id) => id !== this.playerId)

        const playerState = state.getPlayerState(this.playerId)
        for (const otherPlayerId of otherPlayers) {
            const otherPlayerState = state.getPlayerState(otherPlayerId)
            if (otherPlayerState.energyCubes > 0) {
                otherPlayerState.energyCubes -= 1
                playerState.energyCubes += 1
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
