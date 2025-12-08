import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'
import { Ring } from '../utils/solGraph.js'
import { BONUS_AWARD_PER_RING } from '../utils/solConstants.js'

export type ActivateBonusMetadata = Static<typeof ActivateBonusMetadata>
export const ActivateBonusMetadata = Type.Object({
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
        const ring = state.activation?.currentStationCoords?.row ?? Ring.Center

        this.metadata = {
            coords: state.activation?.currentStationCoords!,
            energyAdded: 0,
            createdSundiverIds: [],
            momentumAdded: 0
        }

        switch (station?.type) {
            case StationType.EnergyNode:
                playerState.energyCubes += BONUS_AWARD_PER_RING[ring]
                this.metadata.energyAdded = BONUS_AWARD_PER_RING[ring]
                break
            case StationType.SundiverFoundry:
                const awardCost = BONUS_AWARD_PER_RING[ring]
                playerState.energyCubes -= awardCost
                const awardedSundivers = playerState.reserveSundivers.splice(-awardCost, awardCost)
                playerState.holdSundivers.push(...awardedSundivers)
                this.metadata.createdSundiverIds = awardedSundivers.map((diver) => diver.id)
                break
            case StationType.TransmitTower:
                playerState.energyCubes -= BONUS_AWARD_PER_RING[ring]
                playerState.momentum = (playerState.momentum ?? 0) + BONUS_AWARD_PER_RING[ring]
                this.metadata.momentumAdded = BONUS_AWARD_PER_RING[ring]
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
        const awardCost = BONUS_AWARD_PER_RING[ring]
        return (
            playerState.energyCubes >= awardCost && playerState.reserveSundivers.length > awardCost
        )
    }

    static canActivateTransmitTowerBonus(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const ring = state.activation?.currentStationCoords?.row ?? Ring.Center
        const awardCost = BONUS_AWARD_PER_RING[ring]
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
