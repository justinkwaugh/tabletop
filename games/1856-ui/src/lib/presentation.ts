import {
    BridgeRightId,
    CgrId,
    Homes1856,
    InterestRate1856,
    IpoPoolId1856,
    LocationNames1856,
    MarketPoolId1856,
    TitleRules1856,
    TunnelRightId,
    companyFunding,
    destination1856,
    portToken,
    requireState1856,
    sharesStillToOperate,
    type State1856
} from '@tabletop/1856'
import { companyLoans, getCompany, holdsAccessRight } from '@tabletop/18xx'
import {
    moneyFormat,
    type CompanyMark,
    type TitleFact,
    type TitlePresentation,
    type UnstartedCompanies
} from '@tabletop/18xx-ui'
import { CompanyNames1856 } from './companyPresentation.js'
import { PhaseChart1856, phaseChart1856 } from './phaseChart.js'
import { PhaseColors1856, TrainColors1856 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1856.currencySymbol)

const Capitalizations = { escrow: 'Escrow', incremental: 'Incremental', full: 'Full' } as const

function placeNames(locationIds: readonly string[]): string {
    return [...new Set(locationIds.map((id) => LocationNames1856[id] ?? id))].join(' / ')
}

/**
 * A company's capitalization, the escrow the bank holds for it and the destination that releases
 * it, the shares it still needs to operate, and the interest its loans cost (Public Company
 * Starting Treasury, Pay Interest).
 */
function companyFacts1856(stateObject: State1856, companyId: string): TitleFact[] {
    const state = requireState1856(stateObject)
    if (companyId === CgrId) return []
    const company = getCompany(state, companyId)
    const funding = companyFunding(state, companyId)
    const facts: TitleFact[] = []
    const reached = state.destinationsReached.includes(companyId)
    if (funding) {
        const held = funding.escrow ? `, ${money(funding.escrow)} held` : ''
        const released = funding.capitalization === 'escrow' && reached ? ', released' : ''
        facts.push({
            label: 'Capital',
            value: `${Capitalizations[funding.capitalization]}${held}${released}`,
            below: true
        })
    }
    if ((funding?.capitalization === 'escrow' || !company.started) && !reached) {
        const destination = destination1856(state, companyId)
        const from = destination.from ? `${placeNames([destination.from])} to ` : ''
        facts.push({
            label: 'Destination',
            value: `${from}${placeNames(destination.locationIds)}`,
            below: true
        })
    }
    if (company.started && !company.floated && !company.closed) {
        const needed = sharesStillToOperate(state, companyId)
        if (needed)
            facts.push({
                label: 'To operate',
                value: `${needed} more share${needed === 1 ? '' : 's'} sold`,
                below: true
            })
    }
    const loans = companyLoans(state, companyId)
    if (loans)
        facts.push({
            label: 'Interest',
            value: `${money(loans * InterestRate1856)} a round`,
            below: true
        })
    return facts
}

/** The bridge and tunnel rights, and the port token, a company holds. */
function companyMarks1856(stateObject: State1856, companyId: string): CompanyMark[] {
    const state = requireState1856(stateObject)
    const port = portToken(state)
    return [
        ...(holdsAccessRight(state, companyId, BridgeRightId)
            ? [{ label: 'Bridge', description: '$10 more for each train running to Buffalo.' }]
            : []),
        ...(holdsAccessRight(state, companyId, TunnelRightId)
            ? [{ label: 'Tunnel', description: '$10 more for each train running to Sarnia.' }]
            : []),
        ...(port?.companyId === companyId
            ? [
                  {
                      label: 'Port',
                      description: `${LocationNames1856[port.locationId] ?? port.locationId} pays this company $20 more.`
                  }
              ]
            : [])
    ]
}

/** Every company but the CGR may be started, at its printed home (Starting a Company). */
const Unstarted1856: UnstartedCompanies<State1856> = {
    onOffer: (_state, companyId) => companyId !== CgrId,
    home: (_state, companyId) => {
        const home = Homes1856[companyId]
        return { locationIds: home ? [home] : [] }
    }
}

export const Presentation1856: TitlePresentation<State1856> = {
    money,
    phaseChart: PhaseChart1856,
    phaseChartFor: phaseChart1856,
    trainColors: TrainColors1856,
    phaseColors: PhaseColors1856,
    marketPoolId: MarketPoolId1856,
    ipoPoolId: IpoPoolId1856,
    poolName: (poolId) => (poolId === MarketPoolId1856 ? 'Open market' : 'Initial offering'),
    companyNames: CompanyNames1856,
    companyFacts: companyFacts1856,
    companyMarks: companyMarks1856,
    unstartedCompanies: Unstarted1856,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {
        WSRC: 'Lay #59 in Kitchener',
        TCC: 'Lay a tile in the Canada Company’s hex'
    },
    // $100 government loans, one a round, $10 interest a round, until the 6s (Government Loans).
    loanTerms: {
        name: 'Loans',
        take: 'Take a loan',
        repay: 'Redeem a loan',
        interestDefault:
            'Its treasury could not pay all its interest: the rest came off its run, then from its president.',
        fixedTerms: true
    },
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A company’s starting price: $65 to $100.' },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares here do not count toward the certificate limit.'
        },
        {
            color: 'brown',
            name: 'Brown',
            description:
                'Shares here do not count toward the certificate limit, and a player may hold more than 60%.'
        },
        {
            color: 'black',
            name: 'Closed',
            description: 'A company reaching it closes at once; the CGR stops a space short.'
        }
    ]
}
