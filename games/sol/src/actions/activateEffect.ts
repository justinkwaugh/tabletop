import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import type { MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { EffectType } from '../components/effects.js'
import type { HydratedSolPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'
import { HydratedActivate } from './activate.js'
import { StationType } from '../components/stations.js'
import { HydratedConvert } from './convert.js'
import { BASE_AWARD_PER_RING } from '../utils/solConstants.js'
import { HydratedFly } from './fly.js'
import { HydratedInvade } from './invade.js'
import { HydratedSacrifice } from './sacrifice.js'
import { HydratedHatch } from './hatch.js'
import { HydratedBlight } from './blight.js'
import { HydratedTribute } from './tribute.js'
import { HydratedChain } from './chain.js'
import { Ring } from '../utils/solGraph.js'

export type ActivateEffectMetadata = Static<typeof ActivateEffectMetadata>
export const ActivateEffectMetadata = Type.Object({
    coords: Type.Optional(OffsetCoordinates),
    energyAdded: Type.Number(),
    createdSundiverIds: Type.Array(Type.String()),
    momentumAdded: Type.Number(),
    procreatedCoords: Type.Array(OffsetCoordinates)
})

export type ActivateEffect = Static<typeof ActivateEffect>
export const ActivateEffect = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ActivateEffect),
            playerId: Type.String(),
            effect: Type.Enum(EffectType),
            metadata: Type.Optional(ActivateEffectMetadata)
        })
    ])
)

export const ActivateEffectValidator = Compile(ActivateEffect)

export function isActivateEffect(action?: GameAction): action is ActivateEffect {
    return action?.type === ActionType.ActivateEffect
}

export const AUGMENT_AWARD_INCREASE_PER_RING = [0, 3, 2, 1, 1, 1]

export class HydratedActivateEffect
    extends HydratableAction<typeof ActivateEffect>
    implements ActivateEffect
{
    declare type: ActionType.ActivateEffect
    declare playerId: string
    declare effect: EffectType
    declare metadata?: ActivateEffectMetadata

    constructor(data: ActivateEffect) {
        super(data, ActivateEffectValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedActivateEffect.canActivateEffect(state, this.playerId, this.effect)) {
            throw Error('Invalid effect activation')
        }
        const playerState = state.getPlayerState(this.playerId)

        state.activeEffect = this.effect
        playerState.card = undefined

        this.metadata = {
            energyAdded: 0,
            createdSundiverIds: [],
            momentumAdded: 0,
            procreatedCoords: []
        }
        // Retroactive ceremony application
        if (
            this.effect === EffectType.Ceremony &&
            state.getEffectTracking().outerRingLaunches > 0
        ) {
            playerState.energyCubes += state.getEffectTracking().outerRingLaunches
        } else if (this.effect === EffectType.Augment) {
            const activation = state.getActivationForPlayer(this.playerId)
            if (!activation || !activation.currentStationCoords) {
                throw Error('No activation to augment')
            }
            const currentStationCoords = activation.currentStationCoords
            const cellDivers = state.board.cellAt(currentStationCoords).sundivers

            const additionalReward =
                AUGMENT_AWARD_INCREASE_PER_RING[currentStationCoords.row] * cellDivers.length

            if (
                activation.stationType === StationType.SundiverFoundry ||
                activation.stationType === StationType.TransmitTower
            ) {
                playerState.energyCubes -= additionalReward
            }

            this.metadata.coords = currentStationCoords
            switch (activation.stationType) {
                case StationType.EnergyNode:
                    playerState.energyCubes += additionalReward
                    this.metadata.energyAdded = additionalReward
                    break
                case StationType.SundiverFoundry:
                    const awardedSundivers = playerState.reserveSundivers.splice(
                        -additionalReward,
                        additionalReward
                    )
                    playerState.addSundiversToHold(awardedSundivers)
                    this.metadata.createdSundiverIds = awardedSundivers.map((diver) => diver.id)
                    break
                case StationType.TransmitTower:
                    playerState.momentum += additionalReward
                    this.metadata.momentumAdded = additionalReward
                    break
            }
        } else if (this.effect === EffectType.Cluster) {
            state.getEffectTracking().clustersRemaining = 2
        } else if (this.effect === EffectType.Squeeze) {
            state.getEffectTracking().squeezed = true
            const station = state.getActivatingStation(this.playerId)

            if (station.coords!.row >= Ring.Inner) {
                this.metadata.coords = station.coords
                const awardMetadata = HydratedActivate.applyActivationAward(playerState, station)
                Object.assign(this.metadata, awardMetadata)
            }
        } else if (this.effect === EffectType.Hyperdrive) {
            playerState.movementPoints *= 2
        } else if (this.effect === EffectType.Procreate) {
            for (const cell of state.board) {
                state.getEffectTracking().preEffectState = state.machineState
                const sundiversInCell = state.board.sundiversForPlayerAt(this.playerId, cell.coords)
                if (
                    sundiversInCell.length >= 2 &&
                    state.board.canAddSundiversToCell(this.playerId, 1, cell.coords)
                ) {
                    const newDiver = playerState.reserveSundivers.pop()
                    if (newDiver) {
                        state.board.addSundiversToCell([newDiver], cell.coords)
                        this.metadata.createdSundiverIds.push(newDiver.id)
                        this.metadata.procreatedCoords.push(cell.coords)
                    }
                }
            }
            // We did it, no need
            state.activeEffect = undefined
        } else if (
            this.effect === EffectType.Hatch ||
            this.effect === EffectType.Accelerate ||
            this.effect === EffectType.Tribute ||
            this.effect === EffectType.Chain
        ) {
            state.getEffectTracking().preEffectState = state.machineState
        } else if (this.effect === EffectType.Fuel) {
            state.getEffectTracking().fuelRemaining = 3
        }
    }

    static canActivateHeldEffect(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (!playerState.card) {
            return false
        }

        const effect = state.effects[playerState.card.suit]?.type
        if (!effect) {
            return false
        }

        return this.canActivateEffect(state, playerId, effect)
    }

    static canActivateEffect(
        state: HydratedSolGameState,
        playerId: string,
        effect: EffectType
    ): boolean {
        if (state.activeEffect) {
            return false
        }

        const playerState = state.getPlayerState(playerId)

        const currentPlayerId = state.turnManager.currentTurn()?.playerId
        if (currentPlayerId !== playerId) {
            return false
        }

        if (!this.hasCardForEffect(state, playerState, effect)) {
            return false
        }

        switch (effect) {
            case EffectType.Accelerate:
                return this.canActivateAccelerate(state, playerId)
            case EffectType.Augment:
                return this.canActivateAugment(state, playerId)
            case EffectType.Blight:
                return this.canActivateBlight(state, playerId)
            case EffectType.Cascade:
                return this.canActivateCascade(state, playerId)
            case EffectType.Catapult:
                return this.canActivateCatapult(state, playerId)
            case EffectType.Ceremony:
                return this.canActivateCeremony(state, playerId)
            case EffectType.Chain:
                return this.canActivateChain(state, playerId)
            case EffectType.Channel:
                return this.canActivateChannel(state, playerId)
            case EffectType.Cluster:
                return this.canActivateCluster(state, playerId)
            case EffectType.Duplicate:
                return this.canActivateDuplicate(state, playerId)
            case EffectType.Festival:
                return this.canActivateFestival(state, playerId)
            case EffectType.Fuel:
                return this.canActivateFuel(state, playerId)
            case EffectType.Hatch:
                return this.canActivateHatch(state, playerId)
            case EffectType.Hyperdrive:
                return this.canActivateHyperdrive(state, playerId)
            case EffectType.Invade:
                return this.canActivateInvade(state, playerId)
            case EffectType.Juggernaut:
                return this.canActivateJuggernaut(state, playerId)
            case EffectType.Metamorphosis:
                return this.canActivateMetamorphosis(state, playerId)
            case EffectType.Motivate:
                return this.canActivateMotivate(state, playerId)
            case EffectType.Passage:
                return this.canActivatePassage(state, playerId)
            case EffectType.Pillar:
                return this.canActivatePillar(state, playerId)
            case EffectType.Portal:
                return this.canActivatePortal(state, playerId)
            case EffectType.Procreate:
                return this.canActivateProcreate(state, playerId)
            case EffectType.Pulse:
                return this.canActivatePulse(state, playerId)
            case EffectType.Puncture:
                return this.canActivatePuncture(state, playerId)
            case EffectType.Sacrifice:
                return this.canActivateSacrifice(state, playerId)
            case EffectType.Squeeze:
                return this.canActivateSqueeze(state, playerId)
            case EffectType.Synchronize:
                return this.canActivateSynchronize(state, playerId)
            case EffectType.Teleport:
                return this.canActivateTeleport(state, playerId)
            case EffectType.Transcend:
                return this.canActivateTranscend(state, playerId)
            case EffectType.Tribute:
                return this.canActivateTribute(state, playerId)

            default:
                return false
        }
    }

    static canActivateCeremony(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Moving) {
            return false
        }
        const playerState = state.getPlayerState(playerId)
        return playerState.numSundiversInHold(playerId) > 0
    }

    static canActivateMotivate(state: HydratedSolGameState, playerId: string): boolean {
        const station = state.effectTracking?.convertedStation
        if (!station || !station.coords) {
            return false
        }
        return HydratedActivate.canActivateStationAt(state, playerId, station.coords)
    }

    static canActivateAugment(state: HydratedSolGameState, playerId: string): boolean {
        const activation = state.getActivationForPlayer(playerId)
        if (!activation) {
            return false
        }

        let station
        try {
            station = state.getActivatingStation(playerId)
        } catch {
            return false
        }

        const cellDivers = state.board.cellAt(station.coords!).sundivers
        if (cellDivers.length === 0) {
            return false
        }

        if (
            activation.stationType === StationType.SundiverFoundry ||
            activation.stationType === StationType.TransmitTower
        ) {
            const additionalCost =
                AUGMENT_AWARD_INCREASE_PER_RING[station.coords!.row] * cellDivers.length
            const playerState = state.getPlayerState(playerId)
            if (playerState.energyCubes < additionalCost) {
                return false
            }
        }

        return true
    }

    static canActivateCluster(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Moving
    }

    static canActivateCascade(state: HydratedSolGameState, playerId: string): boolean {
        return (
            state.machineState === MachineState.CheckEffect &&
            HydratedConvert.canConvert(state, playerId)
        )
    }

    static canActivateSqueeze(state: HydratedSolGameState, playerId: string): boolean {
        const activation = state.getActivationForPlayer(playerId)
        if (!activation) {
            return false
        }
        let station
        try {
            station = state.getActivatingStation(playerId)
        } catch {
            return false
        }

        if (!station || station.playerId !== playerId) {
            return false
        }

        if (
            station.type === StationType.SundiverFoundry ||
            station.type === StationType.TransmitTower
        ) {
            const energyCost = BASE_AWARD_PER_RING[station.coords!.row]
            if (state.getPlayerState(playerId).energyCubes < energyCost) {
                return false
            }
        }

        if (station.type === StationType.SundiverFoundry) {
            const diversNeeded = BASE_AWARD_PER_RING[station.coords!.row]
            if (state.getPlayerState(playerId).reserveSundivers.length < diversNeeded) {
                return false
            }
        }

        return true
    }

    static canActivateHyperdrive(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Moving && !state.moved
    }

    static canActivatePuncture(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Moving) {
            return false
        }

        const playerState = state.getPlayerState(playerId)
        if (playerState.movementPoints < 1 || playerState.solarGates.length === 0) {
            return false
        }

        return Iterator.from(state.board).some((cell) =>
            HydratedFly.canPunctureFrom(cell.coords, state, playerId)
        )
    }

    static canActivatePillar(state: HydratedSolGameState, playerId: string): boolean {
        return (
            (state.machineState === MachineState.DrawingCards ||
                state.machineState === MachineState.CheckEffect) &&
            state.cardsToDraw > 0
        )
    }

    static canActivateInvade(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Converting) {
            return false
        }

        return HydratedInvade.canInvade(state, playerId)
    }

    static canActivateFestival(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Activating && !state.activations?.length
    }

    static canActivatePortal(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Moving
    }

    static canActivateProcreate(state: HydratedSolGameState, playerId: string): boolean {
        const numReserveSundiversNeeded = Iterator.from(state.board).reduce((acc, cell) => {
            if (
                state.board.sundiversForPlayerAt(playerId, cell.coords).length >= 2 &&
                state.board.canAddSundiversToCell(playerId, 1, cell.coords)
            ) {
                return acc + 1
            }
            return acc
        }, 0)
        const playerState = state.getPlayerState(playerId)
        return (
            numReserveSundiversNeeded > 0 &&
            playerState.reserveSundivers.length >= numReserveSundiversNeeded
        )
    }

    static canActivatePulse(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Activating) {
            return false
        }

        return HydratedActivate.canPulse(state, playerId)
    }

    static canActivateJuggernaut(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Moving) {
            return false
        }

        const hasStation = state.board.hasStationOnBoard(playerId)
        return hasStation
    }

    static canActivateTranscend(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Moving
    }

    static canActivateSacrifice(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Activating) {
            return false
        }
        return HydratedSacrifice.canSacrifice(state)
    }

    static canActivateHatch(state: HydratedSolGameState, playerId: string): boolean {
        return HydratedHatch.canHatch(state, playerId)
    }

    static canActivateTeleport(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Moving) {
            return false
        }

        return HydratedFly.canTeleport(state, playerId)
    }

    static canActivateSynchronize(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Activating
    }

    static canActivateBlight(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Activating) {
            return false
        }

        return HydratedBlight.canBlight(state, playerId)
    }

    static canActivateAccelerate(state: HydratedSolGameState, playerId: string): boolean {
        return true
    }

    static canActivateChannel(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return (
            state.machineState === MachineState.DrawingCards &&
            state.cardsToDraw > 0 &&
            playerState.energyCubes >= state.cardsToDraw
        )
    }

    static canActivateDuplicate(state: HydratedSolGameState, playerId: string): boolean {
        if (
            state.machineState !== MachineState.Activating ||
            (state.activations?.length ?? 0) > 0
        ) {
            return false
        }

        return Iterator.from(state.board).some((cell) => {
            if (!cell.station || cell.station.type !== StationType.SundiverFoundry) {
                return false
            }
            const sundivers = state.board.sundiversForPlayerAt(playerId, cell.coords)
            if (sundivers.length === 0) {
                return false
            }
            const award = BASE_AWARD_PER_RING[cell.coords.row]
            const playerState = state.getPlayerState(playerId)
            return playerState.reserveSundivers.length >= award * 2
        })
    }

    static canActivateCatapult(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Moving
    }

    static canActivateFuel(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return state.machineState === MachineState.Moving && playerState.energyCubes > 0
    }

    static canActivateTribute(state: HydratedSolGameState, playerId: string): boolean {
        return HydratedTribute.canTribute(state, playerId)
    }

    static canActivateMetamorphosis(state: HydratedSolGameState, playerId: string): boolean {
        const activation = state.getActivationForPlayer(playerId)
        if (!activation || !activation.currentStationId) {
            return false
        }

        const station = state.getActivatingStation(playerId)
        if (!station || station.playerId !== playerId) {
            return false
        }

        const playerState = state.getPlayerState(playerId)
        const stationTypes = [
            StationType.EnergyNode,
            StationType.SundiverFoundry,
            StationType.TransmitTower
        ]
        for (const type of stationTypes) {
            if (type === station.type) {
                continue
            }

            switch (type) {
                case StationType.EnergyNode:
                    if (playerState.energyNodes.length > 0) {
                        return true
                    }
                    break
                case StationType.SundiverFoundry:
                    if (playerState.sundiverFoundries.length > 0) {
                        return true
                    }
                    break
                case StationType.TransmitTower:
                    if (playerState.transmitTowers.length > 0) {
                        return true
                    }
                    break
            }
        }
        return false
    }

    static canActivateChain(state: HydratedSolGameState, playerId: string): boolean {
        return Iterator.from(state.board).some((cell) =>
            HydratedChain.canInitiateChainAt(state, cell.coords)
        )
    }

    static canActivatePassage(state: HydratedSolGameState, playerId: string): boolean {
        return state.machineState === MachineState.Moving
    }

    static hasCardForEffect(
        state: HydratedSolGameState,
        playerState: HydratedSolPlayerState,
        effect: EffectType
    ): boolean {
        return (
            playerState.card !== undefined && state.effects[playerState.card.suit]?.type === effect
        )
    }
}
