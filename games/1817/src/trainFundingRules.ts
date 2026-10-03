import type { TrainFundingRules } from '@tabletop/18xx'

// No company is ever required to buy a train, so no purchase is funded.
export const EighteenSeventeenTrainFundingRules: TrainFundingRules = {
    includeMarketTrains: true,
    contributors: () => [],
    issuanceTerms: () => undefined,
    saleTerms: () => 'No company is required to buy a train.',
    protectsPresidency: () => true,
    requiredSaleShares: () => 0
}
