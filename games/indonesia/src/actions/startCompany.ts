import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    Company,
    isProductionCompany,
    ProductionCompany,
    ShippingCompany
} from '../components/company.js'
import {
    AreaType,
    CultivatedArea,
    isEmptyLandArea,
    isSeaArea,
    SeaArea
} from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'

export type StartCompanyMetadata = Type.Static<typeof StartCompanyMetadata>
export const StartCompanyMetadata = Type.Object({
    company: Company
})

export type StartCompany = Type.Static<typeof StartCompany>
export const StartCompany = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.StartCompany), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(StartCompanyMetadata), // Always optional, because it is an output
            deedId: Type.String(), // The ID of the deed for the company being started,
            areaId: Type.String() // The ID of the area where the company is being started
        })
    ])
)

export const StartCompanyValidator = Compile(StartCompany)

export function isStartCompany(action?: GameAction): action is StartCompany {
    return action?.type === ActionType.StartCompany
}

export class HydratedStartCompany
    extends HydratableAction<typeof StartCompany>
    implements StartCompany
{
    declare type: ActionType.StartCompany
    declare playerId: string
    declare metadata?: StartCompanyMetadata
    declare deedId: string
    declare areaId: string

    constructor(data: StartCompany) {
        super(data, StartCompanyValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidStartCompany(state)) {
            throw Error('Invalid StartCompany action')
        }

        const deed = state.availableDeeds.find((deed) => deed.id === this.deedId)
        assertExists(deed, `Deed with id ${this.deedId} not found in available deeds`)

        state.availableDeeds = state.availableDeeds.filter((d) => d.id !== this.deedId)

        const baseCompany = {
            id: state.getPrng().randId(),
            deeds: [deed],
            owner: this.playerId
        }

        let newCompany: Company
        if (deed.type === CompanyType.Production) {
            newCompany = {
                ...baseCompany,
                type: deed.type,
                good: deed.good
            } satisfies ProductionCompany
        } else {
            newCompany = {
                ...baseCompany,
                type: deed.type
            } satisfies ShippingCompany
        }

        state.companies.push(newCompany)
        const playerState = state.getPlayerState(this.playerId)
        playerState.ownedCompanies.push(newCompany.id)

        if (isProductionCompany(newCompany)) {
            const cultivatedArea: CultivatedArea = {
                id: this.areaId,
                type: AreaType.Cultivated,
                companyId: newCompany.id,
                good: newCompany.good
            }
            state.board.areas[cultivatedArea.id] = cultivatedArea
        } else {
            const seaArea = state.board.getArea(this.areaId)
            assert(isSeaArea(seaArea), `Area with id ${this.areaId} is not a sea area`)
            seaArea.ships.push(newCompany.id)
            state.board.areas[seaArea.id] = seaArea
        }

        this.metadata = {
            company: newCompany
        }
    }

    isValidStartCompany(state: HydratedIndonesiaGameState): boolean {
        if (!HydratedStartCompany.canStartCompany(state, this.playerId)) {
            return false
        }

        const deed = state.availableDeeds.find((deed) => deed.id === this.deedId)
        if (!deed) {
            return false
        }

        const area = state.board.getArea(this.areaId)
        if (!state.board.isInRegion(area, deed.region)) {
            return false
        }

        if (deed.type === CompanyType.Production) {
            return isEmptyLandArea(area) && !state.board.hasCultivatedNeighbors(area)
        } else {
            const validSeaAreas = state.board.seaAreasForRegion(deed.region)
            return isSeaArea(area) && validSeaAreas.some((seaArea) => seaArea.id === area.id)
        }
    }

    static canStartCompany(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (playerState.ownedCompanies.length >= playerState.research.slots) {
            return false
        }

        if (state.availableDeeds.length === 0) {
            return false
        }

        return true
    }
}
