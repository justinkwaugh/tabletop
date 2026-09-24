import type { PurchaseOfferRequest } from '@tabletop/18xx'

export type TrainSource = 'depot' | 'mine' | 'others'
export type TrainBuyingStages = { source: TrainSource; purchase: PurchaseOfferRequest }
export const TrainBuyingStageOrder = [
    'source',
    'purchase'
] as const satisfies readonly (keyof TrainBuyingStages)[]
