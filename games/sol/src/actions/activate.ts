import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    HydratableGameState,
    MachineContext,
    OffsetCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { EnergyNode, Station, StationType } from '../components/stations.js'

export type ActivateMetadata = Static<typeof ActivateMetadata>
export const ActivateMetadata = Type.Object({})

export type Activate = Static<typeof Activate>
export const Activate = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Activate),
            playerId: Type.String(),
            stationId: Type.String(),
            coords: OffsetCoordinates, // Not technically needed
            metadata: Type.Optional(ActivateMetadata)
        })
    ])
)

export const ActivateValidator = Compile(Activate)

export function isActivate(action?: GameAction): action is Activate {
    return action?.type === ActionType.Activate
}

export const BASE_AWARD_PER_RING: number[] = [0, 1, 1, 2, 3, 5]
export const BONUS_AWARD_PER_RING: number[] = [0, 0, 1, 1, 2, 3]
export class HydratedActivate extends HydratableAction<typeof Activate> implements Activate {
    declare type: ActionType.Activate
    declare playerId: string
    declare stationId: string
    declare coords: OffsetCoordinates
    declare metadata?: ActivateMetadata

    constructor(data: Activate) {
        super(data, ActivateValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedActivate.isValidActivation(state, this)) {
            throw Error('Invalid activation')
        }

        const playerState = state.getPlayerState(this.playerId)

        const cell = state.board.cellAt(this.coords)
        const station = cell.station
        const ring = this.coords.row

        switch (station?.type) {
            case StationType.EnergyNode:
                playerState.energyCubes += BASE_AWARD_PER_RING[ring]
                break
            case StationType.SundiverFoundry:
                break
            case StationType.TransmitTower:
                break
        }
    }

    static canActivate(state: HydratedSolGameState, playerId: string): boolean {
        for (const cell of state.board) {
            if (!cell.station) {
                continue
            }

            switch (cell.station.type) {
                case StationType.EnergyNode:
                    if (this.canActivateEnergyNode(state, playerId, cell.station, cell.coords)) {
                        return true
                    }
                    break
                case StationType.SundiverFoundry:
                    if (this.canActivateSundiverFoundry(state, playerId)) {
                        return true
                    }
                    break
                case StationType.TransmitTower:
                    if (this.canActivateTransmitTower(state, playerId)) {
                        return true
                    }
                    break
            }
        }

        return false
    }

    static canActivateEnergyNode(
        state: HydratedSolGameState,
        playerId: string,
        station: EnergyNode,
        coords: OffsetCoordinates
    ): boolean {
        return state.board.sundiversForPlayerAt(playerId, coords).length > 0
    }

    static canActivateSundiverFoundry(state: HydratedSolGameState, playerId: string): boolean {
        return false
    }

    static canActivateTransmitTower(state: HydratedSolGameState, playerId: string): boolean {
        return false
    }

    static isValidActivation(state: HydratedSolGameState, activate: Activate): boolean {
        const cell = state.board.cellAt(activate.coords)
        const station = cell.station

        if (!station) {
            return false
        }

        const playerDivers = state.board.sundiversForPlayer(activate.playerId, cell)
        if (playerDivers.length < 1) {
            return false
        }

        switch (station.type) {
            case StationType.EnergyNode:
                return this.isValidEnergyNodeActivation(state, activate, station)
            case StationType.SundiverFoundry:
                return false
            case StationType.TransmitTower:
                return false
        }
    }

    static isValidEnergyNodeActivation(
        state: HydratedSolGameState,
        activate: Activate,
        station: Station
    ): boolean {
        return true
    }

    static isValidSundiverFoundryActivation(
        state: HydratedSolGameState,
        activate: Activate,
        station: Station
    ): boolean {
        return false
    }

    static isValidTransmitTowerActivation(
        state: HydratedSolGameState,
        activate: Activate,
        station: Station
    ): boolean {
        return false
    }
}
