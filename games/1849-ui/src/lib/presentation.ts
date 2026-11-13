import {
    GaribaldiId,
    ETokenId,
    InsolvencyChoices1849,
    LoanAmount1849,
    LoanDeduction1849,
    MarketPoolId1849,
    PortBonus1849,
    StationTokenCount1849,
    TitleRules1849,
    TokenFees1849,
    type State1849
} from '@tabletop/1849'
import { holdsAccessRight } from '@tabletop/18xx'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1849 } from './companyPresentation.js'
import { ElectricPhaseChart1849, PhaseChart1849 } from './phaseChart.js'
import { PhaseColors1849, TrainColors1849 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1849.currencySymbol)

/** The one fee a corporation pays for all its station tokens as it starts (§9.4). */
export function tokenFeeWords(fee: number): string {
    return `${money(fee)} for its ${StationTokenCount1849} station tokens`
}

export const Presentation1849: TitlePresentation<State1849> = {
    money,
    phaseChart: PhaseChart1849,
    phaseChartFor: (state) =>
        state.variants.electricDreams ? ElectricPhaseChart1849 : PhaseChart1849,
    trainColors: TrainColors1849,
    phaseColors: PhaseColors1849,
    marketPoolId: MarketPoolId1849,
    poolName: (poolId) => (poolId === MarketPoolId1849 ? 'Bank pool' : 'Treasury'),
    companyNames: CompanyNames1849,
    // A corporation buys all its station tokens as it starts and places them free (§9.4, §10.4).
    hideStationCosts: true,
    // The Garibaldi's fee comes with the home it chooses, shown beside it (§9.4.1).
    startNotes: (_state, companyId) => {
        const fee = TokenFees1849[companyId]
        return fee === undefined || companyId === GaribaldiId
            ? []
            : [`${tokenFeeWords(fee)}, from its treasury`]
    },
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {
        SMS: 'Lay or upgrade a tile in a coastal city, then place a station there'
    },
    corporateFinance: {
        issue: 'Issue',
        issueNote:
            'Issue treasury certificates to the bank pool, the price dropping a row for each share, or redeem one.'
    },
    // The Bonds variant's bond, the family's corporate loan (§14.2).
    loanTerms: {
        name: 'Bond',
        take: 'Issue the bond',
        repay: 'Repay the bond',
        interestDefault: 'The president raised what the treasury could not.',
        fixedTerms: true
    },
    // The two-share last certificate, marked wherever it is held (§9.6).
    multiShareCertificate: {
        label: 'L',
        name: 'Last certificate',
        description: 'two shares, bought, sold or issued only once no single share is left with it'
    },
    // A corporation that cannot buy its train closes; its president may then be left with
    // nothing (§10.7).
    insolvency: {
        explanation:
            'The corporation cannot buy a train and closes. Its president has no shares left.',
        debtExplanation:
            'Its president cannot raise the rest of the bond money and has no shares left. A corporation still running closes.',
        choices: {
            [InsolvencyChoices1849.loan]: {
                label: `Take a ${money(LoanAmount1849)} loan`,
                description: `Play on with ${money(LoanAmount1849)}; ${money(LoanDeduction1849)} comes off your final total.`
            },
            [InsolvencyChoices1849.leave]: {
                label: 'Leave the game',
                description: 'Finish with nothing.'
            }
        }
    },
    // The +L. 20 port token and the company it pays (§7.1).
    companyMarks: (state, companyId) => [
        ...(state.portBonus?.companyId === companyId
            ? [
                  {
                      label: `+${money(PortBonus1849)}`,
                      description: `Its routes to the port with the token earn ${money(PortBonus1849)} more.`
                  }
              ]
            : []),
        // The Electric Dreams variant's E token (§14.3).
        ...(holdsAccessRight(state, companyId, ETokenId)
            ? [{ label: 'E token', description: 'E token: it may buy E trains.' }]
            : [])
    ],
    gameFacts: (state) =>
        state.loans.length
            ? [
                  {
                      label: 'Loans',
                      value: String(state.loans.reduce((total, entry) => total + entry.count, 0))
                  }
              ]
            : [],
    marketZones: [
        {
            color: 'yellow',
            name: 'Start',
            description: 'L. 68 and L. 100: corporations start here from phase 4.'
        },
        { color: 'green', name: 'L. 144', description: 'A start value from phase 6.' },
        { color: 'brown', name: 'L. 216', description: 'A start value from phase 10.' },
        {
            color: 'blue',
            name: 'Phase 16 only',
            description:
                'Share prices cannot enter until phase 16; until then its edge is the market’s.'
        },
        {
            color: 'orange',
            name: 'Game end',
            description: 'The game ends once a corporation reaching L. 377 has operated.'
        },
        { color: 'black', name: 'Closed', description: 'A corporation entering it closes.' }
    ]
}
