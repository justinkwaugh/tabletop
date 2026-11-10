import {
    Bonuses,
    DoubleNames,
    doublesOn,
    Side,
    type Announcements,
    type Bonus,
    type BonusResult,
    type ContractDefinition,
    type DoubleTarget,
    type GameDoubles
} from '@tabletop/koenigrufen'
import type { Names } from './actionDescription.js'

export function bonusKey(bonus: Bonus): string {
    return `bonus:${bonus}`
}

export function doubleKey(target: DoubleTarget): string {
    return target.kind === 'game'
        ? `game:${target.defenderId ?? ''}`
        : `double:${target.bonus}:${target.side}`
}

export function bonusName(bonus: Bonus): string {
    return Bonuses[bonus].name
}

// The bonus's announced worth; Valat's multiplies the game.
export function announcedValue(bonus: Bonus, definition: ContractDefinition): number {
    const value = Bonuses[bonus].announced
    if (bonus === 'valat') {
        return value * definition.win
    }
    return definition.bonusesDoubled ? value * 2 : value
}

function sideName(side: Side): string {
    return side === Side.Declarer ? 'declarer’s' : 'the defenders’'
}

// The word for raising `target` one more step.
export function doubleWord(announcements: Announcements, target: DoubleTarget): string {
    return DoubleNames[doublesOn(announcements, target)] ?? 'Kontra'
}

export function doubleTargetName(target: DoubleTarget, names: Names, myId?: string): string {
    if (target.kind === 'bonus') {
        return `${sideName(target.side)} ${bonusName(target.bonus)}`
    }
    if (target.defenderId === undefined || target.defenderId === myId) {
        return 'the game'
    }
    return `the game with ${names.name(target.defenderId)}`
}

// A button's label inside its Kontra, Re or Sub row: the row's word fixes whose bonus it is, since
// Kontra and Sub raise the other side's and Re one's own.
export function shortTargetName(target: DoubleTarget, names: Names, myId?: string): string {
    if (target.kind === 'bonus') {
        return bonusName(target.bonus)
    }
    if (target.defenderId === undefined || target.defenderId === myId) {
        return 'Game'
    }
    return `Game with ${names.name(target.defenderId)}`
}

export type DoubleGroup = { word: string; targets: DoubleTarget[] }

// The doubles on offer, one group per word, in the order Kontra, Re, Sub.
export function doubleGroups(
    announcements: Announcements,
    targets: readonly DoubleTarget[]
): DoubleGroup[] {
    return DoubleNames.map((word) => ({
        word,
        targets: targets.filter((target) => doubleWord(announcements, target) === word)
    })).filter((group) => group.targets.length > 0)
}

function doublesSuffix(doubles: number): string {
    return doubles > 0 ? ` (${DoubleNames[doubles - 1]})` : ''
}

export function gameDoublesLine(entry: GameDoubles, names: Names): string {
    const label = DoubleNames[entry.doubles - 1]
    return entry.defenderId === undefined
        ? `Game ${label}`
        : `${names.name(entry.defenderId)} ${label}`
}

// Everything said so far, for the table: Kontras on the game, then each side's bonuses.
export function announcementsSummary(announcements: Announcements, names: Names): string[] {
    return [
        ...announcements.game.map((entry) => gameDoublesLine(entry, names)),
        ...announcements.bonuses.map(
            (entry) =>
                `${bonusName(entry.bonus)}${entry.side === Side.Defenders ? ' (defenders)' : ''}${doublesSuffix(entry.doubles)}`
        )
    ]
}

export function bonusResultLine(result: BonusResult): string {
    const how = result.announced ? 'announced' : 'silent'
    const outcome = result.made ? 'made' : 'lost'
    return `${bonusName(result.bonus)} · ${sideName(result.side)} · ${how}${doublesSuffix(result.doubles)} · ${outcome}`
}
