import { RecordedHistory, type GameAction } from '@tabletop/common'
import {
    AUSTERLITZ,
    Side,
    attackEndedBy,
    isAssignLosses,
    isCounterAttack,
    isDeclareAttack,
    isRetreat,
    isThreatenAttack,
    type EndedAttack,
    type LocaleId,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import type { RecordedGame } from './moveReplay.js'

export interface ConcludedBattle {
    openedBy: string
    attack: EndedAttack
    unitsLastSeen: ReadonlyMap<string, ProjectedUnit>
    retreatedTo: LocaleId[]
    taken: boolean
    demoralizedId?: string
}

export function concludedBattleOf(game: RecordedGame): ConcludedBattle | undefined {
    const attack = attackEndedBy(game.actions.at(-1))
    if (!attack) {
        return undefined
    }
    const fought = game.actions.slice(
        Math.max(
            0,
            game.actions.findLastIndex((action) => isThreatenAttack(action))
        )
    )
    const attacked = AUSTERLITZ.approach(attack.defenseApproach).locale
    return {
        openedBy: fought[0].id,
        attack,
        unitsLastSeen: unitsLastSeen(game, fought),
        retreatedTo: [
            ...new Set(
                fought.flatMap((action) =>
                    isRetreat(action) ? Object.values(action.destinations) : []
                )
            )
        ],
        taken: [...game.state.units, ...game.state.commanders].some(
            (piece) => piece.playerId === attack.attackerId && piece.position?.locale === attacked
        ),
        demoralizedId: fought.map((action) => demoralizedBy(action, attack)).find(Boolean)
    }
}

function unitsLastSeen(
    game: RecordedGame,
    fought: readonly GameAction[]
): Map<string, ProjectedUnit> {
    const transitions = new RecordedHistory(game.state, fought).select((state) => state.units)
    const units = new Map<string, ProjectedUnit>()
    for (const action of fought) {
        const transition = transitions.get(action.id)
        for (const unit of [...(transition?.before ?? []), ...(transition?.after ?? [])]) {
            units.set(unit.id, unit)
        }
    }
    return units
}

function demoralizedBy(action: GameAction, attack: EndedAttack): string | undefined {
    if (isRetreat(action)) {
        return action.metadata?.demoralized ? attack.defenderId : undefined
    }
    if (isDeclareAttack(action) || isCounterAttack(action) || isAssignLosses(action)) {
        return action.metadata?.demoralizedId
    }
    return undefined
}

const ARMIES: Record<Side, { name: string; adjective: string }> = {
    [Side.French]: { name: 'the French', adjective: 'French' },
    [Side.Allied]: { name: 'the Allies', adjective: 'Allied' }
}

export function endingOf(
    battle: ConcludedBattle,
    attackerSide: Side,
    label: (locale: LocaleId) => string
): string {
    const defenderSide = attackerSide === Side.French ? Side.Allied : Side.French
    const attackers = ARMIES[attackerSide].name
    const defenders = ARMIES[defenderSide].name
    const fought = battle.attack
    const into = label(AUSTERLITZ.approach(fought.defenseApproach).locale)
    const retreated = battle.retreatedTo.map(label).join(' and ')
    const demoralized =
        battle.demoralizedId === undefined
            ? undefined
            : ARMIES[battle.demoralizedId === fought.attackerId ? attackerSide : defenderSide]
    const outcome = (...clauses: (string | false)[]) =>
        sentence(
            clauses.filter((clause) => clause !== false),
            demoralized && `the ${demoralized.adjective} army is demoralized`
        )
    if (fought.feint) {
        return outcome(`${attackers} call the attack off as a feint`)
    }
    if (fought.retreatBeforeCombat) {
        return outcome(
            `${defenders} fall back to ${retreated} before the attack`,
            battle.taken && `${attackers} move into ${into}`
        )
    }
    if (!fought.attackerWon) {
        return outcome(`${defenders} hold ${into}`)
    }
    if (retreated || battle.taken) {
        return outcome(
            retreated !== '' && `${defenders} retreat to ${retreated}`,
            battle.taken && `${attackers} take ${into}`
        )
    }
    return outcome(
        fought.artilleryLed === true && 'the guns fire',
        !demoralized && `${defenders} keep ${into}`
    )
}

function sentence(clauses: string[], aftermath: string | undefined): string {
    const said = [clauses.join(', and '), aftermath].filter(Boolean).join('; ')
    return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`
}
