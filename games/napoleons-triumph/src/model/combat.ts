import { Side, UnitType, type Face } from '../components/pieces.js'

export interface Engagement {
    attackLeaders: Face[]
    defenseLeaders: Face[]
    /** Whether the defending pieces block the defense approach rather than stand in reserve. */
    defendersBlocking: boolean
    /** Penalties printed on the defender's side of the approach. */
    approachPenalties: UnitType[]
    /** The Santon's slopes count even against an attack on its reserve (rule 18). */
    penaltiesApplyInReserve: boolean
    guardAttack: boolean
}

export function leadingType(leaders: Face[]): UnitType | undefined {
    return leaders[0]?.type
}

export function isArtilleryLed(attackLeaders: Face[]): boolean {
    return leadingType(attackLeaders) === UnitType.Artillery
}

function totalStrength(faces: Face[]): number {
    return faces.reduce((sum, face) => sum + face.strength, 0)
}

function defenseLeaderStrength(face: Face, guardAttack: boolean): number {
    return guardAttack && face.strength < 3 ? face.strength - 1 : face.strength
}

export function initialResult(engagement: Engagement): number {
    const type = leadingType(engagement.attackLeaders)
    let result = totalStrength(engagement.attackLeaders)
    if (type === UnitType.Infantry && engagement.defendersBlocking) {
        result -= 1
    }
    const penaltiesApply = engagement.defendersBlocking || engagement.penaltiesApplyInReserve
    if (type !== undefined && penaltiesApply && engagement.approachPenalties.includes(type)) {
        result -= 1
    }
    if (type !== UnitType.Artillery) {
        result -= engagement.defenseLeaders.reduce(
            (sum, face) => sum + defenseLeaderStrength(face, engagement.guardAttack),
            0
        )
    }
    return result
}

export interface Tiebreak {
    defendersBlocking: boolean
    attackingUnits: number
    defendingUnits: number
    attackerSide: Side
}

export function attackerWins(result: number, tiebreak: Tiebreak): boolean {
    if (result !== 0) {
        return result > 0
    }
    if (tiebreak.defendersBlocking) {
        return false
    }
    if (tiebreak.attackingUnits !== tiebreak.defendingUnits) {
        return tiebreak.attackingUnits > tiebreak.defendingUnits
    }
    return tiebreak.attackerSide === Side.French
}

/** Counter-attackers take a step loss first and count at their reduced strength. */
export function counterAttackStrength(counterAttackers: Face[]): number {
    return counterAttackers.reduce((sum, face) => sum + Math.max(0, face.strength - 1), 0)
}

export function attackerLossPoints(
    attackLeaders: Face[],
    defenseLeaderCount: number,
    finalResult: number
): number {
    if (isArtilleryLed(attackLeaders)) {
        return 0
    }
    return defenseLeaderCount + Math.max(0, -finalResult)
}

export function defenderLossPoints(
    attackLeaders: Face[],
    defenseLeaders: Face[],
    finalResult: number
): number {
    const surplus = Math.max(0, finalResult)
    if (isArtilleryLed(attackLeaders)) {
        return surplus
    }
    const leadingArtillery = defenseLeaders.filter(
        (face) => face.type === UnitType.Artillery
    ).length
    return Math.max(0, attackLeaders.length + surplus - leadingArtillery)
}

export interface EvenSplit {
    /** Steps each unit takes for certain. */
    taken: number[]
    /** Two units either of which could take the one remaining step; the opponent decides. */
    oddBetween?: [number, number]
    /** Steps left over once every unit in the group is eliminated. */
    excess: number
}

/** Spreads step losses over one or two units as evenly as their strengths allow (rule 11, steps 9 and 10). */
export function splitEvenly(strengths: number[], losses: number): EvenSplit {
    const taken = strengths.map(() => 0)
    const capacity = strengths.reduce((sum, strength) => sum + strength, 0)
    let remaining = Math.min(losses, capacity)
    const excess = losses - remaining
    while (remaining > 0) {
        const open = strengths.flatMap((strength, index) => (taken[index] < strength ? [index] : []))
        const fewest = Math.min(...open.map((index) => taken[index]))
        const next = open.filter((index) => taken[index] === fewest)
        if (next.length > remaining) {
            return { taken, oddBetween: [next[0], next[1]], excess }
        }
        for (const index of next) {
            taken[index] += 1
            remaining -= 1
        }
    }
    return { taken, excess }
}
