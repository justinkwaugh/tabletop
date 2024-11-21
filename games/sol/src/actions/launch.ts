import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
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
export const LaunchMetadata = Type.Object({})

export type Launch = Static<typeof Launch>
export const Launch = Type.Composite([
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

export const LaunchValidator = TypeCompiler.Compile(Launch)

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
        playerState.movementPoints -= this.numSundivers
    }

    static canLaunch(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)

        if (playerState.movementPoints === 0) {
            return false
        }

        // check every player's hold due to potential Blight effect
        for (const player of state.players) {
            if (player.numSundiversInHold(playerId) === 0) {
                continue
            }

            const launchCoordinates = state.board.launchCoordinatesForMothership(player.playerId)
            if (
                launchCoordinates.length > 0 &&
                launchCoordinates.some((coords) =>
                    state.board.canAddSundiversToCell(playerId, 1, coords)
                )
            ) {
                return true
            }
        }
        return false
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
