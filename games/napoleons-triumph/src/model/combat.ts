import { Side, UnitType, type Face } from '../components/pieces.js'
import { ResultTermKind, type ResultTerm } from './attack.js'

export interface Engagement {
    attackLeaders: Face[]
    defenseLeaders: Face[]
    defendersBlocking: boolean
    approachPenalties: UnitType[]
    /** The Santon's slopes count even against an attack on its reserve (rule 18). */
    penaltiesApplyInReserve: boolean
    guardAttack: boolean
}

function leadingType(leaders: Face[]): UnitType | undefined {
    return leaders[0]?.type
}

export function isArtilleryLed(attackLeaders: Face[]): boolean {
    return leadingType(attackLeaders) === UnitType.Artillery
}

function totalStrength(faces: Face[]): number {
    return faces.reduce((sum, face) => sum + face.strength, 0)
}

const GUARD_ATTACK_SPARES_FROM = 3

function asTheyWere(faces: Face[]): Face[] {
    return faces.map((face) => ({ ...face }))
}

/** Rule 11, step 6, as the things it counts: their values add up to the initial result. */
export function initialResultTerms(engagement: Engagement): ResultTerm[] {
    const type = leadingType(engagement.attackLeaders)
    const terms: ResultTerm[] = [
        {
            kind: ResultTermKind.AttackLeaders,
            value: totalStrength(engagement.attackLeaders),
            faces: asTheyWere(engagement.attackLeaders)
        }
    ]
    if (type === UnitType.Infantry && engagement.defendersBlocking) {
        terms.push({ kind: ResultTermKind.InfantryAgainstBlockers, value: -1 })
    }
    const penaltiesApply = engagement.defendersBlocking || engagement.penaltiesApplyInReserve
    if (type !== undefined && penaltiesApply && engagement.approachPenalties.includes(type)) {
        terms.push({ kind: ResultTermKind.ApproachPenalty, value: -1 })
    }
    if (type === UnitType.Artillery) {
        terms.push({ kind: ResultTermKind.ArtilleryLeads, value: 0 })
        return terms
    }
    terms.push({
        kind: ResultTermKind.DefenseLeaders,
        value: 0 - totalStrength(engagement.defenseLeaders),
        faces: asTheyWere(engagement.defenseLeaders)
    })
    const eased = engagement.guardAttack
        ? engagement.defenseLeaders.filter((face) => face.strength < GUARD_ATTACK_SPARES_FROM)
              .length
        : 0
    if (eased > 0) {
        terms.push({ kind: ResultTermKind.GuardAttack, value: eased })
    }
    return terms
}

export function initialResult(engagement: Engagement): number {
    return initialResultTerms(engagement).reduce((sum, term) => sum + term.value, 0)
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

export function counterAttackStrength(counterAttackers: Face[]): number {
    return counterAttackers.reduce((sum, face) => sum + Math.max(0, face.strength - 1), 0)
}

/** Rule 11, step 8, as the one thing it counts: the counter-attackers as they stood before each lost its step. */
export function counterAttackTerm(counterAttackers: Face[]): ResultTerm {
    return {
        kind: ResultTermKind.CounterAttack,
        value: 0 - counterAttackStrength(counterAttackers),
        faces: asTheyWere(counterAttackers)
    }
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
    taken: number[]
    oddBetween?: [number, number]
    excess: number
}

/** Spreads step losses over one or two units as evenly as their strengths allow (rule 11, steps 9 and 10). */
export function splitEvenly(strengths: number[], losses: number): EvenSplit {
    const taken = strengths.map(() => 0)
    const capacity = strengths.reduce((sum, strength) => sum + strength, 0)
    let remaining = Math.min(losses, capacity)
    const excess = losses - remaining
    while (remaining > 0) {
        const open = strengths.flatMap((strength, index) =>
            taken[index] < strength ? [index] : []
        )
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
