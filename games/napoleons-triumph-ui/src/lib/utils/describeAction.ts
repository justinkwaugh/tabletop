import { Visibility, type GameAction } from '@tabletop/common'
import {
    CommandKind,
    FeintEnd,
    MoralePenaltyKind,
    Side,
    commanderDefinition,
    isAdvance,
    isAssignLosses,
    isAttach,
    isChooseSide,
    isCounterAttack,
    isDeclareAttack,
    isDeclareDefense,
    isDeclareFeint,
    isDeployArmy,
    isAcknowledgeReveal,
    isEndTurn,
    isLeadDefense,
    isMove,
    isOccupy,
    isPassBid,
    isPlaceBid,
    isPressAttack,
    isRegroup,
    isRetreat,
    isThreatenAttack,
    type BattleMap,
    type CombatMetadata,
    type HydratedNapoleonsTriumphGameState,
    type MoralePenalty,
    type MoveOrder,
    type Position
} from '@tabletop/napoleons-triumph'
import { signed } from './signed.js'
import { corpsName } from './groupNames.js'

type DescribedGame = Pick<HydratedNapoleonsTriumphGameState, 'map' | 'findPlayerState'>

function sideOf(game: DescribedGame, playerId: string | undefined): Side | undefined {
    return playerId === undefined ? undefined : game.findPlayerState(playerId)?.side
}

const ARMY: Record<Side, string> = {
    [Side.French]: 'The French',
    [Side.Allied]: 'The Allies'
}

function armyOf(game: DescribedGame, playerId: string | undefined): string {
    const side = sideOf(game, playerId)
    return side ? ARMY[side] : 'A player'
}

function standing(map: BattleMap, position: Position): string {
    if (position.approach === undefined) {
        return map.label(position.locale)
    }
    const facing = map.label(map.approach(position.approach).neighbour)
    return `the approach at ${map.label(position.locale)} facing ${facing}`
}

function count(units: number): string {
    return units === 1 ? 'a unit' : `${units} units`
}

const UNIT_OF: Record<Side, string> = {
    [Side.French]: 'a French unit',
    [Side.Allied]: 'an Allied unit'
}

function force(order: MoveOrder, armyToName?: Side): string {
    if (order.kind === CommandKind.Corps && order.commanderId) {
        return corpsName(order.commanderId)
    }
    if (order.kind === CommandKind.Detach && order.commanderId) {
        return `${count(order.unitIds.length)} detached by ${commanderDefinition(order.commanderId).name}`
    }
    return armyToName ? UNIT_OF[armyToName] : 'a unit'
}

function sentence(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function penalty({ playerId, kind, moraleLost }: MoralePenalty, game: DescribedGame): string {
    const army = armyOf(game, playerId)
    const cost = moraleLost > 0 ? ` and lose ${moraleLost} morale` : ''
    switch (kind) {
        case MoralePenaltyKind.GuardCommitted:
            return `${army} commit the Guard${cost}.`
        case MoralePenaltyKind.HeavyCavalryCommitted:
            return `${army} commit their heavy cavalry${cost}.`
        case MoralePenaltyKind.GuardAttackDefeated:
            return `The Guard Attack is defeated. ${army} ${moraleLost > 0 ? `lose ${moraleLost} more morale and ` : ''}may make no more Guard Attacks.`
    }
}

function penalties(
    all: readonly MoralePenalty[] | undefined,
    game: DescribedGame,
    paidAfterLosses: boolean
): string[] {
    return (all ?? [])
        .filter(
            (entry) => (entry.kind === MoralePenaltyKind.GuardAttackDefeated) === paidAfterLosses
        )
        .map((entry) => penalty(entry, game))
}

function combat(metadata: CombatMetadata | undefined, game: DescribedGame): string {
    if (!metadata) {
        return ''
    }
    const parts: string[] = penalties(metadata.penalties, game, false)
    if (metadata.finalResult !== undefined && metadata.attackerWon !== undefined) {
        parts.push(
            `Final result ${signed(metadata.finalResult)}: the attack ${metadata.attackerWon ? 'succeeds' : 'is defeated'}.`
        )
    }
    const steps = metadata.losses.reduce((sum, loss) => sum + loss.steps, 0)
    if (steps > 0) {
        const destroyed = metadata.losses.filter((loss) => loss.eliminated).length
        parts.push(
            `${steps} step${steps === 1 ? '' : 's'} lost${destroyed > 0 ? `, ${count(destroyed)} destroyed` : ''}.`
        )
    }
    const loser = sideOf(game, metadata.loserId)
    if (loser && metadata.moraleLost) {
        parts.push(`${ARMY[loser]} lose ${metadata.moraleLost} morale.`)
    }
    parts.push(...penalties(metadata.penalties, game, true))
    const broken = sideOf(game, metadata.demoralizedId)
    if (broken) {
        parts.push(`${ARMY[broken]} are demoralized.`)
    }
    return parts.join(' ')
}

export function describeAction(action: GameAction, game: DescribedGame): string {
    const side = sideOf(game, action.playerId)
    const army = armyOf(game, action.playerId)
    const { map } = game
    if (Visibility.isRedactedAction(action) || isDeployArmy(action)) {
        return `${army} deploy their army.`
    }
    if (isPlaceBid(action)) {
        return `A bid of ${action.amount} morale for the choice of army.`
    }
    if (isPassBid(action)) {
        return 'A pass in the morale auction.'
    }
    if (isChooseSide(action)) {
        return `The auction winner takes ${action.side === Side.French ? 'the French' : 'the Allied'} army.`
    }
    if (isMove(action)) {
        const from = action.metadata?.from
        const { order } = action
        const journey = `${from ? ` from ${standing(map, from)}` : ' onto the field'} to ${standing(map, action.to)}`
        const gain = action.metadata?.frenchMoraleGain
        const morale = gain ? ` French morale rises by ${gain}.` : ''
        const shown = action.metadata?.revealed ? ' It is shown to be cavalry.' : ''
        const movement =
            order.kind === CommandKind.Detach && order.commanderId
                ? `${commanderDefinition(order.commanderId).name} detaches ${count(order.unitIds.length)}${journey}`
                : `${force(order, side)} ${order.road ? 'marches by road' : 'moves'}${journey}`
        return `${sentence(movement)}.${shown}${morale}`
    }
    if (isAttach(action)) {
        return `${commanderDefinition(action.commanderId).name} takes a unit into the corps.`
    }
    if (isThreatenAttack(action)) {
        const approach = map.approach(action.approach)
        const kind = action.guardUnitId ? 'a Guard Attack' : 'an attack'
        return `${army} threaten ${kind} on ${map.label(approach.neighbour)} from ${map.label(approach.locale)}.`
    }
    if (isDeclareDefense(action)) {
        const commanders = (action.commanderIds ?? []).map((id) => commanderDefinition(id).name)
        const withCommanders = commanders.length > 0 ? ` and ${commanders.join(' and ')}` : ''
        return `${army} stand with ${count(action.unitIds.length)}${withCommanders}.`
    }
    if (isRetreat(action)) {
        const from = action.metadata ? map.label(action.metadata.fromLocale) : 'the locale'
        const steps = action.metadata?.losses.reduce((sum, loss) => sum + loss.steps, 0) ?? 0
        const cost =
            steps > 0 ? `, losing ${steps} step${steps === 1 ? '' : 's'} and as much morale` : ''
        const when = action.metadata?.beforeCombat ? ' without a fight' : ''
        const committed = penalties(action.metadata?.penalties, game, false)
            .map((text) => ` ${text}`)
            .join('')
        const broken = action.metadata?.demoralized ? ` ${army} are demoralized.` : ''
        return `${army} retreat from ${from}${when}${cost}.${committed}${broken}`
    }
    if (isPressAttack(action)) {
        return `${army} press the attack.`
    }
    if (isLeadDefense(action)) {
        return action.leaderIds.length === 0
            ? `${army} name no leading unit.`
            : `${army} lead the defence with ${count(action.leaderIds.length)}, now shown.`
    }
    if (isDeclareFeint(action)) {
        const stance = action.end === FeintEnd.Approach ? 'on the approach' : 'in reserve'
        const feinting = action.orders.map((order) => force(order, side)).join(' and ')
        return `The attack by ${feinting} is a feint, ending ${stance}.`
    }
    if (isDeclareAttack(action)) {
        const led =
            action.leaderIds.length === 0
                ? 'with no leading unit'
                : `led by ${count(action.leaderIds.length)}`
        const width = action.wide ? 'a wide' : 'a narrow'
        const initial = action.metadata?.initialResult
        const result = initial === undefined ? '' : ` Initial result ${signed(initial)}.`
        const attacking = action.orders.map((order) => force(order)).join(' and ')
        return `${army} make ${width} attack with ${attacking}, ${led}.${result} ${combat(action.metadata, game)}`.trim()
    }
    if (isCounterAttack(action)) {
        const opening =
            action.unitIds.length === 0
                ? `${army} do not counter-attack.`
                : `${army} counter-attack with ${count(action.unitIds.length)}.`
        return `${opening} ${combat(action.metadata, game)}`.trim()
    }
    if (isAssignLosses(action)) {
        return `${army} assign losses. ${combat(action.metadata, game)}`.trim()
    }
    if (isRegroup(action)) {
        return `${army} regroup after their defeat.`
    }
    if (isAdvance(action)) {
        return `${army} bring ${count(action.unitIds.length)} up to block the approach.`
    }
    if (isOccupy(action)) {
        return action.artilleryStays
            ? `${army} show their artillery and hold it in place.`
            : `${army} move into the abandoned locale with ${action.orders.map((order) => force(order)).join(' and ')}.`
    }
    if (isEndTurn(action)) {
        return `${army} end their turn.`
    }
    if (isAcknowledgeReveal(action)) {
        return `${army} see the enemy cavalry still riding when the last turn ended.`
    }
    return ''
}
