import {
    LoanRules1867,
    Market1867,
    MarketPoolId1867,
    MarketZoneColors1867,
    MinorMaximumPrice,
    TitleRules1867,
    companyOnOffer1867,
    type State1867
} from '@tabletop/1867'
import { companyLoans, isEndMergerRound, isStartMergerRound, loanInterest } from '@tabletop/18xx'
import {
    moneyFormat,
    type TitleFact,
    type TitlePresentation,
    type UnstartedCompanies
} from '@tabletop/18xx-ui'
import { CompanyNames1867 } from './companyPresentation.js'
import { PhaseChart1867 } from './phaseChart.js'
import { PhaseColors1867, TrainColors1867 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1867.currencySymbol)

// The thick border right of $165, past which a minor never moves (GTG §4.3).
const MinorEdges = Market1867.spaces
    .filter((space) => space.price === MinorMaximumPrice)
    .map((space) => ({ spaceId: space.id, side: 'right' as const }))

/** The interest a company's loans cost each operating round, where it has any (GTG §8.2). */
function companyFacts1867(state: State1867, companyId: string): TitleFact[] {
    const loans = companyLoans(state, companyId)
    return loans
        ? [
              {
                  label: 'Interest',
                  value: `${money(loans * loanInterest(state, LoanRules1867))} a round`,
                  below: true
              }
          ]
        : []
}

/** A minor's owner chooses its city as it is auctioned, a major's president as it starts (GTG §7.2.1, §7.4). */
const Unstarted1867: UnstartedCompanies<State1867> = {
    onOffer: companyOnOffer1867,
    home: () => 'chosen'
}

export const Presentation1867: TitlePresentation<State1867> = {
    money,
    phaseChart: PhaseChart1867,
    trainColors: TrainColors1867,
    phaseColors: PhaseColors1867,
    companyFacts: companyFacts1867,
    unstartedCompanies: Unstarted1867,
    // Narrow, tall spaces, as other one-row markets draw them.
    marketCell: { width: 36, height: 96 },
    marketPoolId: MarketPoolId1867,
    poolName: (poolId) => (poolId === MarketPoolId1867 ? 'Bank pool' : 'Treasury'),
    companyNames: CompanyNames1867,
    privatePurchaseHeading: 'Available privates',
    // $50 loans, $5 interest when taken and each round after, repaid whenever $50 is in hand (GTG §8.2).
    loanTerms: {
        name: 'Loans',
        take: 'Take a loan',
        repay: 'Repay a loan',
        interestDefault: 'It could not pay its interest and was nationalised.',
        fixedTerms: true
    },
    titleRounds: [
        {
            name: 'Merger round',
            abbreviation: 'MR',
            inProgress: (state) => !!state.mergerRound && !state.mergerRound.completed,
            starts: isStartMergerRound,
            ends: isEndMergerRound
        }
    ],
    marketZones: [
        {
            color: MarketZoneColors1867.minorStart,
            name: 'Minor start',
            description: 'A minor’s start price only: half its winning bid, rounded down.'
        },
        {
            color: MarketZoneColors1867.start,
            name: 'Start',
            description: 'A minor’s start price, or a major’s when it is started in a stock round.'
        },
        {
            color: MarketZoneColors1867.convert,
            name: 'Convert',
            description:
                'A minor here may convert to a major in a merger round. Either kind may also start here up to $135, and only a major from $150.'
        },
        {
            color: MarketZoneColors1867.majorStart,
            name: 'Major start',
            description: 'A major’s start price only, when it is started, converted or merged.',
            fill: { kind: 'solid', color: '#9fd3cd' }
        }
    ],
    marketLedge: {
        name: 'Minor limit',
        description: 'Minors move no further right than $165, staying there for a dividend.',
        edges: MinorEdges
    }
}
