import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EconomicTile } from '../components/economicTiles.js'
import { TechField } from '../components/techFields.js'
import { ActionType } from '../definition/actions.js'
import { produceAtEarth } from '../model/campaign.js'
import { drawEconomicTile } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type EarthProductionRecord = Type.Static<typeof EarthProductionRecord>
export const EarthProductionRecord = Type.Object({
    playerId: Type.String(),
    cash: Type.Number(),
    markers: Type.Object({
        [TechField.Biology]: Type.Array(Type.Number()),
        [TechField.Physics]: Type.Array(Type.Number()),
        [TechField.Engineering]: Type.Array(Type.Number())
    }),
    emptyPoolCash: Type.Number()
})

export type DrawEconomicTileMetadata = Type.Static<typeof DrawEconomicTileMetadata>
export const DrawEconomicTileMetadata = Type.Object({
    tile: Type.Enum(EconomicTile),
    earthProduction: Type.Array(EarthProductionRecord)
})

export type DrawEconomicTile = Type.Static<typeof DrawEconomicTile>
export const DrawEconomicTile = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DrawEconomicTile),
            metadata: Type.Optional(DrawEconomicTileMetadata)
        })
    ])
)

export const DrawEconomicTileValidator = Compile(DrawEconomicTile)

export function isDrawEconomicTile(action?: GameAction): action is DrawEconomicTile {
    return action?.type === ActionType.DrawEconomicTile
}

// Earth production happens as the tile is drawn; the other tiles lead into their own steps.
// Events and trade goods arrive with later slices of the campaign and do nothing yet.
export class HydratedDrawEconomicTile
    extends HydratableAction<typeof DrawEconomicTile>
    implements DrawEconomicTile
{
    declare type: ActionType.DrawEconomicTile
    declare metadata?: DrawEconomicTileMetadata

    constructor(data: DrawEconomicTile) {
        super(data, DrawEconomicTileValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const tile = drawEconomicTile(state)
        const earthProduction =
            tile === EconomicTile.EarthProduction
                ? state
                      .initiativeOrder()
                      .map((playerId) => ({ playerId, ...produceAtEarth(state, playerId) }))
                : []
        this.metadata = { tile, earthProduction }
    }
}
