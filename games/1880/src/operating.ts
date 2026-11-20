import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    certificateWealthItem,
    controllingOwner,
    dividendEntitlements,
    finiteCashOwnedBy,
    getCompany,
    marketShareValue,
    playerLoan,
    presidentTrainFundingRules,
    sameOwner,
    takePlayerLoan,
    type EarningsRules,
    type EndingRules,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type TrainFundingRules,
    type TransferRules
} from '@tabletop/18xx'
import { ForeignInvestors1880, PrivateCatalog1880 } from './companies.js'
import { Names1880 } from './names.js'
import { ownerShareOfTreasury } from './investors.js'
import { ExchangingRocketState, requireState1880 } from './state.js'
import {
    Charters1880,
    MajorIds1880,
    PlayerLoanRules1880,
    StockRules1880,
    allSharesOnSale,
    communist,
    isInvestor,
    saleTerms1880
} from './stock.js'
import { Market1880 } from './stockMarket.js'
import { Phases1880, RestoredTwoId } from './trains.js'

/** Foreign investors still in play, in number order (§VII). */
export function investorsInPlay(state: Parameters<OperatingRules['companyOrder']>[0]): string[] {
    return ForeignInvestors1880.map((investor) => investor.id).filter((id) => {
        const company = getCompany(state, id)
        return company.floated && !company.closed
    })
}

/**
 * The privates pay, then the foreign investors operate, then the floated majors by their par,
 * top to bottom: highest price first, each price's slots in order (§IX).
 */
export function operatingOrder1880(state: Parameters<OperatingRules['companyOrder']>[0]): string[] {
    const titleState = requireState1880(state)
    const majors = MajorIds1880.filter((id) => {
        const company = getCompany(state, id)
        return company.floated && !company.closed
    }).sort((a, b) => {
        const priceA = getCompany(state, a).parPrice ?? 0
        const priceB = getCompany(state, b).parPrice ?? 0
        return priceB - priceA || (titleState.parSlots[a] ?? 0) - (titleState.parSlots[b] ?? 0)
    })
    return [...investorsInPlay(state), ...majors]
}

export const OperatingRules1880: OperatingRules = {
    charters: Charters1880,
    // Operating rounds follow one another with no stock round between them; stock rounds
    // interrupt them when a kind of train runs out (§IX, §XII).
    roundCount: () => 'endless',
    companyOrder: operatingOrder1880
}

/**
 * Dividends go to the players' shares; shares in the bank and on a foreign investor pay nothing,
 * nor does the company receive their part (§X Calculating Income). A foreign investor always
 * withholds (§VII). Prices move right on a payout and left otherwise, never under communism
 * (§XIII, §XIV).
 */
export const EarningsRules1880: EarningsRules = {
    choices: (_state, companyId) => (isInvestor(companyId) ? ['withhold'] : ['pay', 'withhold']),
    // An investor's owner has nothing to decide, so its earnings go to its treasury unasked.
    automaticChoice: (_state, companyId) => (isInvestor(companyId) ? 'withhold' : undefined),
    shareCount: () => 10,
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.owner.kind === 'player' ? certificate.owner : undefined
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) => (choice === 'withhold' ? revenue : 0),
    roundDividend: (_state, _companyId, amount) => amount,
    marketEffect(state, companyId, distribution) {
        if (isInvestor(companyId) || communist(state) || !getCompany(state, companyId).floated)
            return { bonusPerShare: 0 }
        return {
            move: Market1880.dividendMove(
                state.stockMarket,
                companyId,
                distribution.baseDividendPerShare > 0
            ),
            bonusPerShare: 0
        }
    }
}

export const PhaseRules1880: PhaseRules = {
    rustTiming: (state, train) => Phases1880.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) =>
        [...new Set([...(companyId ? [companyId] : []), ...operatingOrder1880(state)])].filter(
            (id) => MajorIds1880.includes(id)
        ),
    // Trains over the limit leave the game, unpaid for (§X).
    discardDestination: 'removed',
    // The first 4-train's phase waits for the Rocket's forced exchange (§VI).
    decisionState: (state) =>
        requireState1880(state).rocketExchanger ? ExchangingRocketState : undefined
}

export const PrivateRules1880: PrivateRules = {
    exchangeTerms: () => undefined,
    // From the first 4-train the privates pay nothing, their powers lasting (§XIV).
    phaseEffects: (state) => PrivateCatalog1880.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1880.definition(id).description ?? ''
}

/** Whether two companies have the same director. */
function sameDirector(
    state: Parameters<TransferRules['canPurchase']>[0],
    a: string,
    b: string
): boolean {
    const first = controllingOwner(state, a)
    const second = controllingOwner(state, b)
    return !!first && !!second && first.playerId === second.playerId
}

/**
 * From the first 3-train a company may buy a train from another of its director's companies, for
 * ¥1 or more from its treasury; never from another director's (§X Purchase of Trains).
 */
export const TransferRules1880: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1880,
    canPurchase(state, companyId, asset) {
        if (asset.kind !== 'train' || !allSharesOnSale(state)) return false
        if (!EighteenXXTransferTiming.canPurchase(state, companyId, asset)) return false
        const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
        return (
            train?.status === 'owned' &&
            train.owner.kind === 'company' &&
            MajorIds1880.includes(train.owner.companyId) &&
            sameDirector(state, companyId, train.owner.companyId)
        )
    },
    priceRange(state, companyId, asset) {
        if (asset.kind !== 'train') return undefined
        return {
            minimum: 1,
            maximum: finiteCashOwnedBy(state, { kind: 'company', companyId })
        }
    },
    afterPurchase: () => {}
}

/**
 * A company that must buy a train and cannot pay for it has its director make up the difference,
 * selling shares if they choose but changing no directorship; what is still short becomes the
 * director's debt (§X Forced Train Purchase). Nobody goes bankrupt.
 */
export const TrainFundingRules1880: TrainFundingRules = {
    ...presidentTrainFundingRules({
        companyOrder: OperatingRules1880.companyOrder,
        saleTerms: saleTerms1880,
        repeatSales: 'separate',
        stockRules: StockRules1880,
        protectsPresidency: () => true
    }),
    includeMarketTrains: false,
    // A forced purchase is the cheapest new train, never a restored 2-train (§X; R46).
    fundablePurchases(_state, _companyId, offers) {
        const trains = offers.filter((offer) => offer.definitionId !== RestoredTwoId)
        const price = Math.min(...trains.map((offer) => offer.price))
        return trains.filter((offer) => offer.price === price)
    },
    salesOptional: true,
    recordLoan(state, owner, amount) {
        if (owner.kind === 'player')
            takePlayerLoan(requireState1880(state), PlayerLoanRules1880, owner.playerId, amount)
    }
}

export const LastEightReason = 'The last 8-train has left the bank'

/**
 * Shares count at their current value; privates and company assets count for nothing; a foreign
 * investor still unmerged pays its owner a fifth of its treasury; debts are subtracted (§VII,
 * §XV).
 */
export const EndingRules1880: EndingRules = {
    // After the last 8-train, every company operates three more times, the train-marker company
    // last (§XV).
    trigger(stateObject) {
        const state = requireState1880(stateObject)
        if (state.lastEightRound === undefined) return undefined
        const set = state.operatingSet
        assertExists(set, 'The last 8-train leaves in an operating round')
        assertExists(state.trainMarker, 'The last 8-train leaves the train marker in place')
        return {
            reason: LastEightReason,
            finalOperatingSet: set.number,
            finalOperatingRound: state.lastEightRound + 3,
            finalCompanyId: state.trainMarker
        }
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (certificate.kind === 'private')
            return [certificateWealthItem(Names1880, certificate, 0)]
        if (isInvestor(company.id))
            return [
                certificateWealthItem(
                    Names1880,
                    certificate,
                    company.closed
                        ? 0
                        : ownerShareOfTreasury(
                              finiteCashOwnedBy(state, { kind: 'company', companyId: company.id })
                          )
                )
            ]
        return [
            certificateWealthItem(
                Names1880,
                certificate,
                company.closed || sameOwner(certificate.owner, { kind: 'bank' })
                    ? 0
                    : marketShareValue(Market1880, state, certificate)
            )
        ]
    },
    playerItems(state, playerId) {
        const debt = playerLoan(requireState1880(state), playerId)
        return debt ? [{ assetId: `debt:${playerId}`, label: 'Debt', value: -debt }] : []
    }
}
