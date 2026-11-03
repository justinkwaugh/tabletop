import { Map1870, SoftLedge1870, company1870, type State1870, TitleRules1870 } from '@tabletop/1870'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1870 } from './companyPresentation.js'
import { mapPlacement1870 } from './history.js'
import { PhaseChart1870, phaseChart1870 } from './phaseChart.js'
import { PhaseColors1870, TrainColors1870 } from './trainPresentation.js'
import CattleToken from './images/tokens/cattle.svg'
import OpenPortToken from './images/tokens/open-port.svg'

export const Presentation1870: TitlePresentation<State1870> = {
    money: moneyFormat(TitleRules1870.currencySymbol),
    phaseChart: PhaseChart1870,
    phaseChartFor: phaseChart1870,
    // With diesels, the first diesel brings in the bottom off-board values (p. 24).
    revenueStageCaptionsFor: (state) => (state.variants.diesels ? { gray: 'D' } : undefined),
    trainColors: TrainColors1870,
    phaseColors: PhaseColors1870,
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: CompanyNames1870,
    // Reissue prices from par once the initial offering sells out (p. 17).
    companyPricePresentation: { showPar: true, parWithoutIpoShares: true, label: 'Value' },
    privatePurchaseHeading: 'Available privates',
    historyMapPlacement: mapPlacement1870,
    privateTokens: {
        SCC: { imageUrl: CattleToken },
        GSC: { imageUrl: OpenPortToken },
        MRBC: { tiles: [{ definitionId: '18xx:9', rotation: 0 }] },
        FRISCO: { companyId: 'SLSF' },
        KATY: { companyId: 'MKT' }
    },
    // Each company's destination, and whether it has made its connection run (p. 22).
    companyOrigin: (state, companyId) => {
        const company = company1870(companyId)
        if (!company) return undefined
        const name = Map1870.location(company.destination).name ?? company.destination
        const connection = { from: company.home, to: company.destination }
        if (state.destinationStations.includes(companyId))
            return { connection, text: `Reached ${name}: its value counts double at a run’s end` }
        if (state.destinationRunsMade.includes(companyId))
            return { connection, text: `Reached ${name}` }
        return { connection, text: `Destination: ${name}` }
    },
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A price a company may start at.' },
        {
            color: 'yellow',
            name: 'Yellow',
            description: 'Shares do not count toward the certificate limit.'
        },
        {
            color: 'green',
            name: 'Green',
            description: 'Shares do not count toward the limit and may exceed 60%.'
        },
        {
            color: 'brown',
            name: 'Brown',
            description:
                'As green, and a player may buy every open-market share of one company in a turn.'
        },
        { color: 'black', name: 'Closed', description: 'A company entering it closes.' }
    ],
    marketLedge: {
        name: 'Ledge',
        description:
            'A sale with one space left to fall stops on the ledge; a rightward move meeting it goes up.',
        edges: SoftLedge1870
    }
}
