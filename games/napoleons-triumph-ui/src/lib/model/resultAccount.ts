import type { GameAction } from '@tabletop/common'
import {
    ResultTermKind,
    UnitType,
    isCounterAttack,
    isDeclareAttack,
    type Attack,
    type Face,
    type ResultTerm
} from '@tabletop/napoleons-triumph'

export interface ResultAccounts {
    /** What the initial result is made of, where the game kept it. */
    initial?: ResultTerm[]
    /** What the counter-attack took from it; none when no counter-attack was made. */
    counter?: ResultTerm[]
}

/** The accounts kept by the declaration of the attack last declared and by the counter-attack that answered it. */
export function recordedAccounts(actions: readonly GameAction[]): ResultAccounts {
    const declaredAt = actions.findLastIndex((action) => isDeclareAttack(action))
    const declared = actions[declaredAt]
    if (!isDeclareAttack(declared) || !declared.metadata?.account) {
        return {}
    }
    const answer = actions.slice(declaredAt + 1).find((action) => isCounterAttack(action))
    if (!isCounterAttack(answer)) {
        return { initial: declared.metadata.account, counter: [] }
    }
    return { initial: declared.metadata.account, counter: answer.metadata?.account }
}

export enum AccountSide {
    Attack = 'attack',
    Defence = 'defence'
}

export interface AccountLine {
    text: string
    value: number
    /** The units the line counts, as they were when it counted them. */
    faces: Face[]
    side?: AccountSide
}

const TYPE_NAMES: Record<UnitType, string> = {
    [UnitType.Infantry]: 'infantry',
    [UnitType.Cavalry]: 'cavalry',
    [UnitType.Artillery]: 'artillery'
}

function lineOf(term: ResultTerm, leading: UnitType | undefined): AccountLine {
    const faces = term.faces ?? []
    const line = (text: string, side?: AccountSide) => ({ text, value: term.value, faces, side })
    switch (term.kind) {
        case ResultTermKind.AttackLeaders:
            return line(
                faces.length > 0 ? 'Leading the attack' : 'No unit leads the attack',
                AccountSide.Attack
            )
        case ResultTermKind.InfantryAgainstBlockers:
            return line('Infantry lead against an approach that is blocked')
        case ResultTermKind.ApproachPenalty:
            return line(
                `The approach penalises ${leading ? TYPE_NAMES[leading] : 'the leading units'}`
            )
        case ResultTermKind.DefenseLeaders:
            return line(
                faces.length > 0 ? 'Leading the defence' : 'No unit leads the defence',
                AccountSide.Defence
            )
        case ResultTermKind.GuardAttack:
            return line('A Guard Attack counts each of those under three strength as one less')
        case ResultTermKind.ArtilleryLeads:
            return line('Artillery leads, so the defence’s leading units are not counted')
        case ResultTermKind.CounterAttack:
            return line('Counter-attacking, at one less each', AccountSide.Defence)
    }
}

export function initialLines(terms: readonly ResultTerm[]): AccountLine[] {
    const leading = terms.find((term) => term.kind === ResultTermKind.AttackLeaders)?.faces?.[0]
        ?.type
    return terms.map((term) => lineOf(term, leading))
}

export function finalLines(initialResult: number, counter: readonly ResultTerm[]): AccountLine[] {
    const made = counter.filter((term) => (term.faces ?? []).length > 0)
    return [
        { text: 'Initial result', value: initialResult, faces: [] },
        ...(made.length > 0
            ? made.map((term) => lineOf(term, undefined))
            : [{ text: 'No counter-attack', value: 0, faces: [] }])
    ]
}

/** What decides a result of nothing either way (rule 11, step 9). */
export interface Fight {
    defendersBlocking: boolean
    attackingUnits: number
    defendingUnits: number
    attackerIsFrench: boolean
}

type Fought = Pick<Attack, 'defendersBlocking' | 'attackingUnitIds' | 'defendingUnitIds'>

export function fightOf(attack: Fought, attackerIsFrench: boolean): Fight {
    return {
        defendersBlocking: attack.defendersBlocking === true,
        attackingUnits: attack.attackingUnitIds.length,
        defendingUnits: attack.defendingUnitIds.length,
        attackerIsFrench
    }
}

export function attackSucceeds(finalResult: number, fight: Fight): boolean {
    if (finalResult !== 0) {
        return finalResult > 0
    }
    if (fight.defendersBlocking) {
        return false
    }
    return fight.attackingUnits === fight.defendingUnits
        ? fight.attackerIsFrench
        : fight.attackingUnits > fight.defendingUnits
}

export function verdictOf(finalResult: number, fight: Fight): string {
    const outcome = attackSucceeds(finalResult, fight) ? 'succeeds' : 'is thrown back'
    if (finalResult !== 0) {
        return `${finalResult > 0 ? 'Above' : 'Below'} zero, the attack ${outcome}.`
    }
    if (fight.defendersBlocking) {
        return `At zero the attack ${outcome}, because the defence blocks the approach.`
    }
    return fight.attackingUnits === fight.defendingUnits
        ? `At zero against a defence from reserve with as many units on each side, the French win, so the attack ${outcome}.`
        : `At zero against a defence from reserve the side with more units in the fight wins: ${fight.attackingUnits} attacking against ${fight.defendingUnits} defending, so the attack ${outcome}.`
}
