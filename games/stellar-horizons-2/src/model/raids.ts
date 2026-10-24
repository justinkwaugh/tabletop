import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { RAID_RESULTS, RaidResult, raidDamage, raidResult } from '../components/combatTables.js'
import { TECH_FIELDS, TechField } from '../components/techFields.js'
import { TradeGood } from '../components/tradeGoods.js'
import { currentCombatOf } from './combat.js'
import { modifierTotal, playerRollModifiers, tunnelModifiers } from './combatRolls.js'
import { capabilitiesOf, damageCapacity, freeCargo, isFast, loseShipNow } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import {
    type Combat,
    CombatSide,
    type RaidOutcome,
    type RaidRoll,
    type ShipState
} from './pieces.js'
import { discardGoods } from './pools.js'
import { removeBaseSettlement } from './settling.js'
import { GOOD_CASH } from './trade.js'

// A raid (rulebook 1.3 and 6.1): a die, with the Praetorians' and Military Academy's +1 and the
// victim's Hypersonic Missiles and Tunnel Complex taking 1 off, and percentiles for the damage.
export function rollRaid(state: HydratedStellarHorizonsGameState, combat: Combat): RaidRoll {
    const random = state.getProtectedPrng()
    const die = random.dieRoll(10)
    const modifiers = [
        ...playerRollModifiers(state, combat.attackerId, ['combatRoll']),
        ...playerRollModifiers(state, combat.defenderId, ['opponentAssaultRaidRoll']),
        ...tunnelModifiers(state, combat, combat.defenderId)
    ]
    const raid = {
        die,
        modifiers,
        total: die + modifierTotal(modifiers),
        percentile: random.dieRoll(100)
    }
    combat.raid = raid
    return raid
}

export type RaidChoice = Type.Static<typeof RaidChoice>
export const RaidChoice = Type.Object({
    result: Type.Enum(RaidResult),
    field: Type.Optional(Type.Enum(TechField)),
    good: Type.Optional(Type.Enum(TradeGood)),
    stolen: Type.Optional(Type.Boolean())
})

function raider(state: HydratedStellarHorizonsGameState, combat: Combat): ShipState {
    const [shipId] = combat.forces[CombatSide.Attacker].shipIds
    return state.ship(shipId)
}

// The results the raider may take: the one rolled, or with the Syndicate any lower one, each
// with its choice of marker type or good. A result that cannot apply has no effect.
export function raidChoices(state: HydratedStellarHorizonsGameState): RaidChoice[] {
    const combat = currentCombatOf(state)
    const raid = combat.raid
    assertExists(raid, 'The raid has not been rolled')
    const rolled = raidResult(raid.total)
    const results = capabilitiesOf(state, combat.attackerId).lowersRaidResult
        ? RAID_RESULTS.slice(0, RAID_RESULTS.indexOf(rolled) + 1)
        : [rolled]
    const victim = state.getPlayerState(combat.defenderId)
    const base = state.base(combat.defenderId, combat.systemId)
    return results.flatMap((result): RaidChoice[] => {
        switch (result) {
            case RaidResult.StealMarker: {
                const fields = TECH_FIELDS.filter((field) => victim.techMarkers[field].length > 0)
                return fields.length > 0 ? fields.map((field) => ({ result, field })) : [{ result }]
            }
            case RaidResult.TakeGood: {
                const goods = [...new Set(base?.goods ?? [])]
                const room = freeCargo(state, raider(state, combat)) > 0
                return goods.length > 0
                    ? goods.flatMap((good) => [
                          ...(room ? [{ result, good, stolen: true }] : []),
                          { result, good, stolen: false }
                      ])
                    : [{ result }]
            }
            default:
                return [{ result }]
        }
    })
}

export function sameRaidChoice(a: RaidChoice, b: RaidChoice): boolean {
    return (
        a.result === b.result && a.field === b.field && a.good === b.good && a.stolen === b.stolen
    )
}

export function isValidRaidChoice(state: HydratedStellarHorizonsGameState, choice: RaidChoice) {
    return raidChoices(state).some((candidate) => sameRaidChoice(candidate, choice))
}

// Rulebook 6.1's results, then the raider's damage from the percentile roll.
export function resolveRaid(
    state: HydratedStellarHorizonsGameState,
    choice: RaidChoice
): RaidOutcome {
    const combat = currentCombatOf(state)
    const raid = combat.raid
    assertExists(raid, 'The raid has not been rolled')
    const victim = state.getPlayerState(combat.defenderId)
    const thief = state.getPlayerState(combat.attackerId)
    const ship = raider(state, combat)
    let cash = 0
    let marker: number | undefined
    let effective = false
    switch (choice.result) {
        case RaidResult.StealCash:
        case RaidResult.StealMoreCash: {
            cash = Math.min(victim.cash, choice.result === RaidResult.StealCash ? 1 : 2)
            victim.cash -= cash
            thief.cash += cash
            effective = cash > 0
            break
        }
        case RaidResult.StealMarker: {
            if (choice.field !== undefined) {
                const markers = victim.techMarkers[choice.field]
                const [value] = markers.splice(state.getProtectedPrng().randInt(markers.length), 1)
                thief.techMarkers[choice.field].push(value)
                marker = value
                effective = true
            }
            break
        }
        case RaidResult.TakeGood: {
            const base = state.base(combat.defenderId, combat.systemId)
            if (choice.good !== undefined && base) {
                base.goods.splice(base.goods.indexOf(choice.good), 1)
                if (choice.stolen) {
                    ship.goods.push(choice.good)
                } else {
                    discardGoods(state, combat.defenderId, [choice.good])
                    thief.cash += GOOD_CASH
                    cash = GOOD_CASH
                }
                effective = true
            }
            break
        }
        case RaidResult.DestroySettlement: {
            const base = state.base(combat.defenderId, combat.systemId)
            if (base && base.settlements > 1) {
                removeBaseSettlement(state, combat.defenderId, combat.systemId)
                combat.defenderLosses.settlements += 1
                effective = true
            }
            break
        }
    }
    const damage = raidDamage(raid.percentile, isFast(state, ship))
    ship.damage += damage
    const lost = ship.damage >= damageCapacity(state, ship) ? loseShipNow(state, ship) : undefined
    const outcome: RaidOutcome = {
        result: choice.result,
        lowered: choice.result !== raidResult(raid.total),
        effective,
        cash,
        ...(choice.field !== undefined ? { field: choice.field } : {}),
        ...(marker !== undefined ? { marker } : {}),
        ...(choice.good !== undefined ? { good: choice.good, stolen: choice.stolen === true } : {}),
        damage,
        ...(lost ? { lost } : {})
    }
    combat.raidOutcome = outcome
    return outcome
}
