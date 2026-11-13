import {
    Bonus,
    Bonuses,
    DoubleNames,
    doublesOn,
    PackPoints,
    SackPoints,
    Side,
    type Announcements,
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

// Valat's worth multiplies the game; Solo contracts double the rest.
function scaledValue(bonus: Bonus, value: number, definition: ContractDefinition): number {
    if (bonus === Bonus.Valat) {
        return value * definition.win
    }
    return definition.bonusesDoubled ? value * 2 : value
}

export function announcedValue(bonus: Bonus, definition: ContractDefinition): number {
    return scaledValue(bonus, Bonuses[bonus].announced, definition)
}

const BonusGoals: Readonly<Record<Bonus, string>> = {
    [Bonus.Trull]: 'Take Pagat, Mond and Sküs.',
    [Bonus.FourKings]: 'Take all four Kings.',
    [Bonus.KingUltimo]: 'Win the last trick with the called King.',
    [Bonus.Pagat]: 'Win the last trick with the Pagat (trump I).',
    [Bonus.Uhu]: 'Win the second-last trick with trump II.',
    [Bonus.Kakadu]: 'Win the third-last trick with trump III.',
    [Bonus.Quapil]: 'Win the fourth-last trick with trump IIII.',
    [Bonus.Valat]: 'Win every trick. Replaces the game and every other bonus.',
    [Bonus.Sack]: `Take ${SackPoints} of ${PackPoints} card points.`
}

export function bonusGoal(bonus: Bonus): string {
    return BonusGoals[bonus]
}

export function bonusHeading(bonus: Bonus, definition: ContractDefinition): string {
    return `${bonusName(bonus)} (${announcedValue(bonus, definition)})`
}

export function bonusSummary(bonus: Bonus, definition: ContractDefinition): string {
    const silent = Bonuses[bonus].silent
    const unannounced =
        silent === undefined
            ? 'Scores only when announced.'
            : `Worth ${scaledValue(bonus, silent, definition)} unannounced.`
    return `${bonusGoal(bonus)} ${unannounced}`
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
