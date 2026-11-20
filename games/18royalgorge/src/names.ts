import { isTreasuryPoolId, titleNames } from '@tabletop/18xx'
import { MetalsRoyalGorge, PrivateCardsRoyalGorge, RailroadsRoyalGorge } from './companies.js'

/** The bank pool, holding railroad shares players sold (Selling). */
export const BankPoolIdRoyalGorge = 'bank-pool'
/** The steel and gold companies' spaces on the board, where their unowned shares lie (SR-5). */
export const MetalBoardPoolIdRoyalGorge = 'metal-board'

/** What the route bonuses are, by the ids the title names. */
export const StCloudBonusId = 'st-cloud'
export const GhostTownBonusId = 'ghost-town'

export const NamesRoyalGorge = titleNames(
    Object.fromEntries([
        ...RailroadsRoyalGorge.map((company) => [company.id, company.name]),
        ...MetalsRoyalGorge.map((company) => [company.id, company.name]),
        ...PrivateCardsRoyalGorge.map((card) => [card.id, card.name])
    ]),
    (poolId) =>
        isTreasuryPoolId(poolId)
            ? 'Treasury'
            : poolId === BankPoolIdRoyalGorge
              ? 'Bank Pool'
              : poolId === MetalBoardPoolIdRoyalGorge
                ? 'Board'
                : undefined,
    { [StCloudBonusId]: 'St. Cloud Hotel', [GhostTownBonusId]: 'Ghost Towns' }
)
