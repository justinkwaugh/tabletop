import {
    LoanRules1861,
    Market1861,
    companyOnOffer1861,
    minor1861,
    MarketPoolId1861,
    MarketZoneColors1861,
    MinorCapColumn,
    TitleRules1861,
    isEndMergerRound,
    isStartMergerRound,
    type State1861
} from '@tabletop/1861'
import { companyLoans, loanInterest } from '@tabletop/18xx'
import {
    moneyFormat,
    type TitleFact,
    type TitlePresentation,
    type UnstartedCompanies
} from '@tabletop/18xx-ui'
import { CompanyNames1861 } from './companyPresentation.js'
import { PhaseChart1861 } from './phaseChart.js'
import { PhaseColors1861, TrainColors1861 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1861.currencySymbol)

// The seventh column, past which a minor never moves right and from which it converts (§10.7, §12.2).
const MinorColumnEdges = Market1861.spaces
    .filter((space) => space.column === MinorCapColumn)
    .map((space) => ({ spaceId: space.id, side: 'right' as const }))

/** The interest a company's loans cost each operating round, where it has any (§10.8). */
function companyFacts1861(state: State1861, companyId: string): TitleFact[] {
    const loans = companyLoans(state, companyId)
    return loans
        ? [
              {
                  label: 'Interest',
                  value: `${money(loans * loanInterest(state, LoanRules1861))} a round`,
                  below: true
              }
          ]
        : []
}

/** Minors have a fixed home; a public company's director chooses one as it starts (§7.2, §9.3). */
const Unstarted1861: UnstartedCompanies<State1861> = {
    onOffer: companyOnOffer1861,
    home: (_state, companyId) => {
        const minor = minor1861(companyId)
        return minor ? { locationIds: [minor.home.locationId] } : 'chosen'
    }
}

export const Presentation1861: TitlePresentation<State1861> = {
    money,
    phaseChart: PhaseChart1861,
    trainColors: TrainColors1861,
    phaseColors: PhaseColors1861,
    companyFacts: companyFacts1861,
    unstartedCompanies: Unstarted1861,
    marketPoolId: MarketPoolId1861,
    poolName: (poolId) => (poolId === MarketPoolId1861 ? 'Bank pool' : 'Treasury'),
    companyNames: CompanyNames1861,
    privatePurchaseHeading: 'Available privates',
    // R50 loans, R5 interest when taken and each round after, repaid whenever R50 is in hand (§10.2).
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
            color: MarketZoneColors1861.minorStart,
            name: 'Minor start',
            description: 'A minor’s start price: half its winning bid, rounded down.'
        },
        {
            color: MarketZoneColors1861.start,
            name: 'Start',
            description:
                'A minor’s start price, or a public company’s, when it is started, converted or merged.'
        },
        {
            color: MarketZoneColors1861.majorStart,
            name: 'Public start',
            description: 'A public company’s start price only.',
            fill: { kind: 'solid', color: '#cdb6dc' }
        },
        {
            color: MarketZoneColors1861.convert,
            name: 'Convert',
            description: 'A minor here may convert to a public company in a merger round.'
        }
    ],
    marketLedge: {
        name: 'Minor limit',
        description:
            'Minors move no further right than the seventh column, rising up it instead; from R100 to R165 there they may convert.',
        edges: MinorColumnEdges
    }
}
