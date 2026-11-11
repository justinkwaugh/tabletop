import { getCompany } from '../finance/finance.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import type { TitleNames } from '../game/titleNames.js'
import { certificateWealthItem, marketShareValue } from './finalWealth.js'
import { bankExhaustionAtSetEnd, type EndingRules, type EndingState } from './gameEnding.js'

/**
 * Bankruptcy ends the game once the sales it left have been settled, a broken bank after the set of
 * operating rounds, and optionally a share price at once between companies. Shares count at market
 * value and privates at face value.
 */
export function marketValueEnding(options: {
    market: StockMarketChart
    names: TitleNames
    privateFaceValue(privateCompanyId: string): number
    bankruptcySettled(state: EndingState): boolean
    finishPrice?: { price: number; active(state: EndingState): boolean; reason: string }
}): EndingRules {
    const { market, names, privateFaceValue, bankruptcySettled, finishPrice } = options
    const reachedFinishPrice = (state: EndingState) =>
        !!finishPrice?.active(state) &&
        ['OperatingSet', 'StartingOperatingSet'].includes(state.machineState) &&
        state.stockMarket.stacks.some(
            (stack) => market.space(stack.spaceId).price >= finishPrice.price
        )
    return {
        trigger(state) {
            if (state.bankruptcy && bankruptcySettled(state)) return { reason: 'Bankruptcy' }
            if (finishPrice && reachedFinishPrice(state)) return { reason: finishPrice.reason }
            return bankExhaustionAtSetEnd(state)
        },
        certificateItems(state, certificate) {
            const company = getCompany(state, certificate.companyId)
            const value = company.closed
                ? 0
                : certificate.kind === 'share'
                  ? marketShareValue(market, state, certificate)
                  : privateFaceValue(company.id)
            return [certificateWealthItem(names, certificate, value)]
        }
    }
}
