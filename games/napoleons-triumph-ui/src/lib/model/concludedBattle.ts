import {
    AUSTERLITZ,
    Side,
    attackEndedBy,
    isRetreat,
    opposingSide,
    type EndedAttack,
    type LocaleId
} from '@tabletop/napoleons-triumph'
import { actionsOfTheLastAttack } from './attackForces.js'
import type { RecordedGame } from './moveReplay.js'

export interface ConcludedBattle {
    openedBy: string
    attack: EndedAttack
    retreatedTo: LocaleId[]
    taken: boolean
}

export function concludedBattleOf(game: RecordedGame): ConcludedBattle | undefined {
    const attack = attackEndedBy(game.actions.at(-1))
    if (!attack) {
        return undefined
    }
    const fought = actionsOfTheLastAttack(game.actions)
    if (!fought) {
        return undefined
    }
    const attacked = AUSTERLITZ.approach(attack.defenseApproach).locale
    return {
        openedBy: fought[0].id,
        attack,
        retreatedTo: [
            ...new Set(
                fought.flatMap((action) =>
                    isRetreat(action) ? Object.values(action.destinations) : []
                )
            )
        ],
        taken: [...game.state.units, ...game.state.commanders].some(
            (piece) => piece.playerId === attack.attackerId && piece.position?.locale === attacked
        )
    }
}

export const ARMIES: Record<Side, { name: string; adjective: string }> = {
    [Side.French]: { name: 'the French', adjective: 'French' },
    [Side.Allied]: { name: 'the Allies', adjective: 'Allied' }
}

export function endingOf(
    battle: ConcludedBattle,
    attackerSide: Side,
    label: (locale: LocaleId) => string
): string {
    const defenderSide = opposingSide(attackerSide)
    const attackers = ARMIES[attackerSide].name
    const defenders = ARMIES[defenderSide].name
    const fought = battle.attack
    const into = label(AUSTERLITZ.approach(fought.defenseApproach).locale)
    const retreated = battle.retreatedTo.map(label).join(' and ')
    const demoralized =
        fought.demoralizedId === undefined
            ? undefined
            : ARMIES[fought.demoralizedId === fought.attackerId ? attackerSide : defenderSide]
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
