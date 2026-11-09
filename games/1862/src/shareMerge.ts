import {
    finiteCashOwnedBy,
    getCompany,
    settleCashPayments,
    type CashPayment,
    type Owner
} from '@tabletop/18xx'
import { assert, assertExists, turnOrderFrom } from '@tabletop/common'
import * as Type from 'typebox'
import { IpoPoolId, MarketPoolId, charterPoolId } from './pools.js'
import type { HydratedState1862, State1862 } from './state.js'

/**
 * A holder in a share merge: a player, or the companies involved acting as one, seated to the
 * initiator's right and acting for it (§5.2.4).
 */
export const CompanyHolder = 'company'
const Holder = Type.String({ minLength: 1 })

/** An option share awaiting its holder's choice: redeem at a cost, or give it up for a price. */
export const MergeOption = Type.Object(
    {
        holder: Holder,
        /** The survivor's certificate the option is, once it is one. */
        certificateId: Type.String({ minLength: 1 }),
        redeemCost: Type.Integer({ minimum: 0 }),
        sellValue: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type MergeOption = Type.Static<typeof MergeOption>

/** A 2:1 share merge in progress: a merger, an acquisition, or a refinancing (§5). */
export const ShareMerge = Type.Object(
    {
        kind: Type.Union([
            Type.Literal('merge'),
            Type.Literal('acquire'),
            Type.Literal('refinance')
        ]),
        initiatorId: Type.String({ minLength: 1 }),
        survivorId: Type.String({ minLength: 1 }),
        otherId: Type.Optional(Type.String({ minLength: 1 })),
        /** The share price options are valued at. */
        price: Type.Integer({ minimum: 0 }),
        /** Holders still to take their turn, next first. */
        holderIds: Type.Array(Holder),
        /** The other company's shares each holder still holds, as counts: they all leave play. */
        otherShares: Type.Record(Holder, Type.Integer({ minimum: 0 })),
        /**
         * The share each holder with an odd holding keeps as an option: one of the other
         * company's (`other`) or a survivor certificate.
         */
        oddOptions: Type.Record(Holder, Type.String({ minLength: 1 })),
        /** A director's certificate held as an option, valued by their holding (§5.2.4). */
        directorOption: Type.Optional(MergeOption),
        option: Type.Optional(MergeOption)
    },
    { additionalProperties: false }
)
export type ShareMerge = Type.Static<typeof ShareMerge>

function holderOwner(merge: ShareMerge, holder: string): Owner {
    return holder === CompanyHolder
        ? { kind: 'company', companyId: merge.survivorId }
        : { kind: 'player', playerId: holder }
}

/** Who decides for a holder: the player, or the initiator for the companies. */
export function holderPlayer(merge: ShareMerge, holder: string): string {
    return holder === CompanyHolder ? merge.initiatorId : holder
}

function involved(merge: ShareMerge, companyId: string): boolean {
    return companyId === merge.survivorId || companyId === merge.otherId
}

/** Whether the certificate belongs to the holder, the companies counting as one holder. */
function heldBy(
    merge: ShareMerge,
    certificate: State1862['certificates'][number],
    holder: string
): boolean {
    if (holder === CompanyHolder)
        return certificate.owner.kind === 'company' && involved(merge, certificate.owner.companyId)
    return certificate.owner.kind === 'player' && certificate.owner.playerId === holder
}

type Share = Extract<State1862['certificates'][number], { kind: 'share' }>

function survivorCertificates(state: State1862, merge: ShareMerge, holder: string): Share[] {
    return state.certificates.filter(
        (certificate): certificate is Share =>
            certificate.kind === 'share' &&
            certificate.companyId === merge.survivorId &&
            heldBy(merge, certificate, holder)
    )
}

function survivorShares(state: State1862, merge: ShareMerge, holder: string): number {
    return survivorCertificates(state, merge, holder).reduce((sum, c) => sum + c.shares, 0)
}

function pooledOrdinary(state: State1862, merge: ShareMerge): Share[] {
    return state.certificates.filter(
        (certificate): certificate is Share =>
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.companyId === merge.survivorId &&
            certificate.poolId === MarketPoolId
    )
}

function toPool(certificate: Share): void {
    certificate.owner = { kind: 'bank' }
    certificate.poolId = MarketPoolId
}

function toHolder(certificate: Share, owner: Owner): void {
    certificate.owner = { ...owner }
    if (owner.kind === 'company') certificate.poolId = charterPoolId(owner.companyId)
    else delete certificate.poolId
}

/** Players from the initiator clockwise, then the companies acting as one (§5.2.4). */
export function mergeHolders(state: State1862, initiatorId: string): string[] {
    return [...turnOrderFrom(state.turnManager.turnOrder, initiatorId), CompanyHolder]
}

type MergeStart = Pick<ShareMerge, 'kind' | 'initiatorId' | 'survivorId' | 'otherId' | 'price'>

/**
 * Starts a share merge: the involved companies' IPO shares go to the Bank Pool; a director
 * short of six merging shares exchanges their certificate; then every holder returns half its
 * shares at once, the other company's first, an odd holding keeping one share as an option
 * (§5.2.2, §5.2.4). The rest of each holder's turn follows in order.
 */
export function beginShareMerge(state: HydratedState1862, start: MergeStart): void {
    const merge: ShareMerge = {
        ...start,
        holderIds: [],
        otherShares: {},
        oddOptions: {}
    }
    for (const certificate of state.certificates)
        if (
            certificate.kind === 'share' &&
            involved(merge, certificate.companyId) &&
            certificate.poolId === IpoPoolId
        )
            toPool(certificate)
    const holders = mergeHolders(state, start.initiatorId)
    if (start.otherId)
        for (const holder of holders) {
            const count = state.certificates
                .filter(
                    (certificate): certificate is Share =>
                        certificate.kind === 'share' &&
                        certificate.companyId === start.otherId &&
                        heldBy(merge, certificate, holder)
                )
                .reduce((sum, certificate) => sum + certificate.shares, 0)
            if (count) merge.otherShares[holder] = count
        }
    const exchanged = holders.find((holder) => directorExchange(state, merge, holder))
    for (const holder of holders) if (holder !== exchanged) returnHalf(state, merge, holder)
    merge.holderIds = holders.filter(
        (holder) =>
            (merge.otherShares[holder] ?? 0) > 0 ||
            holder in merge.oddOptions ||
            merge.directorOption?.holder === holder
    )
    state.shareMerge = merge
}

const Tiers: Readonly<Record<number, readonly [redeem: number, sell: number]>> = {
    5: [0.5, 2.5],
    4: [1, 2],
    3: [1.5, 1.5]
}

/**
 * A survivor's director with fewer than six merging shares exchanges the director's certificate
 * for three ordinary shares from the Bank Pool; with none to take, they put their ordinary
 * shares of both companies into the pool and hold the certificate as an option, valued by their
 * holding. Returns whether the director's turn is that option alone (§5.2.4).
 */
function directorExchange(state: HydratedState1862, merge: ShareMerge, holder: string): boolean {
    if (holder === CompanyHolder) return false
    const held = survivorCertificates(state, merge, holder)
    const director = held.find((certificate) => certificate.president)
    const shares = survivorShares(state, merge, holder)
    if (!director || shares + (merge.otherShares[holder] ?? 0) >= 6) return false
    const pooled = pooledOrdinary(state, merge)
    if (pooled.length >= 3) {
        toPool(director)
        for (const certificate of pooled.slice(0, 3))
            toHolder(certificate, holderOwner(merge, holder))
        return false
    }
    for (const certificate of held) if (!certificate.president) toPool(certificate)
    delete merge.otherShares[holder]
    const [redeem, sell] = Tiers[shares] ?? [1.5, 1.5]
    merge.directorOption = {
        holder,
        certificateId: director.id,
        redeemCost: Math.floor(redeem * merge.price),
        sellValue: Math.floor(sell * merge.price)
    }
    return true
}

/** A holder returns half its shares, the other company's first; an odd holding keeps an option. */
function returnHalf(state: HydratedState1862, merge: ShareMerge, holder: string): void {
    const other = merge.otherShares[holder] ?? 0
    const total = other + survivorShares(state, merge, holder)
    const returning = Math.floor(total / 2)
    const fromOther = Math.min(other, returning)
    if (other - fromOther) merge.otherShares[holder] = other - fromOther
    else delete merge.otherShares[holder]
    const ordinary = survivorCertificates(state, merge, holder).filter((c) => !c.president)
    assert(returning - fromOther <= ordinary.length, 'A holder returns ordinary shares')
    for (const certificate of ordinary.slice(0, returning - fromOther)) toPool(certificate)
    if (total % 2 === 0) return
    const kept = survivorCertificates(state, merge, holder).find((c) => !c.president)
    if (merge.otherShares[holder]) merge.oddOptions[holder] = 'other'
    else if (kept) merge.oddOptions[holder] = kept.id
}

/**
 * The next holder's turn, up to any option it must decide: it swaps what it keeps of the other
 * company for survivor shares from the Bank Pool, the option last, and sells what it cannot
 * swap, an option at half the price rounded up (§5.2.4).
 */
export function takeMergeTurn(state: HydratedState1862): CashPayment[] {
    const merge = state.shareMerge
    assertExists(merge, 'A share merge is in progress')
    assert(!merge.option, 'An option awaits its holder')
    const holder = merge.holderIds.shift()
    assertExists(holder, 'A holder is to act')
    if (merge.directorOption?.holder === holder) {
        merge.option = merge.directorOption
        delete merge.directorOption
        return []
    }
    const owner = holderOwner(merge, holder)
    const odd = merge.oddOptions[holder]
    delete merge.oddOptions[holder]
    let other = merge.otherShares[holder] ?? 0
    delete merge.otherShares[holder]
    let optionId = odd && odd !== 'other' ? odd : undefined
    let optionLeft = odd === 'other'
    while (other > 0) {
        const share = pooledOrdinary(state, merge)[0]
        if (!share) break
        toHolder(share, owner)
        other--
        if (optionLeft && other === 0) {
            optionId = share.id
            optionLeft = false
        }
    }
    const payments: CashPayment[] = []
    const sold =
        (other - (optionLeft ? 1 : 0)) * merge.price + (optionLeft ? Math.ceil(merge.price / 2) : 0)
    if (sold > 0) payments.push({ from: { kind: 'bank' }, to: owner, amount: sold })
    if (optionId)
        merge.option = {
            holder,
            certificateId: optionId,
            redeemCost: Math.floor(merge.price / 2),
            sellValue: Math.floor(merge.price / 2)
        }
    settleCashPayments(state, payments)
    return payments
}

/** Whether the option's holder can pay to redeem it. */
export function canRedeemOption(state: State1862, merge: ShareMerge): boolean {
    const option = merge.option
    return (
        !!option && finiteCashOwnedBy(state, holderOwner(merge, option.holder)) >= option.redeemCost
    )
}

/** The holder redeems the option, paying for it, or gives it up to the pool for its price (§5.2.4). */
export function settleOption(state: HydratedState1862, redeem: boolean): CashPayment {
    const merge = state.shareMerge
    const option = merge?.option
    assertExists(merge, 'A share merge is in progress')
    assertExists(option, 'An option awaits its holder')
    assert(!redeem || canRedeemOption(state, merge), 'The holder can pay to redeem the option')
    const owner = holderOwner(merge, option.holder)
    const payment: CashPayment = redeem
        ? { from: owner, to: { kind: 'bank' }, amount: option.redeemCost }
        : { from: { kind: 'bank' }, to: owner, amount: option.sellValue }
    if (!redeem) {
        const certificate = state.certificates.find((entry) => entry.id === option.certificateId)
        assert(certificate?.kind === 'share', 'The option is a survivor share')
        toPool(certificate)
    }
    if (payment.amount) settleCashPayments(state, [payment])
    delete merge.option
    return payment
}

/**
 * Settles the survivor's directorship once every holder has acted: the player with the most
 * shares, ties to the initiator and then clockwise, if they hold three; otherwise no director
 * and the certificate in the pool (§5.2.5).
 */
export function settleDirector(state: HydratedState1862): string | undefined {
    const merge = state.shareMerge
    assertExists(merge, 'A share merge is in progress')
    const order = turnOrderFrom(state.turnManager.turnOrder, merge.initiatorId)
    const shares = (playerId: string) => survivorShares(state, merge, playerId)
    const best = Math.max(0, ...order.map(shares))
    const director = best >= 3 ? order.find((playerId) => shares(playerId) === best) : undefined
    const certificate = state.certificates.find(
        (entry): entry is Share =>
            entry.kind === 'share' && entry.companyId === merge.survivorId && !!entry.president
    )
    assertExists(certificate, 'The survivor has a director’s certificate')
    const previous = certificate.owner
    const company = getCompany(state, merge.survivorId)
    const directorOwner = director ? ({ kind: 'player', playerId: director } as const) : undefined
    const holdsIt =
        directorOwner && previous.kind === 'player' && previous.playerId === directorOwner.playerId
    if (!holdsIt) {
        // The certificate changes hands for three ordinary shares, from the new director or
        // the pool, to its previous holder or the pool.
        const giver = directorOwner
            ? survivorCertificates(state, merge, directorOwner.playerId).filter((c) => !c.president)
            : pooledOrdinary(state, merge)
        const taker: Owner = certificate.poolId === MarketPoolId ? { kind: 'bank' } : previous
        for (const share of giver.slice(0, 3)) {
            if (taker.kind === 'bank') toPool(share)
            else toHolder(share, taker)
        }
        if (directorOwner) toHolder(certificate, directorOwner)
        else toPool(certificate)
    }
    if (directorOwner) company.president = directorOwner
    else delete company.president
    return director
}
