import {
    BridgePrivateId,
    CreditMobilierPrivateId,
    EdgeTokenPrice,
    GantLayFee,
    GantPrivateId,
    LandGrantLays,
    LandGrantPrivateId,
    Map1850,
    MesabiAccess,
    SoftLedge1850,
    TitleRules1850,
    company1850,
    type State1850
} from '@tabletop/1850'
import { getCompany, privateOwningCompany } from '@tabletop/18xx'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { CompanyNames1850 } from './companyPresentation.js'
import { mapPlacement1850 } from './history.js'
import { PhaseChart1850, phaseChart1850 } from './phaseChart.js'
import { PhaseColors1850, TrainColors1850 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1850.currencySymbol)

export const Presentation1850: TitlePresentation<State1850> = {
    money,
    phaseChart: PhaseChart1850,
    phaseChartFor: phaseChart1850,
    // With diesels, the first diesel brings in the last off-board values (§16.2).
    revenueStageCaptionsFor: (state) => (state.variants.diesels ? { gray: 'D' } : undefined),
    trainColors: TrainColors1850,
    phaseColors: PhaseColors1850,
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: CompanyNames1850,
    // Reissue prices from par once the initial offering sells out (§5.11).
    companyPricePresentation: { showPar: true, parWithoutIpoShares: true, label: 'Value' },
    privatePurchaseHeading: 'Available privates',
    historyMapPlacement: mapPlacement1850,
    privateTilePrompts: {
        [CreditMobilierPrivateId]: 'Lay an extra yellow tile west of the Mississippi',
        [BridgePrivateId]: 'Lay a free yellow tile in St. Louis',
        [GantPrivateId]: `Buy an extra yellow tile lay for ${money(GantLayFee)}, plus terrain`,
        [LandGrantPrivateId]:
            'Lay an extra yellow tile: one anywhere, the rest west of the Mississippi'
    },
    gameFacts: (state) => [{ label: 'Mesabi', value: String(MesabiAccess.remaining(state)) }],
    companyMarks: (state, companyId) =>
        state.mesabiRights.includes(companyId)
            ? [
                  {
                      label: 'Mesabi',
                      description:
                          'Mesabi Range rights: its trains may run to or through the Range.'
                  }
              ]
            : [],
    // The Land Grant's lays left, one of which may go anywhere until it has (§15.2).
    companyFacts: (state, companyId) => {
        if (privateOwningCompany(state, LandGrantPrivateId) !== companyId) return []
        const left = LandGrantLays - state.landGrant.lays
        if (!left || getCompany(state, LandGrantPrivateId).closed) return []
        return [
            {
                label: 'Land Grant',
                value: `${left} ${left === 1 ? 'lay' : 'lays'}${state.landGrant.usedAnywhere ? ', west' : ''}`
            }
        ]
    },
    // Each company's edge area, and whether its token stands there (§7.4).
    companyOrigin: (state, companyId) => {
        const company = company1850(companyId)
        if (!company?.edgeArea) return undefined
        const name = Map1850.location(company.edgeArea).name ?? company.edgeArea
        const connection = { from: company.home, to: company.edgeArea }
        return state.edgeTokens.includes(companyId)
            ? { connection, text: `Edge token in ${name}: its value counts double` }
            : { connection, text: `Edge token, ${money(EdgeTokenPrice)}: ${name}` }
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
        name: 'Soft ledge',
        description:
            'A sale with one space left to fall stops on the ledge; a rightward move meeting it goes up.',
        edges: SoftLedge1850
    }
}
