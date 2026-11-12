import { PortBonus1849, TitleRules1849, type State1849 } from '@tabletop/1849'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1849 } from './companyPresentation.js'
import { PhaseChart1849 } from './phaseChart.js'
import { PhaseColors1849, TrainColors1849 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1849.currencySymbol)

export const Presentation1849: TitlePresentation<State1849> = {
    money,
    phaseChart: PhaseChart1849,
    trainColors: TrainColors1849,
    phaseColors: PhaseColors1849,
    marketPoolId: 'open-market',
    poolName: (poolId) => (poolId === 'open-market' ? 'Bank pool' : 'Treasury'),
    companyNames: CompanyNames1849,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {
        SMS: 'Lay or upgrade a tile in a coastal city, then place a station there'
    },
    corporateFinance: {
        issue: 'Sell',
        issueNote:
            'Sell treasury certificates to the bank pool, the price dropping a row for each share, or buy one back.'
    },
    // A corporation that cannot buy its train closes; its president may then be left with
    // nothing (§10.7).
    insolvency: {
        explanation:
            'The corporation cannot buy a train and closes. Its president has no shares left.',
        choices: {
            loan: {
                label: `Take a ${money(500)} loan`,
                description: `Play on with ${money(500)}; ${money(750)} comes off your final total.`
            },
            leave: {
                label: 'Leave the game',
                description: 'Finish with nothing.'
            }
        }
    },
    // The +L. 20 port token and the company it pays (§7.1).
    companyMarks: (state, companyId) =>
        state.portBonus?.companyId === companyId
            ? [
                  {
                      label: `+${money(PortBonus1849)}`,
                      description: `Its routes to the port with the token earn ${money(PortBonus1849)} more.`
                  }
              ]
            : [],
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
