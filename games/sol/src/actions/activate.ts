import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'
import { Activation } from '../model/activation.js'
import { BASE_AWARD_PER_RING, CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'
import { MachineState } from '../definition/states.js'
import { Ring } from '../index.js'

export type ActivateMetadata = Static<typeof ActivateMetadata>
export const ActivateMetadata = Type.Object({
    sundiverId: Type.String(),
    energyAdded: Type.Number(),
    createdSundiverIds: Type.Array(Type.String()),
    momentumAdded: Type.Number()
})

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

        if (!station) {
            throw new Error('No station at activation coordinates')
        }

        const ring = this.coords.row

        const activation: Activation = state.activation ?? {
            playerId: this.playerId,
            activatedIds: [],
            stationType: station.type
        }

        activation.activatedIds.push(this.stationId)
        activation.currentStationId = this.stationId
        activation.currentStationCoords = this.coords
        state.activation = activation

        const metadata: ActivateMetadata = {
            sundiverId: '',
            energyAdded: 0,
            createdSundiverIds: [],
            momentumAdded: 0
        }

        switch (station.type) {
            case StationType.EnergyNode:
                playerState.energyCubes += BASE_AWARD_PER_RING[ring]
                metadata.energyAdded = BASE_AWARD_PER_RING[ring]
                break
            case StationType.SundiverFoundry:
                playerState.energyCubes -= BASE_AWARD_PER_RING[ring]
                const awardCount = BASE_AWARD_PER_RING[ring]
                const awardedSundivers = playerState.reserveSundivers.splice(
                    -awardCount,
                    awardCount
                )
                playerState.holdSundivers.push(...awardedSundivers)
                metadata.createdSundiverIds = awardedSundivers.map((diver) => diver.id)
                break
            case StationType.TransmitTower:
                playerState.energyCubes -= BASE_AWARD_PER_RING[ring]
                playerState.momentum = playerState.momentum ?? 0 + BASE_AWARD_PER_RING[ring]
                metadata.momentumAdded = BASE_AWARD_PER_RING[ring]
                break
        }

        if (state.machineState !== MachineState.SolarFlares) {
            const playerDivers = state.board.sundiversForPlayer(this.playerId, cell)
            const removed = playerDivers.at(-1)
            if (!removed) {
                throw new Error('No sundiver to remove')
            }
            metadata.sundiverId = removed.id
            this.metadata = metadata

            const removedDivers = state.board.removeSundiversFromCell([removed.id], cell)
            playerState.addSundiversToHold(removedDivers)

            const cardsToDraw = CARDS_DRAWN_PER_RING[ring]
            state.cardsToDraw = (state.cardsToDraw ?? 0) + cardsToDraw
        }
    }

    static canActivate(state: HydratedSolGameState, playerId: string): boolean {
        for (const cell of state.board) {
            if (this.canActivateStationAt(state, playerId, cell.coords)) {
                return true
            }
        }
        return false
    }

    static isAllowedStationType(state: HydratedSolGameState, stationType: StationType): boolean {
        const activation = state.activation
        if (!activation) {
            return true
        }

        return activation.stationType === undefined || activation.stationType === stationType
    }

    static canActivateEnergyNode(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        return true
    }

    static canActivateSundiverFoundry(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const awardCost = BASE_AWARD_PER_RING[coords.row]
        const playerState = state.getPlayerState(playerId)
        return (
            playerState.energyCubes >= awardCost && playerState.reserveSundivers.length >= awardCost
        )
    }

    static canActivateTransmitTower(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const awardCost = BASE_AWARD_PER_RING[coords.row]
        const playerState = state.getPlayerState(playerId)
        return playerState.energyCubes >= awardCost
    }

    static canActivateStationAt(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const cell = state.board.cellAt(coords)
        const station = cell.station

        if (!station || state.hasActivatedStation(station.id)) {
            return false
        }

        if (!this.isAllowedStationType(state, station.type)) {
            return false
        }

        if (state.machineState === MachineState.SolarFlares) {
            if (station.playerId !== playerId || coords.row !== Ring.Outer) {
                return false
            }
        } else {
            if (state.board.sundiversForPlayerAt(playerId, coords).length === 0) {
                return false
            }
        }

        switch (station.type) {
            case StationType.EnergyNode:
                return this.canActivateEnergyNode(state, playerId, coords)
            case StationType.SundiverFoundry:
                return this.canActivateSundiverFoundry(state, playerId, coords)
            case StationType.TransmitTower:
                return this.canActivateTransmitTower(state, playerId, coords)
        }
    }

    static isValidActivation(state: HydratedSolGameState, activate: Activate): boolean {
        return this.canActivateStationAt(state, activate.playerId, activate.coords)
    }
}
