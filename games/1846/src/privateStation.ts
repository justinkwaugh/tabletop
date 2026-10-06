import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type GameAction
} from '@tabletop/common'
import {
    StationPlacement,
    StationPlacementDetails,
    addCompanyStations,
    applyStationPlacement,
    recordPrivatePowerUse
} from '@tabletop/18xx'
import { privatePowerCompany, type PrivateConstructionState } from './privateConstruction.js'
import { StationRules1846 } from './stations.js'
import type { HydratedEighteenFortySixState } from './state.js'

export function chicagoPrivateStation(state: PrivateConstructionState, playerId: string) {
    const companyId = privatePowerCompany(state, playerId, 'C&WI')
    if (!companyId) return undefined
    const slot = new StationPlacement(state, StationRules1846).openSlots(
        companyId,
        'D6',
        'city-3'
    )[0]
    return slot === undefined
        ? undefined
        : { companyId, position: { locationId: 'D6', nodeId: 'city-3', slot } }
}
export const PlaceCWIStation = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PlaceCWIStation'),
        companyId: Type.String(),
        metadata: Type.Optional(StationPlacementDetails)
    },
    { additionalProperties: false }
)
export type PlaceCWIStation = Type.Static<typeof PlaceCWIStation>
const Validator = Compile(PlaceCWIStation)
export function isPlaceCWIStation(action: GameAction): action is PlaceCWIStation {
    return Validator.Check(action)
}
export class PlaceCWIStationAction extends HydratableAction<typeof PlaceCWIStation> {
    declare playerId: string
    declare companyId: string
    declare metadata?: PlaceCWIStation['metadata']
    constructor(data: PlaceCWIStation) {
        super(data, Validator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        return (
            this.source === ActionSource.User &&
            chicagoPrivateStation(state, this.playerId)?.companyId === this.companyId
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.isValid(state),
            'The owning corporation may place its extra Chicago station once'
        )
        const choice = chicagoPrivateStation(state, this.playerId)
        assertExists(choice)
        addCompanyStations(state, this.companyId, 1)
        const extra = state.stations.at(-1)
        assertExists(extra)
        const details = { ...choice, stationId: extra.id, cost: 0 }
        applyStationPlacement(state, details)
        recordPrivatePowerUse(state, 'C&WI')
        this.metadata = details
    }
}
