import { RecordedHistory, type GameAction } from '@tabletop/common'
import {
    AUSTERLITZ,
    isAssignLosses,
    isCounterAttack,
    isDeclareAttack,
    isRetreat,
    isThreatenAttack,
    type LocaleId,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import type { VisibleAttack } from './battleStage.js'
import { belongsToAnAttack } from './historyChapters.js'
import type { RecordedGame } from './moveReplay.js'

export interface ConcludedBattle {
    /** The threat that opened the attack, which names it. */
    openedBy: string
    /** The attack as it stood before its last action, with the results its actions recorded. */
    attack: VisibleAttack
    /** Every unit seen during the attack, as it was last seen. */
    units: ReadonlyMap<string, ProjectedUnit>
    /** Where the defenders went, when they retreated. */
    retreatedTo: LocaleId[]
    /** Whether the attacker's units now stand in the locale it attacked. */
    taken: boolean
}

/** The attack the latest action brought to an end, read back from the actions it was fought with. */
export function concludedBattleOf(game: RecordedGame): ConcludedBattle | undefined {
    const last = game.actions.at(-1)
    if (game.state.attack || !last || !belongsToAnAttack(last)) {
        return undefined
    }
    const openedAt = game.actions.findLastIndex((action) => isThreatenAttack(action))
    if (openedAt < 0) {
        return undefined
    }
    const fought = game.actions.slice(openedAt)
    const transitions = new RecordedHistory(game.state, fought).select((state) => ({
        attack: state.attack,
        units: state.units
    }))
    const units = new Map<string, ProjectedUnit>()
    let attack: VisibleAttack | undefined
    for (const action of fought) {
        const transition = transitions.get(action.id)
        for (const standing of [transition?.before, transition?.after]) {
            attack = standing?.attack ?? attack
            for (const unit of standing?.units ?? []) {
                units.set(unit.id, unit)
            }
        }
    }
    if (!attack || !transitions.get(fought[0].id)?.before) {
        return undefined
    }
    const attacked = AUSTERLITZ.approach(attack.defenseApproach).locale
    return {
        openedBy: fought[0].id,
        attack: settled(attack, fought),
        units,
        retreatedTo: [
            ...new Set(
                fought.flatMap((action) =>
                    isRetreat(action) ? Object.values(action.destinations) : []
                )
            )
        ],
        taken: game.state.units.some(
            (unit) => unit.playerId === attack.attackerId && unit.position?.locale === attacked
        )
    }
}

function settled(attack: VisibleAttack, fought: readonly GameAction[]): VisibleAttack {
    const result = { ...attack }
    for (const action of fought) {
        if (
            (isDeclareAttack(action) || isCounterAttack(action) || isAssignLosses(action)) &&
            action.metadata
        ) {
            result.initialResult = action.metadata.initialResult ?? result.initialResult
            result.finalResult = action.metadata.finalResult ?? result.finalResult
            result.attackerWon = action.metadata.attackerWon ?? result.attackerWon
        }
    }
    return result
}

/** How the attack that just ended came out, in a sentence. */
export function endingOf(
    battle: ConcludedBattle,
    attackerIsFrench: boolean,
    label: (locale: LocaleId) => string
): string {
    const fought = battle.attack
    const [attackers, defenders] = attackerIsFrench
        ? ['the French', 'the Allies']
        : ['the Allies', 'the French']
    const into = label(AUSTERLITZ.approach(fought.defenseApproach).locale)
    const retreated = battle.retreatedTo.map(label).join(' and ')
    if (fought.feint) {
        return sentence(`${attackers} called the attack off as a feint`)
    }
    if (fought.retreatBeforeCombat) {
        return sentence(
            `${defenders} fell back to ${retreated} before the attack`,
            battle.taken ? `${attackers} moved into ${into}` : undefined
        )
    }
    if (!fought.attackerWon) {
        return sentence(`${defenders} hold ${into}`)
    }
    if (retreated || battle.taken) {
        return sentence(
            retreated ? `${defenders} retreat to ${retreated}` : undefined,
            battle.taken ? `${attackers} take ${into}` : undefined
        )
    }
    return fought.artilleryLed
        ? sentence(`the guns have fired`, `${defenders} keep ${into}`)
        : sentence(`${defenders} keep ${into}`)
}

function sentence(...clauses: (string | undefined)[]): string {
    const said = clauses.filter((clause) => clause !== undefined).join(', and ')
    return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`
}
