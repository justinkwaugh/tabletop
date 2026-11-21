import type { TrainFundingRules } from '@tabletop/18xx'

// No company is ever required to buy a train, so no purchase is funded (§12.6).
export const EighteenUSATrainFundingRules: TrainFundingRules = {
    repeatSales: 'separate',
    includeMarketTrains: true,
    contributors: () => [],
    issuanceTerms: () => undefined,
    saleTerms: () => 'No company is required to buy a train.',
    protectsPresidency: () => true,
    requiredSaleShares: () => 0
}
