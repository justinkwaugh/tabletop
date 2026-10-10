import { Visibility, type GameAction } from '@tabletop/common'
import {
    CommandKind,
    FeintEnd,
    Side,
    UnitType,
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
    isEndTurn,
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
    type Face,
    type MoveOrder,
    type Position
} from '@tabletop/napoleons-triumph'

export interface ActionDescriptionContext {
    map: BattleMap
    sideOf: (playerId: string | undefined) => Side | undefined
}

const ARMY: Record<Side, string> = {
    [Side.French]: 'The French',
    [Side.Allied]: 'The Allies'
}

const TYPE_NAMES: Record<UnitType, string> = {
    [UnitType.Infantry]: 'infantry',
    [UnitType.Cavalry]: 'cavalry',
    [UnitType.Artillery]: 'artillery'
}

function place(map: BattleMap, locale: number): string {
    return map.locale(locale).name ?? `locale ${locale}`
}

function standing(map: BattleMap, position: Position): string {
    if (position.approach === undefined) {
        return place(map, position.locale)
    }
    const facing = place(map, map.approach(position.approach).neighbour)
    return `the approach at ${place(map, position.locale)} facing ${facing}`
}

function count(units: number): string {
    return units === 1 ? 'a unit' : `${units} units`
}

function force(order: MoveOrder): string {
    if (order.kind === CommandKind.Corps && order.commanderId) {
        return `${commanderDefinition(order.commanderId).name}’s corps`
    }
    if (order.kind === CommandKind.Detach && order.commanderId) {
        return `${count(order.unitIds.length)} detached by ${commanderDefinition(order.commanderId).name}`
    }
    return 'a unit'
}

export function describeFace(face: Face): string {
    const kind = face.guard ? 'Guard infantry' : TYPE_NAMES[face.type]
    return `${face.strength}-strength ${kind}`
}

function signed(value: number): string {
    return value > 0 ? `+${value}` : String(value)
}

function combat(metadata: CombatMetadata | undefined, context: ActionDescriptionContext): string {
    if (!metadata) {
        return ''
    }
    const parts: string[] = []
    if (metadata.finalResult !== undefined && metadata.attackerWon !== undefined) {
        parts.push(
            `Final result ${signed(metadata.finalResult)}: the attack ${metadata.attackerWon ? 'succeeds' : 'is thrown back'}.`
        )
    }
    const steps = metadata.losses.reduce((sum, loss) => sum + loss.steps, 0)
    if (steps > 0) {
        const destroyed = metadata.losses.filter((loss) => loss.eliminated).length
        parts.push(
            `${steps} step${steps === 1 ? '' : 's'} lost${destroyed > 0 ? `, ${count(destroyed)} destroyed` : ''}.`
        )
    }
    const loser = context.sideOf(metadata.loserId)
    if (loser && metadata.moraleLost) {
        parts.push(`${ARMY[loser]} lose ${metadata.moraleLost} morale.`)
    }
    const broken = context.sideOf(metadata.demoralizedId)
    if (broken) {
        parts.push(`${ARMY[broken]} are demoralized.`)
    }
    return parts.join(' ')
}

/** What an action did, from its input and recorded result alone. Empty when there is nothing to tell. */
export function describeAction(action: GameAction, context: ActionDescriptionContext): string {
    const side = context.sideOf(action.playerId)
    const army = side ? ARMY[side] : 'A player'
    const { map } = context
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
        const arrives = from ? '' : ' onto the field'
        const way = action.order.road ? 'marches by road' : 'moves'
        const origin = from ? ` from ${standing(map, from)}` : ''
        const gain = action.metadata?.frenchMoraleGain
        const morale = gain ? ` French morale rises by ${gain}.` : ''
        const shown = action.metadata?.revealed ? ' It is shown to be cavalry.' : ''
        return `${army}: ${force(action.order)} ${way}${arrives}${origin} to ${standing(map, action.to)}.${shown}${morale}`
    }
    if (isAttach(action)) {
        return `${army}: ${commanderDefinition(action.commanderId).name} takes a unit into the corps.`
    }
    if (isThreatenAttack(action)) {
        const approach = map.approach(action.approach)
        const kind = action.guardUnitId ? 'a Guard Attack' : 'an attack'
        return `${army} threaten ${kind} on ${place(map, approach.neighbour)} from ${place(map, approach.locale)}.`
    }
    if (isDeclareDefense(action)) {
        return `${army} stand with ${count(action.unitIds.length)}.`
    }
    if (isRetreat(action)) {
        const from = action.metadata ? place(map, action.metadata.fromLocale) : 'the locale'
        const steps = action.metadata?.losses.reduce((sum, loss) => sum + loss.steps, 0) ?? 0
        const cost = steps > 0 ? `, losing ${steps} step${steps === 1 ? '' : 's'} and as much morale` : ''
        const when = action.metadata?.beforeCombat ? ' without a fight' : ''
        const broken = action.metadata?.demoralized ? ` ${army} are demoralized.` : ''
        return `${army} retreat from ${from}${when}${cost}.${broken}`
    }
    if (isPressAttack(action)) {
        return `${army} press the attack; the defense leading units are shown.`
    }
    if (isDeclareFeint(action)) {
        const stance = action.end === FeintEnd.Approach ? 'on the approach' : 'in reserve'
        return `${army}: the attack by ${action.orders.map(force).join(' and ')} is a feint, ending ${stance}.`
    }
    if (isDeclareAttack(action)) {
        const led = action.leaderIds.length === 0 ? 'with no leading unit' : `led by ${count(action.leaderIds.length)}`
        const width = action.wide ? 'a wide' : 'a narrow'
        const initial = action.metadata?.initialResult
        const result = initial === undefined ? '' : ` Initial result ${signed(initial)}.`
        return `${army} make ${width} attack with ${action.orders.map(force).join(' and ')}, ${led}.${result} ${combat(action.metadata, context)}`.trim()
    }
    if (isCounterAttack(action)) {
        const opening =
            action.unitIds.length === 0
                ? `${army} do not counter-attack.`
                : `${army} counter-attack with ${count(action.unitIds.length)}.`
        return `${opening} ${combat(action.metadata, context)}`.trim()
    }
    if (isAssignLosses(action)) {
        return `${army} assign losses. ${combat(action.metadata, context)}`.trim()
    }
    if (isRegroup(action)) {
        return `${army} regroup after the repulse.`
    }
    if (isAdvance(action)) {
        return `${army} bring ${count(action.unitIds.length)} up to block the approach.`
    }
    if (isOccupy(action)) {
        return action.artilleryStays
            ? `${army} show their guns and hold them in place.`
            : `${army} move into the abandoned locale with ${action.orders.map(force).join(' and ')}.`
    }
    if (isEndTurn(action)) {
        return `${army} end their turn.`
    }
    return ''
}
