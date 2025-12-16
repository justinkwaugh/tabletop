import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'
import { Ring } from '../utils/solGraph.js'
import { BONUS_AWARD_PER_RING } from '../utils/solConstants.js'
import { EffectType } from '../components/effects.js'

export type ActivateBonusMetadata = Static<typeof ActivateBonusMetadata>
export const ActivateBonusMetadata = Type.Object({
    stationId: Type.String(),
    coords: OffsetCoordinates,
    energyAdded: Type.Number(),
    createdSundiverIds: Type.Array(Type.String()),
    momentumAdded: Type.Number()
})

export type ActivateBonus = Static<typeof ActivateBonus>
export const ActivateBonus = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ActivateBonus),
            playerId: Type.String(),
            metadata: Type.Optional(ActivateBonusMetadata)
        })
    ])
)

export const ActivateBonusValidator = Compile(ActivateBonus)

export function isActivateBonus(action?: GameAction): action is ActivateBonus {
    return action?.type === ActionType.ActivateBonus
}

export class HydratedActivateBonus
    extends HydratableAction<typeof ActivateBonus>
    implements ActivateBonus
{
    declare type: ActionType.ActivateBonus
    declare playerId: string
    declare metadata?: ActivateBonusMetadata

    constructor(data: ActivateBonus) {
        super(data, ActivateBonusValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedActivateBonus.isValidBonusActivation(state, this)) {
            throw Error('Invalid bonus activation')
        }

        const playerState = state.getPlayerState(this.playerId)

        const station = state.getActivatingStation()

        if (!station) {
            throw Error('No station to activate bonus at')
        }

        const ring = state.activation?.currentStationCoords?.row ?? Ring.Center

        this.metadata = {
            stationId: station.id,
            coords: state.activation?.currentStationCoords!,
            energyAdded: 0,
            createdSundiverIds: [],
            momentumAdded: 0
        }

        const award =
            BONUS_AWARD_PER_RING[ring] * (state.activeEffect === EffectType.Squeeze ? 2 : 1)

        switch (station.type) {
            case StationType.EnergyNode:
                playerState.energyCubes += award
                this.metadata.energyAdded = award
                break
            case StationType.SundiverFoundry:
                const awardCost = award
                playerState.energyCubes -= awardCost
                const numToBuild =
                    state.activation?.playerId === this.playerId &&
                    state.activeEffect === EffectType.Duplicate
                        ? 2 * awardCost
                        : awardCost
                const awardedSundivers = playerState.reserveSundivers.splice(
                    -numToBuild,
                    numToBuild
                )
                playerState.addSundiversToHold(awardedSundivers)
                this.metadata.createdSundiverIds = awardedSundivers.map((diver) => diver.id)
                break
            case StationType.TransmitTower:
                playerState.energyCubes -= award
                playerState.momentum += award
                this.metadata.momentumAdded = award
                break
        }
    }

    static canActivateBonus(state: HydratedSolGameState, playerId: string): boolean {
        if (state.activation?.currentStationCoords?.row === Ring.Outer) {
            return false
        }

        const station = state.getActivatingStation()
        if (!station) {
            return false
        }

        switch (station.type) {
            case StationType.EnergyNode:
                return this.canActivateEnergyNodeBonus(state, playerId)
                break
            case StationType.SundiverFoundry:
                return this.canActivateSundiverFoundryBonus(state, playerId)
                break
            case StationType.TransmitTower:
                return this.canActivateTransmitTowerBonus(state, playerId)
                break
        }
    }

    static canActivateEnergyNodeBonus(state: HydratedSolGameState, playerId: string): boolean {
        return true
    }

    static canActivateSundiverFoundryBonus(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const ring = state.activation?.currentStationCoords?.row ?? Ring.Center
        const awardCost =
            BONUS_AWARD_PER_RING[ring] * (state.activeEffect === EffectType.Squeeze ? 2 : 1)

        const numToBuild =
            state.activation?.playerId === playerId && state.activeEffect === EffectType.Duplicate
                ? 2 * awardCost
                : awardCost
        return (
            playerState.energyCubes >= awardCost &&
            playerState.reserveSundivers.length >= numToBuild
        )
    }

    static canActivateTransmitTowerBonus(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const ring = state.activation?.currentStationCoords?.row ?? Ring.Center
        const awardCost =
            BONUS_AWARD_PER_RING[ring] * (state.activeEffect === EffectType.Squeeze ? 2 : 1)
        return playerState.energyCubes >= awardCost
    }

    static isValidBonusActivation(
        state: HydratedSolGameState,
        activateBonus: ActivateBonus
    ): boolean {
        if (state.activation?.currentStationCoords?.row === Ring.Outer) {
            return false
        }

        const station = state.getActivatingStation()

        switch (station.type) {
            case StationType.EnergyNode:
                return this.canActivateEnergyNodeBonus(state, activateBonus.playerId)
            case StationType.SundiverFoundry:
                return this.canActivateSundiverFoundryBonus(state, activateBonus.playerId)
            case StationType.TransmitTower:
                return this.canActivateTransmitTowerBonus(state, activateBonus.playerId)
        }
    }
}
