import { assertExists } from '@tabletop/common'
import { burnFavor } from './burn.js'
import { giveFavor, spendFavor, usableFavor } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { banditsRuleSite, isImperialPlayer, rulesSite } from './rule.js'
import { areEnemies, persistentsInPlay, type PersistentContext } from './persistent.js'
import { siteHolding } from './access.js'

// R-7.1.4 — "…unless they give favor to its ruler": the player lists each toll on the action.
export interface Toll {
    cardId: string
    /** Absent: burned, since the bandits rule the card. */
    payeeId?: string
    /** Way Station — paying makes the Travel free rather than merely allowed. */
    discount?: boolean
}

export type TollOccasion =
    | { kind: 'travel'; toSiteId: string }
    | { kind: 'trade'; cardId: string }
    | { kind: 'search' }

/** R-10.4 — "Give it to Chancellor if Empire, burn it if bandits". */
export function payeeFor(ctx: PersistentContext): string | undefined {
    const state = ctx.state
    if (ctx.ownerIds.length === 0) return undefined
    const imperial = ctx.ownerIds.some((id) => isImperialPlayer(state, id))
    if (imperial) return state.chancellorId()
    return ctx.ownerIds[0]
}

/** R-10.7 — everyone is an enemy of the bandits. */
export function enemyOfRuler(ctx: PersistentContext, actorId: string): boolean {
    if (ctx.ownerIds.length === 0) return !!ctx.siteId && banditsRuleSite(ctx.state, ctx.siteId)
    return ctx.ownerIds.some((owner) => areEnemies(ctx.state, owner, actorId))
}

export function rulerRulesSite(ctx: PersistentContext, siteId: string): boolean {
    if (ctx.ownerIds.length === 0) return banditsRuleSite(ctx.state, siteId)
    return ctx.ownerIds.some((owner) => rulesSite(ctx.state, owner, siteId))
}

export function rulerRulesCard(ctx: PersistentContext, cardId: string): boolean {
    const siteId = siteHolding(ctx.state, cardId)
    return siteId !== undefined && rulerRulesSite(ctx, siteId)
}

export function tollsFor(
    state: HydratedOathGameState,
    actorId: string,
    occasion: TollOccasion
): Toll[] {
    const tolls: Toll[] = []
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        let demanded = false
        let discount = false
        switch (occasion.kind) {
            case 'travel':
                demanded = hooks.tollToTravel?.(ctx, actorId, occasion.toSiteId) === true
                discount = hooks.travelFreeForToll?.(ctx, actorId, occasion.toSiteId) === true
                break
            case 'trade':
                demanded = hooks.tollToTrade?.(ctx, actorId, occasion.cardId) === true
                break
            case 'search':
                demanded = hooks.tollToSearch?.(ctx, actorId) === true
                break
        }
        if (demanded) tolls.push({ cardId: ctx.cardId, payeeId: payeeFor(ctx) })
        else if (discount)
            tolls.push({ cardId: ctx.cardId, payeeId: payeeFor(ctx), discount: true })
    }
    return tolls
}

export function reasonTollsUnpaid(
    state: HydratedOathGameState,
    actorId: string,
    occasion: TollOccasion,
    tolls: readonly string[] | undefined
): string | undefined {
    const listed = new Set(tolls ?? [])
    const available = tollsFor(state, actorId, occasion)
    for (const toll of available) {
        if (!toll.discount && !listed.has(toll.cardId)) {
            return `${toll.cardId}: you cannot ${describeOccasion(occasion)} unless you give a favor to ${toll.payeeId ? 'its ruler' : 'the bandits (burned)'}`
        }
    }
    for (const cardId of listed) {
        if (!available.some((t) => t.cardId === cardId)) return `${cardId} demands no toll here`
    }
    const usable = usableFavor(state, actorId)
    if (usable < listed.size) {
        return `the tolls take ${listed.size} favor and you have ${usable}`
    }
    return undefined
}

export function payTolls(
    state: HydratedOathGameState,
    actorId: string,
    occasion: TollOccasion,
    tolls: readonly string[] | undefined
): string[] {
    if (!tolls || tolls.length === 0) return []
    const available = tollsFor(state, actorId, occasion)
    const notes: string[] = []
    for (const cardId of new Set(tolls)) {
        const toll = available.find((t) => t.cardId === cardId)
        assertExists(toll, `${cardId} demands a toll here, as reasonTollsUnpaid checked`)
        if (toll.payeeId) {
            giveFavor(state, actorId, toll.payeeId, 1)
            notes.push(`${cardId}: gave a favor to ${toll.payeeId}`)
        } else {
            spendFavor(state, actorId, 1)
            burnFavor(state, 1)
            notes.push(`${cardId}: burned a favor for the bandits`)
        }
    }
    return notes
}

/** Way Station's other clause: free for whoever rules the card. */
export function wayStationRuled(
    state: HydratedOathGameState,
    actorId: string,
    toSiteId: string
): boolean {
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        if (!hooks.travelFreeForToll || ctx.siteId !== toSiteId) continue
        if (ctx.ownerIds.includes(actorId)) return true
    }
    return false
}

export function travelFreeByToll(
    state: HydratedOathGameState,
    actorId: string,
    toSiteId: string,
    tolls: readonly string[] | undefined
): boolean {
    return tollsFor(state, actorId, { kind: 'travel', toSiteId }).some(
        (t) => t.discount && (tolls ?? []).includes(t.cardId)
    )
}

function describeOccasion(occasion: TollOccasion): string {
    switch (occasion.kind) {
        case 'travel':
            return `travel to ${occasion.toSiteId}`
        case 'trade':
            return `trade with ${occasion.cardId}`
        case 'search':
            return 'search from here'
    }
}
