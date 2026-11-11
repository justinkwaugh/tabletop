import { controllingOwner, finiteCashOwnedBy, type EighteenXXStateHandler } from '@tabletop/18xx'
import { ActionSource, assert, type HydratedAction, type MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { NonCharteredStationCost, buyStations } from './companyRules.js'
import { BuyingStationsState, type HydratedState1862 } from './state.js'
import { titleAction } from './titleAction.js'

export const MinimumStations = 2

export function maximumStations(state: HydratedState1862): number {
    return state.variants.eightStations ? 8 : 7
}

/** The station counts the floated company's director may choose and the company can pay for. */
export function stationCounts(state: HydratedState1862, companyId: string): number[] {
    const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const counts: number[] = []
    for (let count = MinimumStations; count <= maximumStations(state); count++)
        if (count * NonCharteredStationCost <= cash) counts.push(count)
    return counts
}

function director(state: HydratedState1862): string | undefined {
    const companyId = state.stationPurchase
    return companyId ? controllingOwner(state, companyId)?.playerId : undefined
}

const BuyStationsAction = titleAction('BuyStations', {
    companyId: Type.String({ minLength: 1 }),
    count: Type.Integer({ minimum: MinimumStations, maximum: 8 })
})
export const BuyStations = BuyStationsAction.schema
export const isBuyStations = BuyStationsAction.is

/** A floated non-chartered company's director chooses how many stations it buys (§6.5.4.2). */
export class HydratedBuyStations extends BuyStationsAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof BuyStations>['companyId']
    declare count: Type.Static<typeof BuyStations>['count']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            state.stationPurchase === this.companyId &&
            director(state) === this.playerId &&
            stationCounts(state, this.companyId).includes(this.count)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The director buys stations the company can pay for')
        buyStations(state, this.companyId, this.count, NonCharteredStationCost)
        delete state.stationPurchase
    }
}
export const BuyStationsDefinition = BuyStationsAction.define(
    (action) => new HydratedBuyStations(action)
)

type Context = MachineContext<HydratedState1862>

/** Waits on the director of a company that has just floated, then returns to `resume`. */
export class BuyingStationsHandler implements EighteenXXStateHandler<HydratedState1862> {
    constructor(private readonly resume: (state: HydratedState1862) => string) {}
    isValidAction(action: HydratedAction, context: Context): boolean {
        return action instanceof HydratedBuyStations && action.isValid(context.gameState)
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        return director(context.gameState) === playerId ? [BuyStationsAction.type] : []
    }
    enter(context: Context): void {
        const playerId = director(context.gameState)
        assert(playerId, 'A floated company has a director to buy its stations')
        context.gameState.activePlayerIds = [playerId]
    }
    onAction(_action: HydratedAction, context: Context): string {
        return this.resume(context.gameState)
    }
}

/** Sends play to the director's station purchase whenever a company has just floated. */
export function buysStations(
    handler: EighteenXXStateHandler<HydratedState1862>
): EighteenXXStateHandler<HydratedState1862> {
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            return context.gameState.stationPurchase ? BuyingStationsState : next
        }
    }
}
