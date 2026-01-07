import { Type, type Static } from 'typebox'
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

import { Sundiver } from '../components/sundiver.js'

export type HatchMetadata = Static<typeof HatchMetadata>
export const HatchMetadata = Type.Object({
    replacedSundiver: Sundiver,
    addedSundivers: Type.Array(Sundiver)
})

export type Hatch = Static<typeof Hatch>
export const Hatch = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Hatch),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            targetPlayerId: Type.String(),
            metadata: Type.Optional(HatchMetadata)
        })
    ])
)

export const HatchValidator = Compile(Hatch)

export function isHatch(action?: GameAction): action is Hatch {
    return action?.type === ActionType.Hatch
}

export class HydratedHatch extends HydratableAction<typeof Hatch> implements Hatch {
    declare type: ActionType.Hatch
    declare playerId: string
    declare coords: OffsetCoordinates
    declare targetPlayerId: string
    declare metadata?: HatchMetadata
    constructor(data: Hatch) {
        super(data, HatchValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        assert(HydratedHatch.canHatchAt(state, this.playerId, this.coords), 'Invalid hatch')

        const cell = state.board.cellAt(this.coords)
        const targetPlayerDivers = state.board.sundiversForPlayerAt(
            this.targetPlayerId,
            this.coords
        )
        assert(targetPlayerDivers.length > 0, 'No player sundivers at target cell')

        const targetDiver = state.board.sundiversForPlayer(this.targetPlayerId, cell)[0]

        const replacedDivers = state.board.removeSundiversFromCell([targetDiver.id], cell)
        const targetPlayerState = state.getPlayerState(this.targetPlayerId)
        targetPlayerState.addSundiversToHold(replacedDivers)

        const playerState = state.getPlayerState(this.playerId)
        const numToAdd = Math.min(2, playerState.reserveSundivers.length)
        const diversToAdd = playerState.removeSundiversFromReserve(numToAdd)
        state.board.addSundiversToCell(diversToAdd, this.coords)
        this.metadata = {
            replacedSundiver: replacedDivers[0],
            addedSundivers: diversToAdd
        }
    }

    static canHatch(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (playerState.reserveSundivers.length === 0) {
            return false
        }
        return Iterator.from(state.board).some((cell) =>
            this.canHatchAt(state, playerId, cell.coords)
        )
    }

    static canHatchAt(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const cell = state.board.cellAt(coords)
        const playerDivers = state.board.sundiversForPlayerAt(playerId, coords)
        return (
            playerDivers.length > 0 &&
            cell.sundivers.length > playerDivers.length &&
            state.board.canAddSundiversToCell(playerId, 2, coords)
        )
    }
}
