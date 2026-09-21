import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { TheOldPrinceCompanies } from '@tabletop/the-old-prince'
import { TheOldPrinceCompanyNames } from './companyPresentation.js'
import { TheOldPrincePhaseChart } from './phaseChart.js'
import { TheOldPrinceTrainColors } from './trainPresentation.js'

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
    privatePurchaseLabel: 'Buy Hunslet'
}
