import { assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import arcane from './denizens.arcane.data.js'
import beast from './denizens.beast.data.js'
import discord from './denizens.discord.data.js'
import hearth from './denizens.hearth.data.js'
import nomad from './denizens.nomad.data.js'
import order from './denizens.order.data.js'
import relics from './relics.data.js'
import visions from './visions.data.js'

export enum PowerTiming {
    /** R-7.3.1 */
    Wake = 'wake',
    /** R-7.3.2 */
    Action = 'action',
    /** R-7.3.3 */
    WhenPlayed = 'whenPlayed',
    /** R-7.3.4 */
    Rest = 'rest',
    /** R-7.4 */
    Modifier = 'modifier',
    /** R-7.5 */
    BattlePlan = 'battlePlan',
    /** R-7.1.4 — the black braided box; ignores access and is never used by anyone. */
    Persistent = 'persistent',
    /** R-7.1.4-H1 — always-on without the black braid, so not persistent. */
    Continuous = 'continuous'
}

/** R-7.5 */
export enum BattlePlanSide {
    Attacker = 'attacker',
    Defender = 'defender',
    Either = 'either'
}

/** R-7.1.2, R-10.4 — placing and burning have different destinations, so four counts. */
export interface PowerCost {
    placeFavor: number
    burnFavor: number
    placeSecret: number
    burnSecret: number
}

export const NO_COST: PowerCost = Object.freeze({
    placeFavor: 0,
    burnFavor: 0,
    placeSecret: 0,
    burnSecret: 0
})

export function isFree(cost: PowerCost): boolean {
    return (
        cost.placeFavor === 0 &&
        cost.burnFavor === 0 &&
        cost.placeSecret === 0 &&
        cost.burnSecret === 0
    )
}

export interface CardPower extends PowerUseKey {
    timing: PowerTiming
    text: string
    /** R-7.1.2 */
    cost: PowerCost
    /** R-7.4 */
    modifiesAction?: ActionType
    /** R-7.5 */
    battlePlanSide?: BattlePlanSide
}

// R-7.4 — declared at the start of the major action, so `search` is Search, not SearchResolve.
const MODIFIABLE_ACTIONS = {
    search: ActionType.Search,
    muster: ActionType.Muster,
    trade: ActionType.Trade,
    recover: ActionType.Recover,
    campaign: ActionType.Campaign,
    travel: ActionType.Travel
} as const

const TIMING_BY_NAME: Readonly<Record<`${PowerTiming}`, PowerTiming>> = {
    wake: PowerTiming.Wake,
    action: PowerTiming.Action,
    whenPlayed: PowerTiming.WhenPlayed,
    rest: PowerTiming.Rest,
    modifier: PowerTiming.Modifier,
    battlePlan: PowerTiming.BattlePlan,
    persistent: PowerTiming.Persistent,
    continuous: PowerTiming.Continuous
}
const SIDE_BY_NAME: Readonly<Record<`${BattlePlanSide}`, BattlePlanSide>> = {
    attacker: BattlePlanSide.Attacker,
    defender: BattlePlanSide.Defender,
    either: BattlePlanSide.Either
}

/** R-7.1.4 — persistent and continuous powers are never used, so R-7.1.2 cannot charge them. */
export function isUsableTiming(timing: PowerTiming): boolean {
    return timing !== PowerTiming.Persistent && timing !== PowerTiming.Continuous
}

export function isPersistent(power: CardPower): boolean {
    return power.timing === PowerTiming.Persistent
}

export interface PowerRecord {
    powerText?: string
    timing?: `${PowerTiming}` | `${PowerTiming}`[] | null
    persistent?: boolean
    modifiesAction?: keyof typeof MODIFIABLE_ACTIONS | null
    battlePlanSide?: `${BattlePlanSide}` | null
    cost?: PowerCost
}

function recordTimings(rec: PowerRecord): PowerTiming[] {
    if (rec.timing === undefined || rec.timing === null) return []
    const names = Array.isArray(rec.timing) ? rec.timing : [rec.timing]
    return names.map((name) => TIMING_BY_NAME[name])
}

function recordPowerTexts(cardId: string, rec: PowerRecord, timingCount: number): string[] {
    const powerText = rec.powerText ?? ''
    const texts = timingCount === 1 ? [powerText] : powerText.split('\n')
    if (texts.length !== timingCount) {
        throw Error(
            `${cardId}: ${timingCount} timings but powerText splits into ${texts.length} ` +
                `lines — a multi-power record must print one line per power, in order`
        )
    }
    return texts
}

function recordModifiedAction(rec: PowerRecord): ActionType | undefined {
    return rec.modifiesAction ? MODIFIABLE_ACTIONS[rec.modifiesAction] : undefined
}

function recordBattlePlanSide(rec: PowerRecord): BattlePlanSide | undefined {
    return rec.battlePlanSide ? SIDE_BY_NAME[rec.battlePlanSide] : undefined
}

export function parsePowers(cardId: string, rec: PowerRecord): CardPower[] {
    const timings = recordTimings(rec)
    // The four Oath Visions print a goal and no power box (R-4.1.2).
    if (timings.length === 0 || (rec.powerText ?? '').trim() === '') return []

    const texts = recordPowerTexts(cardId, rec, timings.length)
    const recordCost = rec.cost ?? NO_COST
    const modifies = recordModifiedAction(rec)
    const side = recordBattlePlanSide(rec)

    return timings.map((timing, index) => {
        const power: CardPower = {
            cardId,
            powerIndex: index,
            timing,
            text: texts[index].trim(),
            // R-7.1.2 — a multi-power record's cost goes to its usable power.
            cost: timings.length === 1 || isUsableTiming(timing) ? recordCost : NO_COST
        }
        if (modifies) power.modifiesAction = modifies
        // R-7.5 — the side describes the crowned box only.
        if (side && timing === PowerTiming.BattlePlan) power.battlePlanSide = side
        return power
    })
}

const byCard = new Map<string, CardPower[]>()

for (const shard of [arcane, beast, discord, hearth, nomad, order, relics, visions]) {
    for (const rec of shard) {
        byCard.set(rec.id, parsePowers(rec.id, rec))
    }
}

/** R-11.9 — the one site that prints an Action: The Tribunal's negotiation. */
export const TRIBUNAL_ID = 'site.the-tribunal'
byCard.set(TRIBUNAL_ID, [
    {
        cardId: TRIBUNAL_ID,
        powerIndex: 0,
        timing: PowerTiming.Action,
        text: 'If you rule this site or your pawn is here, negotiate a binding exchange of favor and secrets with any player.',
        cost: NO_COST
    }
])

export function cardPowers(cardId: string): CardPower[] {
    return byCard.get(cardId) ?? []
}

export function cardPower(cardId: string, index: number): CardPower | undefined {
    return cardPowers(cardId)[index]
}

export function powersWithTiming(cardId: string, timing: PowerTiming): CardPower[] {
    return cardPowers(cardId).filter((p) => p.timing === timing)
}

export type PowerUseKey = { cardId: string; powerIndex: number }

export function powerKey(cardId: string, powerIndex: number): string {
    return `${cardId}#${powerIndex}`
}

export function powerIndexOf(cardId: string, timing: PowerTiming): number {
    const power = powersWithTiming(cardId, timing)[0]
    assertExists(power, `${cardId} prints no ${timing} power`)
    return power.powerIndex
}

export function allPowersWithTiming(timing: PowerTiming): CardPower[] {
    return [...byCard.values()].flat().filter((p) => p.timing === timing)
}

export function allPowers(): CardPower[] {
    return [...byCard.values()].flat()
}

export function registerCardPowers(cardId: string, powers: CardPower[]): void {
    byCard.set(
        cardId,
        powers.map((p, index) => ({ ...p, cardId, powerIndex: index }))
    )
}
