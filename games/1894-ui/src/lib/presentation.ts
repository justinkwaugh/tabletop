import { holdsAccessRight } from '@tabletop/18xx'
import {
    EighteenNinetyFourTitleRules,
    FerryRightId,
    SaintQuentinPrivateId,
    holdsLondonShippingStation
} from '@tabletop/1894'
import { moneyFormat, type LocationMarkerArt, type TitlePresentation } from '@tabletop/18xx-ui'
import { EighteenNinetyFourCompanyNames } from './companyPresentation.js'
import { EighteenNinetyFourPhaseChart } from './phaseChart.js'
import { EighteenNinetyFourTrainColors } from './trainPresentation.js'

export const EighteenNinetyFourPresentation: TitlePresentation = {
    money: moneyFormat(EighteenNinetyFourTitleRules.currencySymbol),
    phaseChart: EighteenNinetyFourPhaseChart,
    trainColors: EighteenNinetyFourTrainColors,
    phaseColors: EighteenNinetyFourTrainColors,
    // Saint-Quentin à Guise blocks nothing, so its marker goes when the private closes.
    markerArtFor(state): LocationMarkerArt {
        return state.companies.find((company) => company.id === SaintQuentinPrivateId)?.closed
            ? { G10: { SQG: { hidden: true } } }
            : {}
    },
    corporateFinance: {
        issue: 'Reissue',
        issueNote: 'par becomes ₣100',
        issuePool: { label: 'IPO', poolId: 'initial-offering' }
    },
    marketPoolId: 'open-market',
    ipoPoolId: 'initial-offering',
    companyNames: EighteenNinetyFourCompanyNames,
    privatePurchaseHeading: 'Available privates',
    privateTilePrompts: {},
    privateTokens: {},
    // A ferry marker opens London; London shipping's A12 station raises London's value (§14, §11.2.2.6).
    companyMarks: (state, companyId) => [
        ...(holdsAccessRight(state, companyId, FerryRightId)
            ? [
                  {
                      label: 'Ferry',
                      description: 'Ferry marker: may run to and build through London.'
                  }
              ]
            : []),
        ...(holdsLondonShippingStation(state, companyId)
            ? [
                  {
                      label: 'A12',
                      description:
                          'London shipping station: London adds the route’s largest other revenue, besides Luxembourg.'
                  }
              ]
            : [])
    ],
    // §10.1: the market's four regions.
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A price a company may start at.' },
        {
            color: 'light-pink',
            name: 'Starting par',
            description:
                'An extra par for the drawn French company and the Belge, and the price a reissue sets.',
            fill: { kind: 'solid', color: '#f8dde4' }
        },
        {
            color: 'gray',
            name: 'Gray area',
            description:
                'Shares do not count toward the certificate limit and may exceed 60%; the president may buy two at a time; a sold-out company rises one more space.',
            fill: { kind: 'solid', color: '#b4b8bb' }
        },
        { color: 'red', name: 'End', description: 'A share price reaching ₣450 ends the game.' }
    ]
}
