import { EscalationMarker, escalationDefinition } from '@tabletop/stellar-horizons-2'

export function escalationName(marker: EscalationMarker): string {
    const { effects, text } = escalationDefinition(marker)
    return effects.points === undefined ? text : `${effects.points} VP`
}

export function escalationList(markers: readonly EscalationMarker[]): string {
    return markers.length === 0 ? 'nothing' : markers.map(escalationName).join(', ')
}

const M = EscalationMarker

// The two lines a marker's face shows at chip size; the printed text is its tooltip.
export const ESCALATION_FACE: Record<EscalationMarker, readonly [string, string] | undefined> = {
    [M.Points1]: undefined,
    [M.Points2]: undefined,
    [M.Points3]: undefined,
    [M.Points4]: undefined,
    [M.Points5]: undefined,
    [M.EarthCash]: ['Earth', '−$2B'],
    [M.NoAttack]: ['Can’t', 'attack'],
    [M.Initiative20]: ['Init.', '−20%'],
    [M.Initiative30]: ['Init.', '−30%'],
    [M.Initiative40]: ['Init.', '−40%'],
    [M.SettlementCost1]: ['Settle', '+$1B'],
    [M.SettlementCost2]: ['Settle', '+$2B'],
    [M.SaleCost1]: ['Sales', '−$1B'],
    [M.SaleCost2]: ['Sales', '−$2B'],
    [M.Migration20]: ['Migr.', '−20%'],
    [M.Migration30]: ['Migr.', '−30%'],
    [M.EarthEngineering]: ['Earth', '+1 Eng'],
    [M.EarthPhysics]: ['Earth', '+1 Phy']
}
