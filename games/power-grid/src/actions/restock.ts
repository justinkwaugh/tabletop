import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Step } from '../components/rules.js'
import { ResourceAmounts, addResources, noResources } from '../components/resources.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { highestPlant } from '../model/plantMarket.js'
import {
    MarketChange,
    beginDrawnStep3,
    emptyMarketChange,
    mergeRefill,
    withRemoved
} from './marketChange.js'

export type RestockMetadata = Type.Static<typeof RestockMetadata>
export const RestockMetadata = Type.Object({
    resupplied: ResourceAmounts,
    placedUnder: Type.Optional(Type.Integer()),
    market: MarketChange,
    step2Began: Type.Boolean(),
    step3Began: Type.Boolean(),
    playerOrder: Type.Array(Type.String())
})

export type Restock = Type.Static<typeof Restock>
export const Restock = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.Restock),
            metadata: Type.Optional(RestockMetadata)
        })
    ])
)

export const RestockValidator = Compile(Restock)

export function isRestock(action?: GameAction): action is Restock {
    return action?.type === ActionType.Restock
}

/**
 * The end of Phase 5 (Recharged p. 6): resupply the resource market, update the plant market,
 * and begin the next round with a fresh player order.
 */
export class HydratedRestock extends HydratableAction<typeof Restock> implements Restock {
    declare type: ActionType.Restock
    declare metadata?: RestockMetadata

    constructor(data: Restock) {
        super(data, RestockValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        if (state.trust) {
            state.trust.resources = noResources()
        }
        const resupplied = state.resupplyAmounts()
        state.resourceMarket = addResources(state.resourceMarket, resupplied)

        // A Step 3 card drawn as Step 2 began replaces this round's market update (rules note R15).
        const updated = state.step3Drawn
            ? { market: emptyMarketChange() }
            : this.updatePlantMarket(state)
        const step3Began = state.step3Drawn
        const { market, step2Began } = step3Began
            ? beginDrawnStep3(state, updated.market)
            : { market: updated.market, step2Began: false }

        state.roundManager.endRound(state.actionCount)
        state.roundManager.startRound(state.actionCount)
        const playerOrder = state.rankPlayers()
        state.turnManager.turnOrder = playerOrder

        this.metadata = {
            resupplied,
            placedUnder: updated.placedUnder,
            market,
            step2Began,
            step3Began,
            playerOrder
        }
        this.revealsInfo = market.drawn.length > 0
    }

    private updatePlantMarket(state: HydratedPowerGridGameState): {
        market: MarketChange
        placedUnder?: number
    } {
        if (state.step === Step.Three) {
            const market = withRemoved(emptyMarketChange(), state.removeLowestPlant())
            return { market: mergeRefill(market, state.refillMarket()) }
        }
        const placedUnder = highestPlant(state.market)
        if (placedUnder !== undefined) {
            state.placeUnderStack(placedUnder)
        }
        return { market: mergeRefill(emptyMarketChange(), state.refillMarket()), placedUnder }
    }
}
