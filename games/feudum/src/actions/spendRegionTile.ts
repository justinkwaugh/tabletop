import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Goods, type Good } from '../data/components.js'
import type { TileId } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { atWillWindow, reasonNoAtWillWindow } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { spendWildTiles } from '../model/payments.js'
import { GoodSchema, TileIdSchema } from '../model/stateSchemas.js'
import { putSulfurInBarrel, reasonSulfurToBarrelRefused } from '../model/supply.js'

export type SpendRegionTile = Type.Static<typeof SpendRegionTile>
export const SpendRegionTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SpendRegionTile),
            playerId: Type.String(),
            tileId: TileIdSchema,
            good: GoodSchema,
            /** R-4.10.2, R-4.10-H1 A sulfur gained may go straight into the barrel. */
            sulfurToBarrel: Type.Optional(Type.Literal(true))
        })
    ])
)

export const SpendRegionTileValidator = Compile(SpendRegionTile)

export function isSpendRegionTile(action?: GameAction): action is SpendRegionTile {
    return action?.type === ActionType.SpendRegionTile
}

export interface SpendRegionTileInput {
    readonly tileId: TileId
    readonly good: Good
    readonly sulfurToBarrel?: true
}

/** R-4.3.3 A tile the seat may spend, and what for. */
export interface SpendRegionTileOffer {
    readonly tileId: TileId
    /** R-4.3-H2 */
    readonly goods: readonly Good[]
    /** R-4.10.2 Whether a sulfur could go straight into the barrel. */
    readonly sulfurToBarrel: boolean
}

/** R-4.3.3 Each collected tile, in an at-will window, while the haversack holds a good. Read-only. */
export function spendRegionTileOffers(
    state: HydratedFeudumGameState,
    playerId: string
): SpendRegionTileOffer[] {
    const goods = Goods.filter((good) => state.supply.haversack[good] > 0)
    if (!atWillWindow(state, playerId) || goods.length === 0) {
        return []
    }
    const sulfurToBarrel =
        goods.includes('sulfur') && !reasonSulfurToBarrelRefused(state, playerId, 'sulfur')
    return state
        .getPlayerState(playerId)
        .regionTiles.map((tileId) => ({ tileId, goods, sulfurToBarrel }))
}

export class HydratedSpendRegionTile
    extends HydratableAction<typeof SpendRegionTile>
    implements SpendRegionTile
{
    declare type: ActionType.SpendRegionTile
    declare playerId: string
    declare tileId: TileId
    declare good: Good
    declare sulfurToBarrel?: true

    constructor(data: SpendRegionTile) {
        super(data, SpendRegionTileValidator)
    }

    /** R-4.3.3 The tile leaves the game. Its landscape was public from collection (R-1.4-H2). */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = HydratedSpendRegionTile.reasonRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        spendWildTiles(state, this.playerId, [{ tileId: this.tileId, good: this.good }])
        if (this.sulfurToBarrel) {
            putSulfurInBarrel(state, this.playerId)
        }
    }

    /** R-4.3.3, R-4.3-H2, R-4.4-H1 In an at-will window, a held tile and a good the haversack holds. */
    private static reasonRefused(
        state: HydratedFeudumGameState,
        playerId: string,
        { tileId, good, sulfurToBarrel }: SpendRegionTileInput
    ): string | undefined {
        const closed = reasonNoAtWillWindow(state, playerId)
        if (closed) {
            return closed
        }
        if (!state.getPlayerState(playerId).regionTiles.includes(tileId)) {
            return "You don't hold that tile."
        }
        if (state.supply.haversack[good] === 0) {
            return `The haversack holds no ${good}.`
        }
        return sulfurToBarrel ? reasonSulfurToBarrelRefused(state, playerId, good) : undefined
    }
}
