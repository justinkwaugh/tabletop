import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { EffectType } from '../components/effects.js'
import { HydratedSolPlayerState } from 'src/model/playerState.js'
import { MachineState } from '../definition/states.js'
import { HydratedActivate } from './activate.js'
import { StationType } from '../components/stations.js'
import { HydratedConvert } from './convert.js'
import { BASE_AWARD_PER_RING, CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'
import { Direction, Ring } from '../utils/solGraph.js'
import { HydratedFly } from './fly.js'

export type ActivateEffectMetadata = Static<typeof ActivateEffectMetadata>
export const ActivateEffectMetadata = Type.Object({
    energyAdded: Type.Number(),
    createdSundiverIds: Type.Array(Type.String()),
    momentumAdded: Type.Number()
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
            momentumAdded: 0
        }
        // Retroactive ceremony application
        if (
            this.effect === EffectType.Ceremony &&
            state.getEffectTracking().outerRingLaunches > 0
        ) {
            playerState.energyCubes += state.getEffectTracking().outerRingLaunches
        } else if (this.effect === EffectType.Augment) {
            const activation = state.activation!
            const currentStationCoords = activation.currentStationCoords!
            const cellDivers = state.board.cellAt(currentStationCoords).sundivers

            const additionalReward =
                AUGMENT_AWARD_INCREASE_PER_RING[currentStationCoords.row] * cellDivers.length
            console.log('Augment additional reward:', additionalReward)
            if (
                activation.stationType === StationType.SundiverFoundry ||
                activation.stationType === StationType.TransmitTower
            ) {
                playerState.energyCubes -= additionalReward
            }

            switch (activation.stationType) {
                case StationType.EnergyNode:
                    console.log('Applying augment energy reward:', additionalReward)
                    playerState.energyCubes += additionalReward
                    this.metadata.energyAdded = additionalReward
                    break
                case StationType.SundiverFoundry:
                    console.log('Applying augment sundiver reward:', additionalReward)
                    const awardedSundivers = playerState.reserveSundivers.splice(
                        -additionalReward,
                        additionalReward
                    )
                    playerState.holdSundivers.push(...awardedSundivers)
                    this.metadata.createdSundiverIds = awardedSundivers.map((diver) => diver.id)
                    break
                case StationType.TransmitTower:
                    console.log('Applying augment momentum reward:', additionalReward)
                    playerState.momentum += additionalReward
                    this.metadata.momentumAdded = additionalReward
                    break
            }
        } else if (this.effect === EffectType.Cluster) {
            state.getEffectTracking().clustersRemaining = 2
        } else if (this.effect === EffectType.Squeeze) {
            state.getEffectTracking().squeezed = true
        } else if (this.effect === EffectType.Hyperdrive) {
            playerState.movementPoints *= 2
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

        if (!this.hasCardForEffect(state, playerState, effect)) {
            return false
        }

        switch (effect) {
            case EffectType.Ceremony:
                return this.canActivateCeremony(state, playerId)
            case EffectType.Motivate:
                return this.canActivateMotivate(state, playerId)
            case EffectType.Augment:
                return this.canActivateAugment(state, playerId)
            case EffectType.Cluster:
                return this.canActivateCluster(state, playerId)
            case EffectType.Cascade:
                return this.canActivateCascade(state, playerId)
            case EffectType.Squeeze:
                return this.canActivateSqueeze(state, playerId)
            case EffectType.Hyperdrive:
                return this.canActivateHyperdrive(state, playerId)
            case EffectType.Puncture:
                return this.canActivatePuncture(state, playerId)
            case EffectType.Pillar:
                return this.canActivatePillar(state, playerId)
            default:
                return false
        }
    }

    static canActivateCeremony(state: HydratedSolGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Moving) {
            return false
        }
        const playerState = state.getPlayerState(playerId)
        return playerState.holdSundivers.length > 0
    }

    static canActivateMotivate(state: HydratedSolGameState, playerId: string): boolean {
        const station = state.effectTracking?.convertedStation
        if (!station || !station.coords) {
            return false
        }
        return HydratedActivate.canActivateStationAt(state, playerId, station.coords)
    }

    static canActivateAugment(state: HydratedSolGameState, playerId: string): boolean {
        const activation = state.activation
        if (!activation) {
            return false
        }

        if (activation.playerId !== playerId) {
            return false
        }

        const station = state.getActivatingStation()
        if (!station) {
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
        return HydratedConvert.canConvert(state, playerId)
    }

    static canActivateSqueeze(state: HydratedSolGameState, playerId: string): boolean {
        const activation = state.activation
        if (!activation) {
            return false
        }
        let station
        try {
            station = state.getActivatingStation()
        } catch {
            return false
        }

        if (
            !station ||
            station.playerId !== playerId ||
            (station.coords?.row ?? 0) > Ring.Convective
        ) {
            return false
        }

        if (
            station.type === StationType.SundiverFoundry ||
            station.type === StationType.TransmitTower
        ) {
            const energyCost = BASE_AWARD_PER_RING[station.coords!.row] * 2
            if (state.getPlayerState(playerId).energyCubes < energyCost) {
                return false
            }
        }

        if (station.type === StationType.SundiverFoundry) {
            const diversNeeded = BASE_AWARD_PER_RING[station.coords!.row] * 2
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
        return state.machineState === MachineState.DrawingCards && state.cardsToDraw > 0
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
