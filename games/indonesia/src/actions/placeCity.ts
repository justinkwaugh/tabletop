import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { City } from '../components/city.js'
import { isIndonesiaNodeId } from '../utils/indonesiaNodes.js'

export type PlaceCityMetadata = Type.Static<typeof PlaceCityMetadata>
export const PlaceCityMetadata = Type.Object({
    city: City
})

export type PlaceCity = Type.Static<typeof PlaceCity>
export const PlaceCity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceCity), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PlaceCityMetadata), // Always optional, because it is an output
            areaId: Type.String() // The ID of the area where the city is being placed
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
    declare areaId: string

    constructor(data: PlaceCity) {
        super(data, PlaceCityValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidPlaceCity(state)) {
            throw Error('Invalid PlaceCity action')
        }

        const city: City = {
            id: state.getPrng().randId(),
            area: this.areaId,
            size: 1,
            demand: {}
        }

        state.board.addCity(city)

        // TODO: Remove deeds that can no longer be started

        this.metadata = {
            city
        }
    }

    isValidPlaceCity(state: HydratedIndonesiaGameState): boolean {
        const currentCityCard = state.currentCityCard
        if (!currentCityCard) {
            return false
        }

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.cityCards[state.era].find((card) => card.id === currentCityCard.id)) {
            return false
        }

        if (!isIndonesiaNodeId(this.areaId)) {
            return false
        }

        const area = state.board.getArea(this.areaId)
        if (!area || !state.board.isEmptyArea(area) || !state.board.isCoastalArea(area)) {
            return false
        }

        if (!area.region || state.board.hasCityInRegion(area.region)) {
            return false
        }

        return currentCityCard.regions.find((region) => region === area.region) !== undefined
    }

    static canPlaceCity(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const currentCityCard = state.currentCityCard
        if (!currentCityCard) {
            return false
        }

        if (!playerState.cityCards[state.era].find((card) => card.id === currentCityCard.id)) {
            return false
        }
        return currentCityCard.regions.some((region) => {
            return state.board
                .coastalAreasForRegion(region)
                .some((area) => state.board.isEmptyArea(area))
        })
    }
}
