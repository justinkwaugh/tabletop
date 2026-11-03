import { Map1870, SoftLedge1870, company1870, type State1870, TitleRules1870 } from '@tabletop/1870'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1870 } from './companyPresentation.js'
import { mapPlacement1870 } from './history.js'
import { PhaseChart1870, phaseChart1870 } from './phaseChart.js'
import { PhaseColors1870, TrainColors1870 } from './trainPresentation.js'
import CattleToken from './images/tokens/cattle.svg'
import OpenPortToken from './images/tokens/open-port.svg'

const destinationName = (companyId: string) => {
    const destination = company1870(companyId)?.destination
    return destination ? (Map1870.location(destination).name ?? destination) : ''
}

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
        const name = destinationName(companyId)
        if (!name) return undefined
        if (state.destinationStations.includes(companyId))
            return {
                text: `Reached ${name}: its value counts double at a run’s end`,
                companyIds: []
            }
        if (state.destinationRunsMade.includes(companyId))
            return { text: `Reached ${name}`, companyIds: [] }
        return { text: `Destination: ${name}`, companyIds: [] }
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
