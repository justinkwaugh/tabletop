import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { cityPlaceId } from '../components/places.js'
import { OracleChange, type HydratedBoard } from '../model/board.js'
import { CityPlacementKind, type CityPlacementPlan } from '../model/cityRules.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'

export type PlaceCityMetadata = Type.Static<typeof PlaceCityMetadata>
export const PlaceCityMetadata = Type.Object({
    cityId: Type.String(),
    founded: Type.Boolean(),
    mergedCityIds: Type.Array(Type.String()),
    foundingMarket: Type.Boolean(),
    claimVillage: Type.Optional(AxialCoordinates),
    oracleChanges: Type.Array(OracleChange)
})

type TileOutcome = {
    cityId: string
    founded: boolean
    mergedCityIds: string[]
    claimVillage?: AxialCoordinates
    completesFounding: boolean
    awaitsVillage: boolean
}

export type PlaceCity = Type.Static<typeof PlaceCity>
export const PlaceCity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceCity),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceCityMetadata),
            coords: AxialCoordinates
        })
    ])
)

export const PlaceCityValidator = Compile(PlaceCity)

export function isPlaceCity(action?: GameAction): action is PlaceCity {
    return action?.type === ActionType.PlaceCity
}

export class HydratedPlaceCity extends HydratableAction<typeof PlaceCity> implements PlaceCity {
    declare type: ActionType.PlaceCity
    declare playerId: string
    declare metadata?: PlaceCityMetadata
    declare coords: AxialCoordinates

    constructor(data: PlaceCity) {
        super(data, PlaceCityValidator)
    }

    apply(state: HydratedMagnaGreciaGameState, _context?: MachineContext) {
        const plan = state.cityPlacementPlan(this.playerId, this.coords)
        assertExists(plan, 'Invalid PlaceCity action')
        const turn = state.activeTurn(this.playerId)
        const outcome = this.placeTile(state.board, plan)

        if (outcome.founded) {
            turn.foundedCity = true
        }
        const continuesFounding = turn.pendingFounding === outcome.cityId
        turn.pendingClaim = outcome.claimVillage
            ? {
                  village: outcome.claimVillage,
                  cityId: outcome.cityId,
                  founding: outcome.founded || continuesFounding
              }
            : undefined
        turn.pendingFounding =
            outcome.awaitsVillage || (continuesFounding && !outcome.claimVillage)
                ? outcome.cityId
                : undefined

        const foundingMarket =
            outcome.completesFounding && this.placeFoundingMarket(state, outcome.cityId)
        const player = state.getPlayerState(this.playerId)
        player.supplyCities -= 1
        player.points -= 1
        turn.citiesPlaced += 1

        this.metadata = {
            cityId: outcome.cityId,
            founded: outcome.founded,
            mergedCityIds: outcome.mergedCityIds,
            foundingMarket,
            claimVillage: outcome.claimVillage,
            oracleChanges: state.board.updateOracleAttention(state.board.network())
        }
    }

    private placeTile(board: HydratedBoard, plan: CityPlacementPlan): TileOutcome {
        switch (plan.kind) {
            case CityPlacementKind.Found:
                return {
                    cityId: board.foundCity(this.playerId, this.coords).id,
                    founded: true,
                    mergedCityIds: [],
                    claimVillage: plan.claimVillage,
                    completesFounding: !plan.claimVillage && !plan.awaitsVillage,
                    awaitsVillage: !!plan.awaitsVillage
                }
            case CityPlacementKind.Expand:
                return {
                    cityId: plan.cityIds[0],
                    founded: false,
                    mergedCityIds: board.extendCity(plan.cityIds[0], this.coords),
                    claimVillage: plan.claimVillage,
                    completesFounding: false,
                    awaitsVillage: false
                }
            case CityPlacementKind.CompleteClaim:
                return {
                    cityId: plan.cityId,
                    founded: false,
                    mergedCityIds: board.extendCity(plan.cityId, this.coords),
                    completesFounding: plan.founding,
                    awaitsVillage: false
                }
        }
    }

    private placeFoundingMarket(state: HydratedMagnaGreciaGameState, cityId: string): boolean {
        const placeId = cityPlaceId(cityId)
        if (
            state.board.marketOf(this.playerId, placeId) ||
            state.board.marketsRemaining(this.playerId) === 0
        ) {
            return false
        }
        state.board.addMarket({
            playerId: this.playerId,
            placeId,
            coords: this.coords,
            sold: false
        })
        return true
    }

    static canPlaceCity(state: HydratedMagnaGreciaGameState, playerId: string): boolean {
        return state.cityPlacementsRemaining(playerId) > 0
    }
}
