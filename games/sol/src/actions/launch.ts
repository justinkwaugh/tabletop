import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates,
    sameCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type LaunchMetadata = Static<typeof LaunchMetadata>
export const LaunchMetadata = Type.Object({
    sundiverIds: Type.Array(Type.String())
})

export type Launch = Static<typeof Launch>
export const Launch = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Launch),
            playerId: Type.String(),
            mothership: Type.String(), // player id is surrogate for mothership
            numSundivers: Type.Number(),
            destination: OffsetCoordinates,
            metadata: Type.Optional(LaunchMetadata)
        })
    ])
)

export const LaunchValidator = Compile(Launch)

export function isLaunch(action?: GameAction): action is Launch {
    return action?.type === ActionType.Launch
}

export class HydratedLaunch extends HydratableAction<typeof Launch> implements Launch {
    declare type: ActionType.Launch
    declare playerId: string
    declare mothership: string
    declare numSundivers: number
    declare destination: OffsetCoordinates
    declare metadata?: LaunchMetadata

    constructor(data: Launch) {
        super(data, LaunchValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!this.isValidLaunch(state)) {
            throw Error('Invalid launch')
        }

        const playerState = state.getPlayerState(this.playerId)
        const mothershipPlayer = state.getPlayerState(this.mothership)
        const launchedSundivers = mothershipPlayer.removeSundiversFromHold(
            this.numSundivers,
            this.playerId
        )
        state.board.addSundiversToCell(launchedSundivers, this.destination)
        this.metadata = { sundiverIds: launchedSundivers.map((diver) => diver.id) }
        playerState.movementPoints -= this.numSundivers
    }

    static canLaunch(state: HydratedSolGameState, playerId: string): boolean {
        return state.players.some((player) =>
            this.canLaunchFromMothership(state, playerId, player.playerId)
        )
    }

    static canLaunchFromMothership(
        state: HydratedSolGameState,
        playerId: string,
        mothershipPlayerId: string
    ): boolean {
        const player = state.getPlayerState(playerId)
        if (player.movementPoints === 0) {
            return false
        }

        const mothershipPlayer = state.getPlayerState(mothershipPlayerId)
        if (mothershipPlayer.numSundiversInHold(playerId) === 0) {
            return false
        }

        const launchCoordinates = state.board.launchCoordinatesForMothership(mothershipPlayerId)

        return (
            launchCoordinates.length > 0 &&
            launchCoordinates.some((coords) =>
                state.board.canAddSundiversToCell(playerId, 1, coords)
            )
        )
    }

    isValidLaunch(state: HydratedSolGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)

        if (playerState.movementPoints < this.numSundivers) {
            return false
        }

        const mothershipPlayer = state.getPlayerState(this.mothership)
        if (mothershipPlayer.numSundiversInHold(this.playerId) < this.numSundivers) {
            return false
        }

        const launchCoordinates = state.board.launchCoordinatesForMothership(this.mothership)
        if (!launchCoordinates.find((coords) => sameCoordinates(coords, this.destination))) {
            return false
        }

        if (
            !state.board.canAddSundiversToCell(this.playerId, this.numSundivers, this.destination)
        ) {
            return false
        }

        return true
    }
}
