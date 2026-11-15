import type { GameAction } from '@tabletop/common'
import {
    PalaceColor,
    isPlaceBuilding,
    isPlaceMerchant,
    isPlaceRooftop,
    isPlaceStable,
    isPlaceWall,
    isTakeTeaBreak,
    type TileAwards
} from '@tabletop/medina'

export const COLOR_NAMES: Record<PalaceColor, string> = {
    [PalaceColor.Grey]: 'grey',
    [PalaceColor.Purple]: 'purple',
    [PalaceColor.Brown]: 'brown',
    [PalaceColor.Orange]: 'orange'
}

export type NameOf = (playerId: string) => string

export type ActionIcon =
    | { kind: 'building'; color: PalaceColor }
    | { kind: 'rooftop'; playerId?: string }
    | { kind: 'stable' }
    | { kind: 'merchant' }
    | { kind: 'wall' }
    | { kind: 'tea' }

export type ActionLine = {
    icon: ActionIcon
    text: string
    notes: string[]
}

function withArticle(name: string): string {
    return `${name.startsWith('o') ? 'an' : 'a'} ${name}`
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

function listOf(items: string[]): string {
    if (items.length < 2) {
        return items.join('')
    }
    return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

function earnedBy(awards: TileAwards | undefined): string[] {
    if (!awards) {
        return []
    }
    const earned: string[] = []
    if (awards.palaceTile) {
        earned.push(`the ${COLOR_NAMES[awards.palaceTile]} palace tile`)
    }
    for (const tower of awards.towers) {
        earned.push(`tower tile ${tower}`)
    }
    if (awards.merchants > 0) {
        earned.push(plural(awards.merchants, 'merchant'))
    }
    return earned
}

function andClaimed(
    awards: TileAwards | undefined,
    actorId: string | undefined,
    nameOf: NameOf
): string {
    const earned = earnedBy(awards)
    if (earned.length === 0) {
        return ''
    }
    const list = listOf(earned)
    if (awards?.palaceOwnerId === actorId) {
        return ` and claimed ${list}`
    }
    return awards?.palaceOwnerId
        ? ` and ${nameOf(awards.palaceOwnerId)} claimed ${list}`
        : ` and the neutral palace claimed ${list}`
}

export function describeAction(action: GameAction, nameOf: NameOf): ActionLine | undefined {
    if (isPlaceBuilding(action)) {
        const name = COLOR_NAMES[action.color]
        return {
            icon: { kind: 'building', color: action.color },
            text: action.metadata?.startedPalace
                ? `Started ${withArticle(name)} palace`
                : `Added to the ${name} palace`,
            notes: []
        }
    }
    if (isPlaceRooftop(action)) {
        const palace = action.metadata
            ? `${withArticle(COLOR_NAMES[action.metadata.color])} palace of ${action.metadata.size}`
            : 'a palace'
        const notes = action.metadata?.buildingsReturned
            ? [`all ${COLOR_NAMES[action.metadata.color]} buildings return to the box`]
            : []
        if (action.neutral) {
            return {
                icon: { kind: 'rooftop' },
                text: `Closed ${palace} with a neutral rooftop${andClaimed(action.metadata?.awards, undefined, nameOf)}`,
                notes
            }
        }
        const teaTiles = action.metadata?.teaTiles
        return {
            icon: { kind: 'rooftop', playerId: action.playerId },
            text: `Claimed ${listOf([
                palace,
                ...earnedBy(action.metadata?.awards),
                ...(teaTiles ? [plural(teaTiles, 'tea tile')] : [])
            ])}`,
            notes
        }
    }
    if (isPlaceStable(action)) {
        const name = action.metadata ? `${COLOR_NAMES[action.metadata.color]} ` : ''
        return {
            icon: { kind: 'stable' },
            text: `Added a stable to the ${name}palace${andClaimed(action.metadata?.awards, action.playerId, nameOf)}`,
            notes: []
        }
    }
    if (isPlaceMerchant(action)) {
        return {
            icon: { kind: 'merchant' },
            text: action.metadata?.newStreet ? 'Started a new market street' : 'Added a merchant',
            notes: []
        }
    }
    if (isPlaceWall(action)) {
        const tower = action.metadata ? ` from tower ${action.metadata.tower}` : ''
        return {
            icon: { kind: 'wall' },
            text: `Extended the wall${tower}${andClaimed(action.metadata?.awards, action.playerId, nameOf)}`,
            notes: []
        }
    }
    if (isTakeTeaBreak(action)) {
        return { icon: { kind: 'tea' }, text: 'Took a tea break', notes: [] }
    }
    return undefined
}
