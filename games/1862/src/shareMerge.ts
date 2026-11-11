import {
    President,
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
 * A holder in a share merge: a player, or the companies involved acting as one through the
 * survivor's treasury, seated to the initiator's right and acting for it (§5.2.4).
 */
export const MergeHolder = President
export type MergeHolder = President

const Id = Type.String({ minLength: 1 })

/** An option share awaiting its holder's choice: redeem at a cost, or give it up for a price. */
export const MergeOption = Type.Object(
    {
        holder: MergeHolder,
        /** The survivor's certificate the option is, once it is one. */
        certificateId: Id,
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
        initiatorId: Id,
        survivorId: Id,
        otherId: Type.Optional(Id),
        /** The share price options are valued at. */
        price: Type.Integer({ minimum: 0 }),
        /**
         * The other company's shares holders yet to take their turn still hold: they all leave
         * play.
         */
        otherShares: Type.Array(
            Type.Object(
                { holder: MergeHolder, shares: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            )
        ),
        /**
         * The share each holder with an odd holding keeps as an option until its turn: one of
         * the other company's, or a survivor certificate.
         */
        oddOptions: Type.Array(
            Type.Object(
                {
                    holder: MergeHolder,
                    share: Type.Union([
                        Type.Object(
                            { kind: Type.Literal('other') },
                            { additionalProperties: false }
                        ),
                        Type.Object(
                            { kind: Type.Literal('survivor'), certificateId: Id },
                            { additionalProperties: false }
                        )
                    ])
                },
                { additionalProperties: false }
            )
        ),
        /** A director's certificate held as an option, valued by their holding (§5.2.4). */
        directorOption: Type.Optional(MergeOption),
        option: Type.Optional(MergeOption)
    },
    { additionalProperties: false }
)
export type ShareMerge = Type.Static<typeof ShareMerge>

type OddOption = ShareMerge['oddOptions'][number]

export function sameHolder(a: MergeHolder, b: MergeHolder): boolean {
    return a.kind === 'player'
        ? b.kind === 'player' && a.playerId === b.playerId
        : b.kind === 'company' && a.companyId === b.companyId
}

/** Who decides for a holder: the player, or the initiator for the companies. */
export function holderPlayer(merge: ShareMerge, holder: MergeHolder): string {
    return holder.kind === 'company' ? merge.initiatorId : holder.playerId
}

function otherSharesOf(merge: ShareMerge, holder: MergeHolder): number {
    return merge.otherShares.find((entry) => sameHolder(entry.holder, holder))?.shares ?? 0
}

function setOtherShares(merge: ShareMerge, holder: MergeHolder, shares: number): void {
    merge.otherShares = [
        ...merge.otherShares.filter((entry) => !sameHolder(entry.holder, holder)),
        ...(shares > 0 ? [{ holder, shares }] : [])
    ]
}

function oddOptionOf(merge: ShareMerge, holder: MergeHolder): OddOption['share'] | undefined {
    return merge.oddOptions.find((entry) => sameHolder(entry.holder, holder))?.share
}

/** Whether the holder has a turn still to take: shares to swap or sell, or an option. */
function awaitsTurn(merge: ShareMerge, holder: MergeHolder): boolean {
    return (
        otherSharesOf(merge, holder) > 0 ||
        !!oddOptionOf(merge, holder) ||
        (!!merge.directorOption && sameHolder(merge.directorOption.holder, holder))
    )
}

function involved(merge: ShareMerge, companyId: string): boolean {
    return companyId === merge.survivorId || companyId === merge.otherId
}

/** Whether the certificate belongs to the holder, the companies counting as one holder. */
function heldBy(
    merge: ShareMerge,
    certificate: State1862['certificates'][number],
    holder: MergeHolder
): boolean {
    if (holder.kind === 'company')
        return certificate.owner.kind === 'company' && involved(merge, certificate.owner.companyId)
    return certificate.owner.kind === 'player' && certificate.owner.playerId === holder.playerId
}

type Share = Extract<State1862['certificates'][number], { kind: 'share' }>

function survivorCertificates(state: State1862, merge: ShareMerge, holder: MergeHolder): Share[] {
    return state.certificates.filter(
        (certificate): certificate is Share =>
            certificate.kind === 'share' &&
            certificate.companyId === merge.survivorId &&
            heldBy(merge, certificate, holder)
    )
}

function survivorShares(state: State1862, merge: ShareMerge, holder: MergeHolder): number {
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
export function mergeHolders(
    state: State1862,
    merge: Pick<ShareMerge, 'initiatorId' | 'survivorId'>
): MergeHolder[] {
    return [
        ...turnOrderFrom(state.turnManager.turnOrder, merge.initiatorId).map(
            (playerId): MergeHolder => ({ kind: 'player', playerId })
        ),
        { kind: 'company', companyId: merge.survivorId }
    ]
}

/** The holder whose turn is next, in holder order, once any option is decided (§5.2.4). */
export function nextMergeHolder(state: State1862, merge: ShareMerge): MergeHolder | undefined {
    return mergeHolders(state, merge).find((holder) => awaitsTurn(merge, holder))
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
        otherShares: [],
        oddOptions: []
    }
    for (const certificate of state.certificates)
        if (
            certificate.kind === 'share' &&
            involved(merge, certificate.companyId) &&
            certificate.poolId === IpoPoolId
        )
            toPool(certificate)
    const holders = mergeHolders(state, start)
    if (start.otherId)
        for (const holder of holders)
            setOtherShares(
                merge,
                holder,
                state.certificates
                    .filter(
                        (certificate): certificate is Share =>
                            certificate.kind === 'share' &&
                            certificate.companyId === start.otherId &&
                            heldBy(merge, certificate, holder)
                    )
                    .reduce((sum, certificate) => sum + certificate.shares, 0)
            )
    const exchanged = holders.find((holder) => directorExchange(state, merge, holder))
    for (const holder of holders)
        if (!exchanged || !sameHolder(holder, exchanged)) returnHalf(state, merge, holder)
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
function directorExchange(
    state: HydratedState1862,
    merge: ShareMerge,
    holder: MergeHolder
): boolean {
    if (holder.kind === 'company') return false
    const held = survivorCertificates(state, merge, holder)
    const director = held.find((certificate) => certificate.president)
    const shares = survivorShares(state, merge, holder)
    if (!director || shares + otherSharesOf(merge, holder) >= 6) return false
    const pooled = pooledOrdinary(state, merge)
    if (pooled.length >= 3) {
        toPool(director)
        for (const certificate of pooled.slice(0, 3)) toHolder(certificate, holder)
        return false
    }
    for (const certificate of held) if (!certificate.president) toPool(certificate)
    setOtherShares(merge, holder, 0)
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
function returnHalf(state: HydratedState1862, merge: ShareMerge, holder: MergeHolder): void {
    const other = otherSharesOf(merge, holder)
    const total = other + survivorShares(state, merge, holder)
    const returning = Math.floor(total / 2)
    const fromOther = Math.min(other, returning)
    setOtherShares(merge, holder, other - fromOther)
    const ordinary = survivorCertificates(state, merge, holder).filter((c) => !c.president)
    assert(returning - fromOther <= ordinary.length, 'A holder returns ordinary shares')
    for (const certificate of ordinary.slice(0, returning - fromOther)) toPool(certificate)
    if (total % 2 === 0) return
    const kept = survivorCertificates(state, merge, holder).find((c) => !c.president)
    const share: OddOption['share'] | undefined = otherSharesOf(merge, holder)
        ? { kind: 'other' }
        : kept
          ? { kind: 'survivor', certificateId: kept.id }
          : undefined
    if (share) merge.oddOptions.push({ holder, share })
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
    const holder = nextMergeHolder(state, merge)
    assertExists(holder, 'A holder is to act')
    if (merge.directorOption && sameHolder(merge.directorOption.holder, holder)) {
        merge.option = merge.directorOption
        delete merge.directorOption
        return []
    }
    const odd = oddOptionOf(merge, holder)
    merge.oddOptions = merge.oddOptions.filter((entry) => !sameHolder(entry.holder, holder))
    let other = otherSharesOf(merge, holder)
    setOtherShares(merge, holder, 0)
    let optionId = odd?.kind === 'survivor' ? odd.certificateId : undefined
    let optionLeft = odd?.kind === 'other'
    while (other > 0) {
        const share = pooledOrdinary(state, merge)[0]
        if (!share) break
        toHolder(share, holder)
        other--
        if (optionLeft && other === 0) {
            optionId = share.id
            optionLeft = false
        }
    }
    const payments: CashPayment[] = []
    const sold =
        (other - (optionLeft ? 1 : 0)) * merge.price + (optionLeft ? Math.ceil(merge.price / 2) : 0)
    if (sold > 0) payments.push({ from: { kind: 'bank' }, to: holder, amount: sold })
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
    return !!option && finiteCashOwnedBy(state, option.holder) >= option.redeemCost
}

/** The holder redeems the option, paying for it, or gives it up to the pool for its price (§5.2.4). */
export function settleOption(state: HydratedState1862, redeem: boolean): CashPayment {
    const merge = state.shareMerge
    const option = merge?.option
    assertExists(merge, 'A share merge is in progress')
    assertExists(option, 'An option awaits its holder')
    assert(!redeem || canRedeemOption(state, merge), 'The holder can pay to redeem the option')
    const owner = option.holder
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
    const shares = (playerId: string) => survivorShares(state, merge, { kind: 'player', playerId })
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
            ? survivorCertificates(state, merge, directorOwner).filter((c) => !c.president)
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
