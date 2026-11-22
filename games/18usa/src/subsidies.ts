import { shuffle, type Prng } from '@tabletop/common'
import { ResourceKinds, SubsidyCityIds, type ResourceKind } from './mapFeatures.js'

export type SubsidyEffect =
    | { kind: 'none' }
    | { kind: 'boomtown' }
    | { kind: 'free-station' }
    | { kind: 'city-bonus'; value: number; fromPhase5Value: number }
    | { kind: 'resource' }
    | { kind: 'cash'; amount: number }

export type Subsidy = { id: string; name: string; effect: SubsidyEffect; description: string }

const noSubsidy = (number: number): Subsidy => ({
    id: `none-${number}`,
    name: 'No subsidy',
    effect: { kind: 'none' },
    description: 'No subsidy. P29 Bankrupt Railroad gives a company it starts here a free 2-train.'
})
const cash = (id: string, amount: number): Subsidy => ({
    id,
    name: `$${amount}`,
    effect: { kind: 'cash', amount },
    description: `$${amount} toward the winning bid of the company started here, paid by the bank into its treasury.`
})

/** The 16 subsidy tiles; 14 are dealt to the subsidy cities and two go back to the box. */
export const Subsidies: readonly Subsidy[] = [
    ...[1, 2, 3, 4, 5, 6, 7].map(noSubsidy),
    {
        id: 'boomtown',
        name: 'Boomtown',
        effect: { kind: 'boomtown' },
        description:
            'Discard to upgrade the company’s home city to green during its first operating round, as a free action.'
    },
    {
        id: 'free-station',
        name: 'Free Station',
        effect: { kind: 'free-station' },
        description:
            'One extra station token, placeable in any city the company can reach, even one without an open slot.'
    },
    {
        id: 'plus-10',
        name: '+10',
        effect: { kind: 'city-bonus', value: 10, fromPhase5Value: 10 },
        description: 'The city is worth $10 more for the rest of the game.'
    },
    {
        id: 'plus-10-20',
        name: '+10 / +20',
        effect: { kind: 'city-bonus', value: 10, fromPhase5Value: 20 },
        description: 'The city is worth $10 more in phases 2–4 and $20 more from phase 5.'
    },
    {
        id: 'resource',
        name: 'Resource',
        effect: { kind: 'resource' },
        description:
            'One ore, oil or coal token, of a kind whose privates are not all in play, placed with a free extra yellow lay.'
    },
    cash('cash-30-1', 30),
    cash('cash-30-2', 30),
    cash('cash-40', 40),
    cash('cash-50', 50)
]

/** Which subsidy tile each subsidy city received. */
export type SubsidyAssignment = Readonly<Record<string, string>>

export function assignSubsidies(prng: Prng): SubsidyAssignment {
    const subsidyIds = Subsidies.map((subsidy) => subsidy.id)
    shuffle(subsidyIds, prng.random)
    return Object.fromEntries(
        SubsidyCityIds.map((locationId, index) => [locationId, subsidyIds[index]])
    )
}

/** The privates whose being out of play makes each resource available to the Resource subsidy. */
const ResourcePrivates: Readonly<Record<ResourceKind, readonly string[]>> = {
    coal: ['P18', 'P28'],
    oil: ['P12'],
    ore: ['P24']
}

/**
 * The resources the Resource subsidy offers: those with a private left out of the game. With
 * none it counts as no subsidy.
 */
export function resourceSubsidyKinds(privateIdsInPlay: readonly string[]): ResourceKind[] {
    return ResourceKinds.filter((kind) =>
        ResourcePrivates[kind].some((privateId) => !privateIdsInPlay.includes(privateId))
    )
}

/**
 * The cities whose subsidy counts as none: a No subsidy tile, or the Resource tile when every
 * resource's privates are in play (Subsidy Tiles).
 */
export function noSubsidyCityIds(
    assignment: SubsidyAssignment,
    privateIdsInPlay: readonly string[]
): string[] {
    const none = resourceSubsidyKinds(privateIdsInPlay).length ? ['none'] : ['none', 'resource']
    return Object.entries(assignment)
        .filter(([, subsidyId]) =>
            Subsidies.some((entry) => entry.id === subsidyId && none.includes(entry.effect.kind))
        )
        .map(([locationId]) => locationId)
}
