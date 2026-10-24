import {
    RaidResult,
    anomalyDefinition,
    cardDefinition,
    combatValue,
    damageCapacity,
    shipDefinition,
    sideOwner,
    titleDefinition,
    type Combat,
    type CombatLoss,
    type CombatSide,
    type HitTarget,
    type HydratedStellarHorizonsGameState,
    type ModifierSource,
    type RaidChoice,
    type RaidOutcome,
    type RaidRoll,
    type RollModifier,
    type ShipState,
    type SideRoll
} from '@tabletop/stellar-horizons-2'
import { RAID_RESULT_LABELS, factionName, markersText, plural } from './presentation.js'
import { goodName } from './trade.js'

export interface CombatUnit {
    target: HitTarget
    name: string
    detail: string
    ship?: ShipState
}

// The units still fighting on a side: its ships, then its base.
export function combatUnits(
    state: HydratedStellarHorizonsGameState,
    combat: Combat,
    side: CombatSide
): CombatUnit[] {
    const force = combat.forces[side]
    const ships = force.shipIds.flatMap((shipId): CombatUnit[] => {
        const ship = state.findShip(shipId)
        if (!ship) {
            return []
        }
        const definition = shipDefinition(shipId)
        return [
            {
                target: { kind: 'Ship', shipId },
                name: definition.name,
                detail: `Combat ${combatValue(state, ship)} · ${ship.damage} of ${damageCapacity(state, ship)} damage`,
                ship
            }
        ]
    })
    const settlements = force.base
        ? state.base(sideOwner(combat, side), combat.systemId)?.settlements
        : undefined
    return settlements === undefined
        ? ships
        : [
              ...ships,
              { target: { kind: 'Base' }, name: 'Base', detail: `${settlements} settlements` }
          ]
}

// A combat is known by its attacker and system in a decade: one combat per system each.
export interface CombatRef {
    year: number
    attackerId: string
    systemId: string
}

export function combatRef(year: number, combat: Combat): CombatRef {
    return { year, attackerId: combat.attackerId, systemId: combat.systemId }
}

export function sameCombat(a: CombatRef | undefined, b: CombatRef | undefined): boolean {
    return (
        a !== undefined &&
        b !== undefined &&
        a.year === b.year &&
        a.attackerId === b.attackerId &&
        a.systemId === b.systemId
    )
}

export function modifierSourceName(source: ModifierSource): string {
    switch (source.kind) {
        case 'Faction':
            return factionName(source.faction)
        case 'Card':
            return cardDefinition(source.cardId).name
        case 'Anomaly':
            return anomalyDefinition(source.anomalyId).name
        case 'Title':
            return titleDefinition(source.titleId).name
    }
}

function signed(value: number): string {
    const rounded = Math.round(value * 10) / 10
    return rounded >= 0 ? `+ ${rounded}` : `− ${-rounded}`
}

function modifierParts(modifiers: readonly RollModifier[]): string[] {
    return modifiers.map(
        (modifier) => `${signed(modifier.value)} (${modifierSourceName(modifier.source)})`
    )
}

// "6 + 0.2 (CVs) + 0.3 (settlements) + 1 (The Praetorians) = 8": the die, the tenths for the
// enemy's CVs and settlements, and each named modifier, rounded once.
export function rollText(roll: SideRoll): string {
    const parts = [
        `${roll.die}`,
        ...(roll.enemyShips !== 0 ? [`${signed(roll.enemyShips)} (CVs)`] : []),
        ...(roll.enemySettlements !== 0 ? [`${signed(roll.enemySettlements)} (settlements)`] : []),
        ...modifierParts(roll.modifiers)
    ]
    return parts.length > 1 ? `${parts.join(' ')} = ${roll.total}` : `${roll.total}`
}

// "7 + 1 (The Praetorians) − 1 (Hypersonic Missiles) = 7", or the die alone.
export function raidRollText(raid: RaidRoll): string {
    const parts = [`${raid.die}`, ...modifierParts(raid.modifiers)]
    return parts.length > 1 ? `${parts.join(' ')} = ${raid.total}` : `${raid.total}`
}

// "Steal a tech marker (physics)", "Take Ore into the hold" or "Destroy Ore for $1B".
export function raidChoiceLabel(choice: RaidChoice): string {
    if (choice.good !== undefined) {
        return choice.stolen
            ? `Take ${goodName(choice.good)} into the hold`
            : `Destroy ${goodName(choice.good)} for $1B`
    }
    const field = choice.field !== undefined ? ` (${choice.field.toLowerCase()})` : ''
    return `${RAID_RESULT_LABELS[choice.result]}${field}`
}

// "Sapphire is destroyed, with 1 settlement aboard (1 biology marker and 1 engineering marker
// in compensation)".
export function lossText(loss: CombatLoss): string {
    const compensation = [
        ...loss.markers
            .filter((entry) => entry.values.length > 0)
            .map((entry) => markersText(entry.field, entry.values.length)),
        ...(loss.cash ? [`$${loss.cash}B`] : [])
    ]
    const cargo = loss.settlementsLost
        ? `, with ${plural(loss.settlementsLost, 'settlement')} aboard`
        : ''
    return `${shipDefinition(loss.shipId).name} is destroyed${cargo}${compensation.length ? ` (${compensation.join(' and ')} in compensation)` : ''}`
}

export function raidOutcomeText(outcome: RaidOutcome): string {
    const effect = !outcome.effective
        ? `${RAID_RESULT_LABELS[outcome.result]} has no effect`
        : outcome.result === RaidResult.StealMarker
          ? `steals a ${outcome.field?.toLowerCase()} marker (${outcome.marker})`
          : outcome.result === RaidResult.TakeGood && outcome.good
            ? outcome.stolen
                ? `takes ${goodName(outcome.good)} into its hold`
                : `destroys ${goodName(outcome.good)} for $${outcome.cash}B`
            : outcome.result === RaidResult.DestroySettlement
              ? 'destroys a settlement'
              : `steals $${outcome.cash}B`
    const lowered = outcome.lowered ? ' (lowered by the Syndicate)' : ''
    const damage = outcome.lost
        ? `; ${lossText(outcome.lost)}`
        : outcome.damage
          ? `; the raider takes ${outcome.damage} damage`
          : ''
    return `The raid ${effect}${lowered}${damage}.`
}
