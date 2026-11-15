import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import { PALACE_COLORS, PalaceColor } from '../components/pieces.js'
import { MachineState } from '../definition/states.js'

const stockPolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('hiddenPieces', false, { defaultValue: false }),
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

export type BuildingStock = Type.Static<typeof BuildingStock>
export const BuildingStock = Type.Object({
    [PalaceColor.Grey]: Type.Number(),
    [PalaceColor.Purple]: Type.Number(),
    [PalaceColor.Brown]: Type.Number(),
    [PalaceColor.Orange]: Type.Number()
})

export type MedinaPlayerState = Type.Static<typeof MedinaPlayerState>
export const MedinaPlayerState = Type.Object({
    ...PlayerState.properties,
    buildings: Visibility.protect(BuildingStock, { policy: stockPolicy }),
    rooftops: Type.Number(),
    neutralRooftops: Type.Number(),
    stables: Visibility.protect(Type.Number(), { policy: stockPolicy }),
    merchants: Visibility.protect(Type.Number(), { policy: stockPolicy }),
    walls: Visibility.protect(Type.Number(), { policy: stockPolicy }),
    teaTiles: Type.Number(),
    tookTeaBreak: Type.Boolean()
})

export const MedinaProjectedPlayerState = Visibility.createProjectionSchema(MedinaPlayerState)
export type MedinaProjectedPlayerState = Type.Static<typeof MedinaProjectedPlayerState>
const MedinaProjectedPlayerStateValidator = Compile(MedinaProjectedPlayerState)

export class HydratedMedinaPlayerState
    extends Hydratable<typeof MedinaProjectedPlayerState>
    implements MedinaProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare buildings?: BuildingStock
    declare rooftops: number
    declare neutralRooftops: number
    declare stables?: number
    declare merchants?: number
    declare walls?: number
    declare teaTiles: number
    declare tookTeaBreak: boolean

    constructor(data: MedinaProjectedPlayerState) {
        super(data, MedinaProjectedPlayerStateValidator)
    }

    buildingStock(): BuildingStock {
        assertExists(this.buildings, 'Building stock is unavailable in this representation')
        return this.buildings
    }

    stablesLeft(): number {
        assertExists(this.stables, 'Stable stock is unavailable in this representation')
        return this.stables
    }

    merchantsLeft(): number {
        assertExists(this.merchants, 'Merchant stock is unavailable in this representation')
        return this.merchants
    }

    wallsLeft(): number {
        assertExists(this.walls, 'Wall stock is unavailable in this representation')
        return this.walls
    }

    componentsLeft(): number {
        const stock = this.buildingStock()
        const buildings = PALACE_COLORS.reduce((sum, color) => sum + stock[color], 0)
        return (
            buildings +
            this.rooftops +
            this.neutralRooftops +
            this.stablesLeft() +
            this.merchantsLeft() +
            this.wallsLeft()
        )
    }
}
