import { nextOperatingCompany } from '../operating/operatingSet.js'
import type { TransferRules } from '../transfers/purchaseOffer.js'

export const FinanceExampleTransferTiming: Pick<TransferRules, 'operatingCompany' | 'canPurchase'> =
    {
        operatingCompany(state) {
            return [
                'LayingTrack',
                'PlacingStation',
                'RunningTrains',
                'DistributingEarnings',
                'BuyingTrains'
            ].includes(state.machineState)
                ? nextOperatingCompany(state)
                : undefined
        },
        canPurchase(state, companyId, asset) {
            return (
                asset.kind === 'private' ||
                (state.machineState === 'BuyingTrains' &&
                    state.trainPurchaseStep?.companyId === companyId)
            )
        }
    }
