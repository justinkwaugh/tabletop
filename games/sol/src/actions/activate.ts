import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Station, StationType } from '../components/stations.js'
import { Activation } from '../model/activation.js'
import { BASE_AWARD_PER_RING, CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'
import { MachineState } from '../definition/states.js'
import { EffectType, HydratedSolPlayerState, Ring, SolPlayerState } from '../index.js'

export type ActivateMetadata = Static<typeof ActivateMetadata>
export const ActivateMetadata = Type.Object({
    activatedStation: Station,
    sundiverId: Type.Optional(Type.String()),
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

        const activation: Activation = state.getActivationForPlayer(this.playerId) ?? {
            playerId: this.playerId,
            activatedIds: [],
            stationType:
                state.activeEffect === EffectType.Festival ||
                state.activeEffect === EffectType.Pulse
                    ? undefined
                    : station.type
        }

        activation.activatedIds.push(this.stationId)
        activation.currentStationId = this.stationId
        activation.currentStationCoords = this.coords
        state.addActivation(activation)

        this.metadata = {
            sundiverId: undefined,
            energyAdded: 0,
            createdSundiverIds: [],
            momentumAdded: 0,
            activatedStation: station
        }

        const duplicate = state.activeEffect === EffectType.Duplicate
        const awardMetadata = HydratedActivate.applyActivationAward(playerState, station, duplicate)
        Object.assign(this.metadata, awardMetadata)

        if (state.machineState !== MachineState.SolarFlares) {
            if (
                state.activeEffect !== EffectType.Pulse &&
                state.activeEffect !== EffectType.Motivate
            ) {
                const playerDivers = state.board.sundiversForPlayer(this.playerId, cell)
                const removed = playerDivers.at(-1)
                if (!removed) {
                    throw new Error('No sundiver to remove')
                }
                this.metadata.sundiverId = removed.id

                const removedDivers = state.board.removeSundiversFromCell([removed.id], cell)
                playerState.addSundiversToHold(removedDivers)
            }

            if (state.activeEffect !== EffectType.Motivate) {
                const cardsToDraw = CARDS_DRAWN_PER_RING[ring]
                state.cardsToDraw += cardsToDraw
            }
        }

        if (state.activeEffect === EffectType.Synchronize) {
            playerState.momentum += 1
            this.metadata.momentumAdded += 1
        }
    }

    static applyActivationAward(
        playerState: HydratedSolPlayerState,
        station: Station,
        duplicate: boolean = false
    ): { energyAdded: number; createdSundiverIds: string[]; momentumAdded: number } {
        const award = BASE_AWARD_PER_RING[station.coords!.row]
        const metadata: {
            energyAdded: number
            createdSundiverIds: string[]
            momentumAdded: number
        } = { energyAdded: 0, createdSundiverIds: [], momentumAdded: 0 }
        switch (station.type) {
            case StationType.EnergyNode:
                playerState.energyCubes += award
                metadata.energyAdded = award
                break
            case StationType.SundiverFoundry:
                playerState.energyCubes -= award

                const buildAmount = duplicate ? 2 * award : award
                const awardedSundivers = playerState.reserveSundivers.splice(
                    -buildAmount,
                    buildAmount
                )
                playerState.addSundiversToHold(awardedSundivers)
                metadata.createdSundiverIds = awardedSundivers.map((diver) => diver.id)
                break
            case StationType.TransmitTower:
                playerState.energyCubes -= award
                playerState.momentum += award
                metadata.momentumAdded = award
                break
        }
        return metadata
    }

    static canActivate(state: HydratedSolGameState, playerId: string): boolean {
        for (const cell of state.board) {
            if (this.canActivateStationAt(state, playerId, cell.coords)) {
                return true
            }
        }
        return false
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
        const numToBuild = state.activeEffect === EffectType.Duplicate ? 2 * awardCost : awardCost
        const playerState = state.getPlayerState(playerId)

        return (
            playerState.energyCubes >= awardCost &&
            playerState.reserveSundivers.length >= numToBuild
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
        coords: OffsetCoordinates,
        pulse: boolean = false
    ): boolean {
        const turnPlayerActivation = state.getActivationForTurnPlayer()
        if (
            turnPlayerActivation &&
            turnPlayerActivation.playerId !== playerId &&
            !state.solarFlares
        ) {
            return false
        }

        const activation = state.getActivationForPlayer(playerId)

        if (activation && activation.currentStationId) {
            return false
        }

        const cell = state.board.cellAt(coords)
        const station = cell.station

        if (!station || state.hasActivatedStation(playerId, station.id)) {
            return false
        }

        if (
            activation &&
            activation.stationType !== undefined &&
            activation.stationType !== station.type
        ) {
            return false
        }

        if (pulse || state.activeEffect === EffectType.Pulse) {
            if (coords.row !== Ring.Outer && coords.row !== Ring.Inner) {
                return false
            }
        } else if (state.machineState === MachineState.SolarFlares) {
            if (station.playerId !== playerId || coords.row !== Ring.Outer) {
                return false
            }
        } else if (state.activeEffect !== EffectType.Motivate) {
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

    static canPulse(state: HydratedSolGameState, playerId: string): boolean {
        if (state.activations && state.activations.length > 0) {
            return false
        }

        const stations = [
            ...state.board.stationsInRing(Ring.Outer),
            ...state.board.stationsInRing(Ring.Inner)
        ]
        return stations.some((station) =>
            HydratedActivate.canActivateStationAt(state, playerId, station.coords!, true)
        )
    }
}
