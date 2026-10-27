import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MAX_PLANTS } from '../components/rules.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { MarketChange, emptyMarketChange, mergeRefill } from './marketChange.js'

export type TrustTakesPlantMetadata = Type.Static<typeof TrustTakesPlantMetadata>
export const TrustTakesPlantMetadata = Type.Object({
    taken: Type.Optional(Type.Integer()),
    scrapped: Type.Optional(Type.Integer()),
    market: MarketChange
})

export type TrustTakesPlant = Type.Static<typeof TrustTakesPlant>
export const TrustTakesPlant = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.TrustTakesPlant),
            metadata: Type.Optional(TrustTakesPlantMetadata)
        })
    ])
)

export const TrustTakesPlantValidator = Compile(TrustTakesPlant)

export function isTrustTakesPlant(action?: GameAction): action is TrustTakesPlant {
    return action?.type === ActionType.TrustTakesPlant
}

/**
 * Recharged p. 9: once a round, after the first purchase or the first player's opting out, the
 * Trust takes the biggest plant in the current market. With three plants it takes one only if it
 * beats its smallest, which it then scraps.
 */
export class HydratedTrustTakesPlant
    extends HydratableAction<typeof TrustTakesPlant>
    implements TrustTakesPlant
{
    declare type: ActionType.TrustTakesPlant
    declare metadata?: TrustTakesPlantMetadata

    constructor(data: TrustTakesPlant) {
        super(data, TrustTakesPlantValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const trust = state.trust
        assertExists(trust, 'The Trust is not in this game')
        trust.tookPlant = true
        const biggest = state.auctionablePlants().at(-1)
        const smallest = Math.min(...trust.plants)
        if (biggest === undefined || (trust.plants.length >= MAX_PLANTS && biggest <= smallest)) {
            this.metadata = { market: emptyMarketChange() }
            return
        }
        state.takeFromMarket(biggest)
        trust.plants = [...trust.plants, biggest].toSorted((a, b) => a - b)
        const scrapped = trust.plants.length > MAX_PLANTS ? trust.plants.shift() : undefined
        if (scrapped !== undefined) {
            state.retirePlant(scrapped)
        }
        const market = mergeRefill(emptyMarketChange(), state.refillMarket())
        this.metadata = { taken: biggest, scrapped, market }
        this.revealsInfo = market.drawn.length > 0
    }
}
