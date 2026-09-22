import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import MerchantsCard from './images/published/privates/merchants-and-co.jpg'
import VernonRiverCard from './images/published/privates/vernon-river-bridge-company.jpg'
import IceBoatsCard from './images/published/privates/ice-boats.jpg'
import RoyalAgriculturalCard from './images/published/privates/royal-agricultural-society.jpg'
import RailcarFerryCard from './images/published/privates/railcar-ferry.jpg'
import ShipbuildingCard from './images/published/privates/shipbuilding.jpg'
import HunsletCard from './images/published/privates/hunslet-steam-engine.jpg'
import MainlineCard from './images/published/privates/mainline-concession.jpg'
import SchreiberCard from './images/published/privates/schreiber-and-burpee-construction.jpg'
import ShortlineCard from './images/published/privates/shortline-concession.jpg'
import UnionBankCard from './images/published/privates/union-bank.jpg'
import KingsMailCard from './images/published/privates/kings-mail.jpg'
import Peir1Card from './images/published/peirs/v2/peir-1-souris.jpg'
import Peir2Card from './images/published/peirs/v2/peir-2-alberton.jpg'
import Peir3Card from './images/published/peirs/v2/peir-3-mount-stewart.jpg'
import Peir4Card from './images/published/peirs/v2/peir-4-murray-river.jpg'
import Peir5Card from './images/published/peirs/v2/peir-5-summerside.jpg'
import Peir6Card from './images/published/peirs/v2/peir-6-georgetown.jpg'
import Peir7Card from './images/published/peirs/v2/peir-7-charlottetown.jpg'
import { TheOldPrinceCompanies } from '@tabletop/the-old-prince'
import { TheOldPrinceCompanyNames } from './companyPresentation.js'
import { TheOldPrincePhaseChart } from './phaseChart.js'
import {
    TheOldPrinceTrainColors,
    TheOldPrincePublishedTrainColors,
    TheOldPrincePublishedPhaseColors
} from './trainPresentation.js'

export const TheOldPrincePresentation: TitlePresentation = {
    money: moneyFormat('$'),
    trainShortLabels: { D: 'D' },
    phaseChart: TheOldPrincePhaseChart,
    trainColors: TheOldPrinceTrainColors,
    phaseColors: TheOldPrinceTrainColors,
    marketPoolId: 'market',
    exchangePoolId: 'reserved',
    companyNames: TheOldPrinceCompanyNames,
    companyPricePresentation: { showPar: false, label: 'Value', showInSpreadsheet: true },
    numberedShareNames: {
        PEIR: Object.fromEntries(
            TheOldPrinceCompanies.map((company) => [company.number, company.name])
        )
    },
    includedCompanyIds: ['PEIR'],
    mapFocusExcludedCompanyIds: ['PEIR'],
    portfolioCompanyIds: ['UB'],
    includedPortfolioCompanyIds: ['UB'],
    poolName: (pool) =>
        pool.id === 'reserved'
            ? 'Exchange'
            : pool.owner.kind === 'company'
              ? 'Treasury'
              : pool.name,
    privatePurchaseLabel: 'Buy Hunslet',
    publishedTrainColors: TheOldPrincePublishedTrainColors,
    publishedPhaseColors: TheOldPrincePublishedPhaseColors,
    // Published presentation: Boda Games private cards and the second-variant PEIR certificates.
    publishedCardImages: {
        MC: MerchantsCard,
        VR: VernonRiverCard,
        IB: IceBoatsCard,
        RA: RoyalAgriculturalCard,
        RF: RailcarFerryCard,
        SB: ShipbuildingCard,
        HS: HunsletCard,
        MLC: MainlineCard,
        SBC: SchreiberCard,
        SLC: ShortlineCard,
        UB: UnionBankCard,
        KM: KingsMailCard,
        'PEIR:share:1': Peir1Card,
        'PEIR:share:2': Peir2Card,
        'PEIR:share:3': Peir3Card,
        'PEIR:share:4': Peir4Card,
        'PEIR:share:5': Peir5Card,
        'PEIR:share:6': Peir6Card,
        'PEIR:share:7': Peir7Card
    }
}
