import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EconomicTile } from '../components/economicTiles.js'
import { ActionType } from '../definition/actions.js'
import { EarthProduction, produceAtEarth } from '../model/campaign.js'
import { drawEconomicTile } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type EarthProductionRecord = Type.Static<typeof EarthProductionRecord>
export const EarthProductionRecord = Type.Object({
    playerId: Type.String(),
    ...EarthProduction.properties
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

// Rulebook 4.3: Earth production happens as its tile is drawn; the other tiles lead into steps
// of their own.
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
