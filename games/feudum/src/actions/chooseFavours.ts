import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import { Goods } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { finishFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { cardTurnSeat } from '../model/turns.js'
import {
    ComponentCount,
    GoodCounts,
    goodCounts,
    SpaceIdSchema,
    SulfurToBarrelCount
} from '../model/stateSchemas.js'
import { barrelRoom, putSulfurInBarrel, reasonSulfurCountToBarrelRefused } from '../model/supply.js'
import { settleHarvest } from './harvest.js'
import { plural } from '../model/words.js'
import { goodsTotal } from '../model/collections.js'

export type ChooseFavoursMetadata = Type.Static<typeof ChooseFavoursMetadata>
export const ChooseFavoursMetadata = Type.Object({
    spaceId: SpaceIdSchema,
    /** R-3.11.3 Everything the harvest drew, by kind. */
    drawn: GoodCounts,
    /** R-3.11.3 To the seat; all zero when none were taken. The input names any for the barrel. */
    favours: GoodCounts,
    /** R-3.11.2 */
    beadsFlipped: ComponentCount
})

export type ChooseFavours = Type.Static<typeof ChooseFavours>
export const ChooseFavours = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseFavours),
            playerId: Type.String(),
            /** R-3.11.3 The chart's count from the drawn goods; null takes none. */
            favours: Type.Union([GoodCounts, Type.Null()]),
            /** R-4.10.2 Of the sulfur taken, how many go in the barrel. */
            sulfurToBarrel: Type.Optional(SulfurToBarrelCount),
            metadata: Type.Optional(ChooseFavoursMetadata)
        })
    ])
)

export const ChooseFavoursValidator = Compile(ChooseFavours)

export function isChooseFavours(action?: GameAction): action is ChooseFavours {
    return action?.type === ActionType.ChooseFavours
}

/** R-3.11.3 The harvest waiting on this seat, if any: the turn seat's. */
function harvestOf(state: HydratedFeudumGameState, playerId: string) {
    return cardTurnSeat(state) === playerId ? state.flow.harvest : undefined
}

/** R-3.11.3, R-4.10.2 The harvester takes the chart's count from what was drawn, or none. */
export function reasonChooseFavoursRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    favours: Readonly<GoodCounts> | null,
    sulfurToBarrel?: number
): string | undefined {
    const harvest = harvestOf(state, playerId)
    if (!harvest) {
        return "You aren't choosing favours."
    }
    if (favours === null) {
        return reasonSulfurCountToBarrelRefused(state, playerId, 0, sulfurToBarrel)
    }
    const count = goodsTotal(favours)
    if (count !== harvest.favours) {
        return `Take ${plural(harvest.favours, 'good')} as favours, or none.`
    }
    if (Goods.some((good) => favours[good] > harvest.drawn[good])) {
        return "You can't take goods the harvest didn't draw."
    }
    return reasonSulfurCountToBarrelRefused(state, playerId, favours.sulfur, sulfurToBarrel)
}

export interface ChooseFavoursOffer {
    readonly spaceId: SpaceId
    readonly drawn: Readonly<GoodCounts>
    /** R-3.11.2 */
    readonly favours: number
    /** R-3.11.2 */
    readonly beads: number
    /** R-4.10.2 How many sulfur taken could go in the barrel. */
    readonly sulfurToBarrel: number
}

/** R-3.11.3 The goods in the open and the count, for the harvester alone. */
export function chooseFavoursOffer(
    state: HydratedFeudumGameState,
    playerId: string
): ChooseFavoursOffer | undefined {
    const harvest = harvestOf(state, playerId)
    return harvest
        ? {
              spaceId: harvest.spaceId,
              drawn: harvest.drawn,
              favours: harvest.favours,
              beads: state.getPlayerState(playerId).beads.length,
              sulfurToBarrel: Math.min(
                  harvest.drawn.sulfur,
                  harvest.favours,
                  barrelRoom(state, playerId)
              )
          }
        : undefined
}

export class HydratedChooseFavours
    extends HydratableAction<typeof ChooseFavours>
    implements ChooseFavours
{
    declare type: ActionType.ChooseFavours
    declare playerId: string
    declare favours: GoodCounts | null
    declare sulfurToBarrel?: number
    declare metadata?: ChooseFavoursMetadata

    constructor(data: ChooseFavours) {
        super(data, ChooseFavoursValidator)
    }

    /** R-3.11.2, R-3.11.3 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonChooseFavoursRefused(
            state,
            this.playerId,
            this.favours,
            this.sulfurToBarrel
        )
        if (reason) {
            throw Error(reason)
        }
        const { harvest } = state.flow
        assertExists(harvest, 'R-3.11.3 A harvest is waiting')

        const beadsFlipped = settleHarvest(
            state,
            this.playerId,
            harvest.spaceId,
            harvest.drawn,
            this.favours ?? undefined
        )
        if (this.sulfurToBarrel) {
            putSulfurInBarrel(state, this.playerId, this.sulfurToBarrel)
        }
        this.metadata = {
            spaceId: harvest.spaceId,
            drawn: { ...harvest.drawn },
            favours: this.favours ?? goodCounts(),
            beadsFlipped
        }
        state.flow.harvest = undefined
        finishFollowUp(state)
    }
}
