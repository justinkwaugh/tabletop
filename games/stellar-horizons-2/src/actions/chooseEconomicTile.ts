import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EconomicTile } from '../components/economicTiles.js'
import { ActionType } from '../definition/actions.js'
import { economicTileChoices, economicTileChooser, takeEconomicTile } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { DrawEconomicTileMetadata, playEconomicTile } from './drawEconomicTile.js'

// Hive Mind: its owner chooses the turn's economic tile from those left in the cycle, never the
// tile of the turn before.
export type ChooseEconomicTile = Type.Static<typeof ChooseEconomicTile>
export const ChooseEconomicTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseEconomicTile),
            playerId: Type.String(),
            tile: Type.Enum(EconomicTile),
            metadata: Type.Optional(DrawEconomicTileMetadata)
        })
    ])
)

export const ChooseEconomicTileValidator = Compile(ChooseEconomicTile)

export function isChooseEconomicTile(action?: GameAction): action is ChooseEconomicTile {
    return action?.type === ActionType.ChooseEconomicTile
}

export class HydratedChooseEconomicTile
    extends HydratableAction<typeof ChooseEconomicTile>
    implements ChooseEconomicTile
{
    declare type: ActionType.ChooseEconomicTile
    declare playerId: string
    declare tile: EconomicTile
    declare metadata?: DrawEconomicTileMetadata

    constructor(data: ChooseEconomicTile) {
        super(data, ChooseEconomicTileValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            economicTileChooser(state) !== this.playerId ||
            !economicTileChoices(state).includes(this.tile)
        ) {
            throw Error('Invalid ChooseEconomicTile action')
        }
        takeEconomicTile(state, this.tile)
        this.metadata = { tile: this.tile, earthProduction: playEconomicTile(state, this.tile) }
    }
}
