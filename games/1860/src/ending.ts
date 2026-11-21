import {
    bankBrokenRoundEnding,
    certificateWealthItem,
    finiteCashOwnedBy,
    getCompany,
    trainsOwnedBy,
    type EndingRules,
    type EndingState,
    type GameEnding,
    type StockState
} from '@tabletop/18xx'
import { PrivateCatalog1860 } from './companies.js'
import { Names1860 } from './names.js'
import { BankMoney1860 } from './opening.js'
import { requireState1860 } from './state.js'
import { GameEndPrice, Market1860 } from './stockMarket.js'

export const MarketTop = 'A company reached £340'
export const BankBroken = 'The bank ran out of money'
export const Nationalised = 'Nationalisation complete'

/** Whether a company owns a train; a train-less company's shares sell and score at half. */
export function hasTrain(state: StockState, companyId: string): boolean {
    return trainsOwnedBy(requireState1860(state), { kind: 'company', companyId }).length > 0
}

/**
 * What one share fetches, and scores at the end: the market price, halved and rounded down for a
 * company without a train, unless the option values a company that has not operated in full.
 */
export function shareValue(state: StockState, companyId: string): number {
    const price = Market1860.companySpace(state.stockMarket, companyId).price
    if (hasTrain(state, companyId)) return price
    const unoperatedFull =
        requireState1860(state).options.unoperatedFullValue &&
        !getCompany(state, companyId).operated
    return unoperatedFull ? price : Math.floor(price / 2)
}

/** The money in players' hands: the bank's £10,000 less what it still holds. */
export function playerMoney(state: StockState): number {
    return state.players.reduce(
        (sum, { playerId }) => sum + finiteCashOwnedBy(state, { kind: 'player', playerId }),
        0
    )
}

/** Whether the bank has run out of the players' money, its last note gone (MI-2). */
export function bankExhausted(state: StockState): boolean {
    return playerMoney(state) >= BankMoney1860
}

/**
 * A company at £340 ends the game after the current operating round; so does the bank running
 * out, after the next operating round when it runs out in a stock round, but not once British
 * Rail has formed; and the game ends once nationalisation has closed every company (The End of
 * the Game; Railway Nationalisation).
 */
export function endingTrigger1860(state: EndingState): GameEnding | undefined {
    const title = requireState1860(state)
    const set = state.operatingSet
    const atTop = state.stockMarket.stacks.some(
        (stack) => Market1860.space(stack.spaceId).price >= GameEndPrice
    )
    if (atTop && set && !set.completed)
        return {
            reason: MarketTop,
            finalOperatingSet: set.number,
            finalOperatingRound: set.roundNumber
        }
    if (title.nationalisation) {
        const operating = state.companies.some(
            (company) =>
                company.kind === 'major' &&
                company.floated &&
                !title.nationalisation?.closedCompanyIds.includes(company.id)
        )
        return operating ? undefined : { reason: Nationalised }
    }
    if (!bankExhausted(state)) return undefined
    const ending = bankBrokenRoundEnding({ ...state, bank: { ...state.bank, broken: true } })
    return ending && { ...ending, reason: BankBroken }
}

export const EndingRules1860: EndingRules = {
    trigger: endingTrigger1860,
    // Shares at their market price, halved for a train-less company; open privates at face value.
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (certificate.kind === 'private')
            return [
                certificateWealthItem(
                    Names1860,
                    certificate,
                    company.closed ? 0 : PrivateCatalog1860.faceValue(company.id)
                )
            ]
        const value =
            certificate.kind === 'share' && company.started && !company.closed
                ? shareValue(state, company.id) * certificate.shares
                : 0
        return [certificateWealthItem(Names1860, certificate, value)]
    }
}
