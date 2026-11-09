import { treasuryPoolId } from '@tabletop/18xx'

/** Chartered companies' unsold shares, sold at par for the bank (§6.5.1). */
export const IpoPoolId = 'initial-offering'
/** The Bank Pool, where sold shares go and are bought at market price. */
export const MarketPoolId = 'open-market'
/** A company's own shares on its charter, sold at market price for the company (§6.5.1). */
export const charterPoolId = treasuryPoolId
