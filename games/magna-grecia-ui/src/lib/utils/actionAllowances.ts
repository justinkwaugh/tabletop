import { enhancedResupply, type ActionCard } from '@tabletop/magna-grecia'

export type ActionAllowanceKind = 'roads' | 'cities' | 'resupply'

export type ActionAllowance = {
    kind: ActionAllowanceKind
    label: string
    basic: number
    enhanced: number
}

export function actionAllowances(card: ActionCard): ActionAllowance[] {
    return [
        { kind: 'roads', label: 'Roads', basic: card.roads, enhanced: card.roads + 1 },
        { kind: 'cities', label: 'Cities', basic: card.cities, enhanced: card.cities + 1 },
        {
            kind: 'resupply',
            label: 'Resupply',
            basic: card.resupply,
            enhanced: enhancedResupply(card.resupply)
        }
    ]
}
