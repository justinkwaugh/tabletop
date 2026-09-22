import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import MerchantsCard from './images/published/privates/merchants-and-co.webp'
import MerchantsThumb from './images/published/privates/merchants-and-co-600.webp'
import VernonRiverCard from './images/published/privates/vernon-river-bridge-company.webp'
import VernonRiverThumb from './images/published/privates/vernon-river-bridge-company-600.webp'
import IceBoatsCard from './images/published/privates/ice-boats.webp'
import IceBoatsThumb from './images/published/privates/ice-boats-600.webp'
import RoyalAgriculturalCard from './images/published/privates/royal-agricultural-society.webp'
import RoyalAgriculturalThumb from './images/published/privates/royal-agricultural-society-600.webp'
import RailcarFerryCard from './images/published/privates/railcar-ferry.webp'
import RailcarFerryThumb from './images/published/privates/railcar-ferry-600.webp'
import ShipbuildingCard from './images/published/privates/shipbuilding.webp'
import ShipbuildingThumb from './images/published/privates/shipbuilding-600.webp'
import HunsletCard from './images/published/privates/hunslet-steam-engine.webp'
import HunsletThumb from './images/published/privates/hunslet-steam-engine-600.webp'
import MainlineCard from './images/published/privates/mainline-concession.webp'
import MainlineThumb from './images/published/privates/mainline-concession-600.webp'
import SchreiberCard from './images/published/privates/schreiber-and-burpee-construction.webp'
import SchreiberThumb from './images/published/privates/schreiber-and-burpee-construction-600.webp'
import ShortlineCard from './images/published/privates/shortline-concession.webp'
import ShortlineThumb from './images/published/privates/shortline-concession-600.webp'
import UnionBankCard from './images/published/privates/union-bank.webp'
import UnionBankThumb from './images/published/privates/union-bank-600.webp'
import KingsMailCard from './images/published/privates/kings-mail.webp'
import KingsMailThumb from './images/published/privates/kings-mail-600.webp'
import Peir1Card from './images/published/peirs/v2/peir-1-souris.webp'
import Peir1Thumb from './images/published/peirs/v2/peir-1-souris-600.webp'
import Peir2Card from './images/published/peirs/v2/peir-2-alberton.webp'
import Peir2Thumb from './images/published/peirs/v2/peir-2-alberton-600.webp'
import Peir3Card from './images/published/peirs/v2/peir-3-mount-stewart.webp'
import Peir3Thumb from './images/published/peirs/v2/peir-3-mount-stewart-600.webp'
import Peir4Card from './images/published/peirs/v2/peir-4-murray-river.webp'
import Peir4Thumb from './images/published/peirs/v2/peir-4-murray-river-600.webp'
import Peir5Card from './images/published/peirs/v2/peir-5-summerside.webp'
import Peir5Thumb from './images/published/peirs/v2/peir-5-summerside-600.webp'
import Peir6Card from './images/published/peirs/v2/peir-6-georgetown.webp'
import Peir6Thumb from './images/published/peirs/v2/peir-6-georgetown-600.webp'
import Peir7Card from './images/published/peirs/v2/peir-7-charlottetown.webp'
import Peir7Thumb from './images/published/peirs/v2/peir-7-charlottetown-600.webp'
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
    },
    publishedCardThumbnails: {
        MC: MerchantsThumb,
        VR: VernonRiverThumb,
        IB: IceBoatsThumb,
        RA: RoyalAgriculturalThumb,
        RF: RailcarFerryThumb,
        SB: ShipbuildingThumb,
        HS: HunsletThumb,
        MLC: MainlineThumb,
        SBC: SchreiberThumb,
        SLC: ShortlineThumb,
        UB: UnionBankThumb,
        KM: KingsMailThumb,
        'PEIR:share:1': Peir1Thumb,
        'PEIR:share:2': Peir2Thumb,
        'PEIR:share:3': Peir3Thumb,
        'PEIR:share:4': Peir4Thumb,
        'PEIR:share:5': Peir5Thumb,
        'PEIR:share:6': Peir6Thumb,
        'PEIR:share:7': Peir7Thumb
    }
}
