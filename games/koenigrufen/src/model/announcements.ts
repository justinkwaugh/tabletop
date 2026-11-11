import * as Type from 'typebox'
import { trumpId } from '../components/cards.js'
import { BonusScope, Partnership, type ContractDefinition } from '../components/contracts.js'
import { TricksPerHand } from './tricks.js'

// Bonuses follow Wikipedia's Austrian table (silent / announced); the Sack is the user's addition,
// announced only.
export enum Bonus {
    Trull = 'trull',
    FourKings = 'fourKings',
    KingUltimo = 'kingUltimo',
    Pagat = 'pagat',
    Uhu = 'uhu',
    Kakadu = 'kakadu',
    Quapil = 'quapil',
    Valat = 'valat',
    Sack = 'sack'
}

export const BonusSchema = Type.Enum(Bonus)

export enum Side {
    Declarer = 'declarer',
    Defenders = 'defenders'
}

export const SideSchema = Type.Enum(Side)

export type BonusDefinition = {
    readonly bonus: Bonus
    readonly name: string
    // Scored without an announcement; undefined when only an announcement scores it.
    readonly silent?: number
    readonly announced: number
}

// Valat's values multiply the game value instead.
export const Bonuses: Readonly<Record<Bonus, BonusDefinition>> = {
    [Bonus.Trull]: { bonus: Bonus.Trull, name: 'Trull', silent: 1, announced: 2 },
    [Bonus.FourKings]: { bonus: Bonus.FourKings, name: 'Four Kings', silent: 1, announced: 2 },
    [Bonus.KingUltimo]: { bonus: Bonus.KingUltimo, name: 'King ultimo', silent: 1, announced: 2 },
    [Bonus.Pagat]: { bonus: Bonus.Pagat, name: 'Pagat', silent: 1, announced: 2 },
    [Bonus.Uhu]: { bonus: Bonus.Uhu, name: 'Uhu', silent: 2, announced: 4 },
    [Bonus.Kakadu]: { bonus: Bonus.Kakadu, name: 'Kakadu', silent: 3, announced: 6 },
    [Bonus.Quapil]: { bonus: Bonus.Quapil, name: 'Quapil', silent: 4, announced: 8 },
    [Bonus.Valat]: { bonus: Bonus.Valat, name: 'Valat', silent: 4, announced: 8 },
    [Bonus.Sack]: { bonus: Bonus.Sack, name: 'Sack', announced: 2 }
}

export const BonusOrder: readonly Bonus[] = Object.values(Bonus)

// The birds must win the last, second-last, third-last and fourth-last trick.
export const Birds: Readonly<Partial<Record<Bonus, { cardId: string; trick: number }>>> = {
    [Bonus.Pagat]: { cardId: trumpId(1), trick: TricksPerHand - 1 },
    [Bonus.Uhu]: { cardId: trumpId(2), trick: TricksPerHand - 2 },
    [Bonus.Kakadu]: { cardId: trumpId(3), trick: TricksPerHand - 3 },
    [Bonus.Quapil]: { cardId: trumpId(4), trick: TricksPerHand - 4 }
}

export function isBird(bonus: Bonus): boolean {
    return Birds[bonus] !== undefined
}

export const SackPoints = 46

// Kontra, Re, Sub: each doubles.
export const MaxDoubles = 3
export const DoubleNames = ['Kontra', 'Re', 'Sub'] as const

export type AnnouncedBonus = Type.Static<typeof AnnouncedBonus>
export const AnnouncedBonus = Type.Object({
    bonus: BonusSchema,
    side: SideSchema,
    playerId: Type.String(),
    doubles: Type.Integer({ minimum: 0, maximum: MaxDoubles })
})

// A Kontra on the game. In negative games each defender doubles alone, so the entry names them.
export type GameDoubles = Type.Static<typeof GameDoubles>
export const GameDoubles = Type.Object({
    defenderId: Type.Optional(Type.String()),
    doubles: Type.Integer({ minimum: 1, maximum: MaxDoubles })
})

export type Announcements = Type.Static<typeof Announcements>
export const Announcements = Type.Object({
    bonuses: Type.Array(AnnouncedBonus),
    game: Type.Array(GameDoubles),
    turns: Type.Integer({ minimum: 0 }),
    passesInRow: Type.Integer({ minimum: 0 })
})

export function newAnnouncements(): Announcements {
    return { bonuses: [], game: [], turns: 0, passesInRow: 0 }
}

// What a Kontra (or Re, Sub) raises: the game (in negative games, one defender's share of it), or a
// bonus one side announced.
export type DoubleTarget = Type.Static<typeof DoubleTarget>
export const DoubleTarget = Type.Union([
    Type.Object({ kind: Type.Literal('game'), defenderId: Type.Optional(Type.String()) }),
    Type.Object({ kind: Type.Literal('bonus'), bonus: BonusSchema, side: SideSchema })
])

export function sameTarget(a: DoubleTarget, b: DoubleTarget): boolean {
    return a.kind === 'game'
        ? b.kind === 'game' && a.defenderId === b.defenderId
        : b.kind === 'bonus' && a.bonus === b.bonus && a.side === b.side
}

export function opposite(side: Side): Side {
    return side === Side.Declarer ? Side.Defenders : Side.Declarer
}

// What the speaker knows about the hand, for deciding what they may say.
export type AnnouncingContext = {
    readonly definition: ContractDefinition
    readonly playerId: string
    readonly side: Side
    readonly defenderIds: readonly string[]
    readonly declarerId: string
    // Wikipedia: no Kontra once the called King has turned up in the talon.
    readonly kontraAllowed: boolean
    // The called King is in play (not in the talon).
    readonly calledKingInPlay: boolean
}

export function announceableBonuses(
    announcements: Announcements,
    context: AnnouncingContext
): Bonus[] {
    const scope = context.definition.bonuses
    if (scope === BonusScope.None) {
        return []
    }
    return BonusOrder.filter((bonus) => {
        if (scope === BonusScope.ValatOnly && bonus !== Bonus.Valat) {
            return false
        }
        if (
            bonus === Bonus.KingUltimo &&
            (context.definition.partnership !== Partnership.CallKing ||
                context.side !== Side.Declarer ||
                !context.calledKingInPlay)
        ) {
            return false
        }
        return !announcements.bonuses.some(
            (announced) => announced.bonus === bonus && announced.side === context.side
        )
    })
}

function isNegative(definition: ContractDefinition): boolean {
    return definition.tricksToTake !== undefined
}

// Kontra and Sub come from the side against the item, Re from the side that owns it. The game
// belongs to declarer's side.
export function doubleTargets(
    announcements: Announcements,
    context: AnnouncingContext
): DoubleTarget[] {
    if (!context.kontraAllowed) {
        return []
    }
    const mayRaise = (owner: Side, doubles: number) =>
        doubles < MaxDoubles &&
        (doubles % 2 === 0 ? context.side === opposite(owner) : context.side === owner)
    const targets: DoubleTarget[] = []
    if (isNegative(context.definition)) {
        for (const defenderId of context.defenderIds) {
            const doubles = gameDoubles(announcements, defenderId)
            const raises = doubles % 2 === 0 ? context.playerId === defenderId : true
            if (raises && mayRaise(Side.Declarer, doubles)) {
                targets.push({ kind: 'game', defenderId })
            }
        }
    } else if (mayRaise(Side.Declarer, gameDoubles(announcements))) {
        targets.push({ kind: 'game' })
    }
    for (const announced of announcements.bonuses) {
        if (mayRaise(announced.side, announced.doubles)) {
            targets.push({ kind: 'bonus', bonus: announced.bonus, side: announced.side })
        }
    }
    return targets
}

export function doublesOn(announcements: Announcements, target: DoubleTarget): number {
    return target.kind === 'game'
        ? gameDoubles(announcements, target.defenderId)
        : (announcements.bonuses.find(
              (entry) => entry.bonus === target.bonus && entry.side === target.side
          )?.doubles ?? 0)
}

export function gameDoubles(announcements: Announcements, defenderId?: string): number {
    return announcements.game.find((entry) => entry.defenderId === defenderId)?.doubles ?? 0
}

export function hasAnnouncementRound(definition: ContractDefinition): boolean {
    return definition.partnership !== Partnership.Individual
}

// Declarer speaks first; the round ends once everyone has spoken and the last three in a row
// passed.
export function isAnnouncingOver(announcements: Announcements, players: number): boolean {
    return announcements.turns >= players && announcements.passesInRow >= players - 1
}

export function validateAnnouncement(
    announcements: Announcements,
    context: AnnouncingContext,
    bonuses: readonly Bonus[],
    doubles: readonly DoubleTarget[]
): string | undefined {
    const announceable = announceableBonuses(announcements, context)
    const unique = new Set(bonuses)
    if (unique.size !== bonuses.length || bonuses.some((bonus) => !announceable.includes(bonus))) {
        return `cannot announce ${bonuses.join(', ')}`
    }
    const targets = doubleTargets(announcements, context)
    const doublesUnique = doubles.every(
        (target, index) => doubles.findIndex((other) => sameTarget(other, target)) === index
    )
    if (!doublesUnique || doubles.some((target) => !targets.some((t) => sameTarget(t, target)))) {
        return 'cannot double that'
    }
    return undefined
}

export function applyAnnouncement(
    announcements: Announcements,
    context: AnnouncingContext,
    bonuses: readonly Bonus[],
    doubles: readonly DoubleTarget[]
) {
    for (const target of doubles) {
        if (target.kind === 'game') {
            const entry = announcements.game.find(
                (candidate) => candidate.defenderId === target.defenderId
            )
            if (entry) {
                entry.doubles += 1
            } else {
                announcements.game.push({
                    ...(target.defenderId === undefined ? {} : { defenderId: target.defenderId }),
                    doubles: 1
                })
            }
        } else {
            const announced = announcements.bonuses.find(
                (candidate) => candidate.bonus === target.bonus && candidate.side === target.side
            )
            if (announced) {
                announced.doubles += 1
            }
        }
    }
    for (const bonus of bonuses) {
        announcements.bonuses.push({
            bonus,
            side: context.side,
            playerId: context.playerId,
            doubles: 0
        })
    }
    announcements.turns += 1
    announcements.passesInRow =
        bonuses.length === 0 && doubles.length === 0 ? announcements.passesInRow + 1 : 0
}
