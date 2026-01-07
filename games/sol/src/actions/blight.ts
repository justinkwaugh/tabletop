import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Ring } from '../utils/solGraph.js'

export type BlightMetadata = Static<typeof BlightMetadata>
export const BlightMetadata = Type.Object({
    sundiverId: Type.String()
})

export type Blight = Static<typeof Blight>
export const Blight = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Blight),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            targetPlayerId: Type.String(),
            metadata: Type.Optional(BlightMetadata)
        })
    ])
)

export const BlightValidator = Compile(Blight)

export function isBlight(action?: GameAction): action is Blight {
    return action?.type === ActionType.Blight
}

export class HydratedBlight extends HydratableAction<typeof Blight> implements Blight {
    declare type: ActionType.Blight
    declare playerId: string
    declare coords: OffsetCoordinates
    declare targetPlayerId: string
    declare metadata?: BlightMetadata
    constructor(data: Blight) {
        super(data, BlightValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (
            !HydratedBlight.canBlightMothershipFrom(
                state,
                this.playerId,
                this.targetPlayerId,
                this.coords
            )
        ) {
            throw Error('Invalid blight')
        }

        const playerState = state.getPlayerState(this.playerId)
        const cell = state.board.cellAt(this.coords)

        this.metadata = { sundiverId: '' }

        const playerDivers = state.board.sundiversForPlayer(this.playerId, cell)
        const removed = playerDivers.at(-1)
        assertExists(removed, 'No sundiver to remove')

        this.metadata.sundiverId = removed.id

        const removedDivers = state.board.removeSundiversFromCell([removed.id], cell)
        playerState.addSundiversToHold(removedDivers)

        const blightingDivers = playerState.removeSundiversFromReserve(3)
        const targetPlayerState = state.getPlayerState(this.targetPlayerId)
        targetPlayerState.addSundiversToHold(blightingDivers)
    }

    static canBlight(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (playerState.reserveSundivers.length < 3) {
            return false
        }

        const otherPlayerIds = state.players.map((p) => p.playerId).filter((id) => id !== playerId)

        return otherPlayerIds.some((otherPlayerId) =>
            this.canBlightMothership(state, playerId, otherPlayerId)
        )
    }

    static canBlightMothershipFrom(
        state: HydratedSolGameState,
        playerId: string,
        targetPlayerId: string,
        coords: OffsetCoordinates
    ): boolean {
        if (coords.row !== Ring.Outer && coords.row !== Ring.Inner) {
            return false
        }

        if (state.board.sundiversForPlayerAt(playerId, coords).length === 0) {
            return false
        }

        return state.board.isAdjacentToMothership(coords, targetPlayerId)
    }

    static canBlightAnyMothershipFrom(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const otherPlayerIds = state.players.map((p) => p.playerId).filter((id) => id !== playerId)
        return otherPlayerIds.some((otherPlayerId) =>
            this.canBlightMothershipFrom(state, playerId, otherPlayerId, coords)
        )
    }

    static canBlightMothership(
        state: HydratedSolGameState,
        playerId: string,
        mothershipPlayerId: string
    ): boolean {
        const coordinates = state.board.launchCoordinatesForMothership(mothershipPlayerId)
        return coordinates.some(
            (coords) => state.board.sundiversForPlayerAt(playerId, coords).length > 0
        )
    }
}
