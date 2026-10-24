import {
    AnomalyChallenge,
    DirectiveAttack,
    DirectiveProduction,
    DirectiveStatus,
    DirectiveType,
    SOL_SYSTEM_ID,
    directiveDefinition,
    directiveTotal,
    directivesWith,
    type DirectiveCondition,
    type FulfilledDirective,
    type HydratedStellarHorizonsGameState
} from '@tabletop/stellar-horizons-2'
import type { GameAction } from '@tabletop/common'
import { plural, systemName } from './presentation.js'
import { goodName } from './trade.js'

export const DIRECTIVE_TYPE_LABELS: Record<DirectiveType, string> = {
    [DirectiveType.Anomaly]: 'Anomaly',
    [DirectiveType.Combat]: 'Combat',
    [DirectiveType.Production]: 'Production',
    [DirectiveType.Survey]: 'Survey',
    [DirectiveType.Trade]: 'Trade',
    [DirectiveType.Terraform]: 'Terraform'
}

// The printed headers' colours (`notes/vassal-inventory.md`, appendix C.1).
export const DIRECTIVE_TYPE_COLORS: Record<DirectiveType, string> = {
    [DirectiveType.Anomaly]: '#a77bd8',
    [DirectiveType.Combat]: '#e0603f',
    [DirectiveType.Production]: '#a7aeb8',
    [DirectiveType.Survey]: '#7cc4ef',
    [DirectiveType.Trade]: '#e8c14a',
    [DirectiveType.Terraform]: '#6cc46a'
}

function place(systemId: string): string {
    return systemId === SOL_SYSTEM_ID ? 'on Earth' : `at ${systemName(systemId)}`
}

function classList(classes: readonly string[]): string {
    return classes.length === 1
        ? classes[0]
        : `${classes.slice(0, -1).join(', ')} or ${classes.at(-1)}`
}

// The condition as printed: "Resolve a combat anomaly of 7+ difficulty".
export function directiveText(condition: DirectiveCondition): string {
    switch (condition.kind) {
        case DirectiveType.Anomaly:
            return `Resolve a ${condition.challenge === AnomalyChallenge.Combat ? 'combat' : 'science'} anomaly of ${condition.difficulty}+ difficulty`
        case DirectiveType.Combat:
            return condition.attack === DirectiveAttack.Raid
                ? 'Raid a base of the Player with the most settlements (other than you)'
                : condition.attack === DirectiveAttack.FleetCombat
                  ? 'Start a fleet combat against the Player with the most settlements (other than you)'
                  : 'Blockade a base of the Player with the most settlements (other than you)'
        case DirectiveType.Production:
            return condition.production === DirectiveProduction.MiningCash
                ? `Earn $${condition.amount}B using mining ships`
                : condition.production === DirectiveProduction.ResearchMarkers
                  ? `Earn ${plural(condition.amount, 'tech marker')} using research ships`
                  : `Earn $${condition.amount}B cash from base production`
        case DirectiveType.Survey:
            return `Complete a survey at ${systemName(condition.systemId)}`
        case DirectiveType.Trade:
            return `Sell ${condition.good ? `${condition.count} ${goodName(condition.good)}` : plural(condition.count, 'trade good')} ${place(condition.systemId)}`
        case DirectiveType.Terraform:
            return `Terraform a world into ${classList(condition.classes)}-class`
    }
}

// How far this turn's totals have come toward a directive that adds up over the turn.
export function directiveProgress(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    directiveId: string
): string | undefined {
    const condition = directiveDefinition(directiveId).condition
    const total = directiveTotal(state.getPlayerState(playerId).turnRecord, condition)
    if (!total) {
        return undefined
    }
    if (condition.kind === DirectiveType.Trade) {
        return `${total.done} of ${total.needed} sold this turn`
    }
    return condition.kind === DirectiveType.Production &&
        condition.production !== DirectiveProduction.ResearchMarkers
        ? `$${total.done}B of $${total.needed}B this turn`
        : `${total.done} of ${total.needed} this turn`
}

// The faction's goal as printed: "4 anomaly or survey", or "5 of any type".
export function goalTypes(types: readonly DirectiveType[]): string {
    return types.length === 0
        ? 'of any type'
        : types.map((type) => DIRECTIVE_TYPE_LABELS[type].toLowerCase()).join(' or ')
}

export function heldDirectiveIds(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    status: DirectiveStatus
): (string | undefined)[] {
    return directivesWith(state.getPlayerState(playerId), status).map((held) => held.directiveId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function isFulfilled(value: unknown): value is FulfilledDirective {
    return (
        isRecord(value) &&
        typeof value.playerId === 'string' &&
        typeof value.directiveId === 'string' &&
        typeof value.year === 'number'
    )
}

// The directives an action fulfilled, which every Action that can fulfil one names in its
// metadata's `directives`.
export function fulfilledIn(action: GameAction): FulfilledDirective[] {
    const metadata: unknown = 'metadata' in action ? action.metadata : undefined
    return isRecord(metadata) && Array.isArray(metadata.directives)
        ? metadata.directives.filter(isFulfilled)
        : []
}
