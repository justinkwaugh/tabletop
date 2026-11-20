import {
    BankPoolIdRoyalGorge,
    MarketRoyalGorge,
    SulphurSpringsId,
    TitleRulesRoyalGorge,
    debtPrice,
    homeLocationRoyalGorge,
    privateCardContents,
    isMetalCompany,
    metalDividend,
    railroadAvailable,
    requireStateRoyalGorge,
    treatySigned,
    type StateRoyalGorge
} from '@tabletop/18royalgorge'
import { getCompany } from '@tabletop/18xx'
import { counted, moneyFormat, type TitleFact, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNamesRoyalGorge } from './companyPresentation.js'
import { outstandingDebts } from './debts.js'
import { describeRoyalGorgeMapPlacement } from './history.js'
import { PhaseChartRoyalGorge } from './phaseChart.js'
import { PhaseColorsRoyalGorge, TrainColorsRoyalGorge } from './trainPresentation.js'

const money = moneyFormat(TitleRulesRoyalGorge.currencySymbol)
const DebtMarkerId = 'debt-marker'

const pricesOf = (color: string) =>
    MarketRoyalGorge.spaces.filter((space) => space.color === color).map((space) => space.price)
const priceRange = (color: string) => {
    const prices = pricesOf(color)
    return `${money(Math.min(...prices))} to ${money(Math.max(...prices))}`
}

/** What a railroad still owes from the Treaty of Boston, and what that costs it at the end (DB-5, DB-6). */
function debtFacts(state: StateRoyalGorge, companyId: string): TitleFact[] {
    return outstandingDebts(state)
        .filter((debt) => debt.companyId === companyId)
        .map((debt) => ({
            label: 'Debts',
            value: `${debt.owed} at ${money(debtPrice(state))}${debt.penalty ? `, −${counted(debt.penalty, 'space')}` : ''}`,
            below: true
        }))
}

/** What CF&I and VGC will pay as the set ends (ST-8, GO-4). */
function metalFacts(state: StateRoyalGorge, companyId: string): TitleFact[] {
    return isMetalCompany(state, companyId)
        ? [{ label: 'Dividend', value: money(metalDividend(state, companyId)) }]
        : []
}

/** What an open private holds on its card for its owner (Y2, Y3, Y6, G6, B3). */
function openPrivateHoldings(state: StateRoyalGorge, privateId: string): string | undefined {
    return getCompany(state, privateId).closed ? undefined : privateCardContents(state, privateId)
}

export const PresentationRoyalGorge: TitlePresentation<StateRoyalGorge> = {
    money,
    phaseChart: PhaseChartRoyalGorge,
    trainColors: TrainColorsRoyalGorge,
    phaseColors: PhaseColorsRoyalGorge,
    // The deck's events change phase within a colour (Phase Changes).
    historyMarksEveryPhase: true,
    marketPoolId: BankPoolIdRoyalGorge,
    companyNames: CompanyNamesRoyalGorge,
    terms: { marketPool: 'Bank pool' },
    // A railroad starts once its tranche's colour has come (Fig. 1).
    unstartedCompanies: {
        onOffer: (state, companyId) => railroadAvailable(state, companyId),
        home: (_state, companyId) => ({ locationIds: [homeLocationRoyalGorge(companyId)] })
    },
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: { [SulphurSpringsId]: 'Turn Sulphur Springs into a city' },
    privateHoldings: (state, privateId) =>
        openPrivateHoldings(requireStateRoyalGorge(state), privateId),
    companyFacts: (state, companyId) => {
        const title = requireStateRoyalGorge(state)
        return [...metalFacts(title, companyId), ...debtFacts(title, companyId)]
    },
    historyMapPlacement: describeRoyalGorgeMapPlacement,
    // The debt marker: on $60 until the Treaty of Boston, then moving right each operating round
    // while debts are owed (DB-4).
    marketMarkers(state) {
        const title = requireStateRoyalGorge(state)
        const signed = treatySigned(title.phaseId)
        return !signed || outstandingDebts(title).length
            ? [
                  {
                      id: DebtMarkerId,
                      spaceId: title.debtSpaceId,
                      name: signed
                          ? `Debt marker: a debt costs ${money(debtPrice(title))}`
                          : 'Debt marker: it moves each operating round from the Treaty of Boston',
                      label: 'Debt',
                      color: '#b3261e'
                  }
              ]
            : []
    },
    marketCell: { width: 36, height: 96 },
    // The share value track's regions (Fig. 2).
    marketZones: [
        {
            color: 'yellow',
            name: 'Yellow par',
            description: `A railroad’s starting price from the Yellow phase: ${priceRange('yellow')}.`
        },
        {
            color: 'green',
            name: 'Green par',
            description: `A starting price from the Green phase: ${priceRange('green')}.`
        },
        {
            color: 'brown',
            name: 'Brown par',
            description: `A starting price from the Brown phase: ${priceRange('brown')}.`
        },
        {
            color: 'red',
            name: 'Game end',
            description: `A railroad reaching ${money(Math.min(...pricesOf('red')))} ends the game after the current set of operating rounds, or the coming one if reached in a stock round.`
        }
    ]
}
