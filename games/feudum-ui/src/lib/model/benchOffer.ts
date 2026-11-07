import {
    alchemistTradeOffers,
    AlchemistPullGoods,
    AlchemistPushInventions,
    farmerTradeOffers,
    FarmerPushGoods,
    feastFunction,
    feastPreview,
    Goods,
    guildActionPreview,
    GuildById,
    inventionGoods,
    inventionOffers,
    knightTradeOffer,
    KnightPushMarkers,
    marketHolds,
    merchantTradeOffers,
    MerchantPullGoods,
    MerchantPushGoods,
    MerchantTradeGoods,
    nobleTradeOffer,
    NoblePullMarkers,
    NoblePushSeals,
    reasonFeastRefused,
    reasonGuildActionRefused,
    rowsToScrollsOffer,
    Seals,
    type CardPlayInput,
    type CompletionCount,
    type Good,
    type GuildFunctionName,
    type GuildFunctionParams,
    type GuildFunctionPreview,
    type GuildId,
    type HydratedFeudumGameState,
    type InventionChoice,
    type MonsterId,
    type PaymentSplit,
    type PotSplit,
    type ScrollSpaceId,
    type SpaceId,
    type VesselType
} from '@tabletop/feudum'
import { guildTarget, spaceTarget, type ChipNote } from './boardOffer.js'
import type { FlowPick, FlowPopup, PanelChoice } from './cardFlows.js'
import { primaryLabel } from './confirmingSend.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

/** One press on the bench. Goods and inventions repeat; a row or a scroll goes once. */
export type BenchPick =
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'invention'; readonly invention: InventionChoice }
    | { readonly kind: 'vessel'; readonly vessel: VesselType }
    | { readonly kind: 'row'; readonly row: number }
    | { readonly kind: 'scroll'; readonly spaceId: ScrollSpaceId }

/** What the seat has staged on the bench; the draft holds these. */
export interface BenchStages {
    readonly farm?: SpaceId
    readonly takeFood?: number
    readonly take?: true
    readonly monster?: MonsterId | 'none'
    readonly deploy?: SpaceId
    readonly picks: readonly BenchPick[]
    readonly sulfur?: number
    readonly count?: CompletionCount
}

/** What a bench press does; each is one staged press. */
export interface BenchPresser {
    picks(picks: readonly BenchPick[]): void
    take(): void
    monster(monster: MonsterId | 'none'): void
    deploy(spaceId: SpaceId): void
    farm(spaceId: SpaceId): void
    split(takeFood: number): void
    sulfur(toBarrel: number): void
    count(count: CompletionCount): void
}

export interface BenchSeat {
    readonly state: HydratedFeudumGameState
    readonly playerId: string
    readonly nameOf: (playerId: string) => string
    readonly input: CardPlayInput
}

/** R-4.6, R-3.16.3 What either way of performing a function can read. */
export type BenchPreview = GuildFunctionPreview & {
    readonly refused?: string
    readonly feastPoints?: number
}

/** The function on the bench, performed by a Guild card or a Feast. */
export interface BenchSource {
    readonly guildId: GuildId
    readonly fn: GuildFunctionName
    readonly feast?: { readonly spaceId: SpaceId; readonly opponentId: string }
    previewOf(params: GuildFunctionParams): BenchPreview | undefined
    reasonOf(params: GuildFunctionParams): string | undefined
}

/** A panel row whose press takes no draft: the bench's presses are closures. */
export interface BenchChoice extends PanelChoice {
    readonly press?: () => void
}

export type BenchItemRole = 'lit' | 'picked' | 'dimmed'

/** One thing on the bench. Its press goes through the session, as any panel row's does. */
export interface BenchItem extends BenchChoice {
    readonly id: string
    /** Which of the offer's `areas` it sits in. */
    readonly area: number
    readonly role: BenchItemRole
    /** How many more of it the area holds. */
    readonly count?: number
}

/** A picked item drawn where it would land. `at` is a board space, or a place the bench names. */
export interface BenchGhost {
    readonly item: string
    readonly at: string
    readonly count?: number
}

export interface BenchResult {
    /** Points and writs, or the price, with the warning a send that can't be undone carries. */
    readonly line: string
    readonly moved?: string
    readonly payment?: string
    readonly split?: string
    readonly reeve?: string
}

export interface BenchOffer {
    readonly title: string
    /** Trade: its guild. Pull: from-guild, guild. Push: guild, to-guild. */
    readonly areas: readonly GuildId[]
    readonly line?: string
    /** Set while a map pick is open: the bench closes down to this header. */
    readonly collapsed?: string
    readonly items: readonly BenchItem[]
    readonly ghosts: readonly BenchGhost[]
    readonly result?: BenchResult
    readonly count?: readonly BenchChoice[]
    /** R-4.10.2 How much of a sulfur bought goes in the barrel. */
    readonly rows: readonly BenchChoice[]
    readonly popup?: FlowPopup
    readonly map?: readonly FlowPick[]
    readonly primary: TurnPrimary
    /** The last press finishes the function, so it sends rather than asks. */
    readonly fixed: boolean
    readonly completes: boolean
    readonly params: GuildFunctionParams
    readonly preview?: BenchPreview
    readonly refused?: string
}

const VesselSpace = 'vessel-space'
const SeatPlace = 'seat'
const RosaryPlace = 'rosary'

export function knightRowPlace(colour: string): string {
    return `knight-row:${colour}`
}

function words(id: string): string {
    return id.replaceAll('-', ' ')
}

function titled(line: string): string {
    return `${line.charAt(0).toUpperCase()}${line.slice(1)}`
}

function plural(count: number, one: string): string {
    return `${count} ${one}${count === 1 ? '' : 's'}`
}

/** R-4.6.1 A pick's params: the function reads its own. */
export function paramsOf(stages: BenchStages): GuildFunctionParams {
    const { farm, takeFood, monster, deploy, picks, sulfur, count } = stages
    const goods = picks.flatMap((pick) => (pick.kind === 'good' ? [pick.good] : []))
    const inventions = picks.flatMap((pick) => (pick.kind === 'invention' ? [pick.invention] : []))
    const rows = picks.flatMap((pick) => (pick.kind === 'row' ? [pick.row] : []))
    const scrolls = picks.flatMap((pick) => (pick.kind === 'scroll' ? [pick.spaceId] : []))
    const vessel = picks.flatMap((pick) => (pick.kind === 'vessel' ? [pick.vessel] : [])).at(-1)
    return {
        ...(farm ? { farmSpaceId: farm } : {}),
        ...(takeFood !== undefined ? { takeFood } : {}),
        ...(goods.length > 0 ? { goods } : {}),
        ...(sulfur !== undefined ? { sulfurToBarrel: sulfur } : {}),
        ...(count ? { count } : {}),
        ...(vessel ? { vesselType: vessel } : {}),
        ...(inventions.length > 0 ? { inventions } : {}),
        ...(monster && monster !== 'none' ? { monster } : {}),
        ...(deploy ? { deploySpaceId: deploy } : {}),
        ...(rows.length > 0 ? { knightRows: rows } : {}),
        ...(scrolls.length > 0 ? { scrollSpaces: scrolls } : {})
    }
}

/** R-3.16, R-4.6 A Guild card's function. */
export function guildBenchSource(
    { state, playerId, input }: BenchSeat,
    guildId: GuildId,
    fn: GuildFunctionName
): BenchSource {
    const inputOf = (params: GuildFunctionParams) => ({ ...input, guildId, fn, params })
    return {
        guildId,
        fn,
        previewOf: (params) => guildActionPreview(state, playerId, inputOf(params)),
        reasonOf: (params) => reasonGuildActionRefused(state, playerId, inputOf(params))
    }
}

/** R-3.16.3 A Feast's function: the opponent's own, by their rank. No rank, no bench. */
export function feastBenchSource(
    { state, playerId, input }: BenchSeat,
    {
        spaceId,
        opponentId,
        guildId
    }: { readonly spaceId: SpaceId; readonly opponentId: string; readonly guildId: GuildId }
): BenchSource | undefined {
    const fn = feastFunction(state, opponentId, guildId)
    if (!fn) {
        return undefined
    }
    const inputOf = (params: GuildFunctionParams) => ({
        ...input,
        spaceId,
        opponentId,
        guildId,
        params
    })
    return {
        guildId,
        fn,
        feast: { spaceId, opponentId },
        previewOf: (params) => feastPreview(state, playerId, inputOf(params)),
        reasonOf: (params) => reasonFeastRefused(state, playerId, inputOf(params))
    }
}

/** One thing a function may move, before the logic says whether it can go next. */
interface Candidate {
    readonly pick: BenchPick
    readonly label: string
    readonly area: number
    readonly note?: ChipNote
    readonly count?: number
}

interface BenchRow {
    /** R-4.6-H5 "Move up to 3". */
    readonly line?: (seat: BenchSeat) => string
    readonly candidates?: (
        seat: BenchSeat,
        stages: BenchStages,
        source: BenchSource
    ) => readonly Candidate[]
    /** The primary's name for what is staged. */
    readonly name: (stages: BenchStages) => string
    readonly ghosts?: (stages: BenchStages, preview: BenchPreview) => readonly BenchGhost[]
    /** The last press finishes it. */
    readonly fixed?: boolean
    /** A press replaces the pick; the same press takes it back. */
    readonly pickOne?: boolean
    /** A candidate that would cost too much dims, rather than a primary refusing later. */
    readonly dimsOnRefusal?: boolean
    /** The count toggle: `sets` is a stage; `shows` is read-only, since the logic takes no count. */
    readonly counts?: 'sets' | 'shows'
    /** What the staged input lacks, that its params can't tell the logic. */
    readonly ready?: (stages: BenchStages) => boolean
}

function picksOf<TKind extends BenchPick['kind']>(
    stages: BenchStages,
    kind: TKind
): readonly Extract<BenchPick, { kind: TKind }>[] {
    return stages.picks.filter(
        (pick): pick is Extract<BenchPick, { kind: TKind }> => pick.kind === kind
    )
}

function goodsOf(stages: BenchStages): readonly Good[] {
    return picksOf(stages, 'good').map(({ good }) => good)
}

/** Each good a place still holds, by kind. */
function goodCandidates(
    held: Readonly<Record<Good, number>>,
    stages: BenchStages,
    area: number,
    noteOf?: (good: Good) => ChipNote | undefined
): readonly Candidate[] {
    const picked = goodsOf(stages)
    return Goods.filter((good) => held[good] > 0).map((good) => {
        const note = noteOf?.(good)
        return {
            pick: { kind: 'good', good },
            label: titled(good),
            area,
            count: held[good] - picked.filter((other) => other === good).length,
            ...(note ? { note } : {})
        }
    })
}

function barnGoods({ state }: BenchSeat, stages: BenchStages, area: number) {
    return goodCandidates(state.guilds.farmer.barn, stages, area)
}

function marketGoods({ state }: BenchSeat, stages: BenchStages, area: number) {
    return goodCandidates(marketHolds(state), stages, area)
}

/** R-4.6.1 Goods onto market spaces: each goes to the space the logic names. */
function ghostsAtSpaces(stages: BenchStages, spaces: readonly string[]): readonly BenchGhost[] {
    const goods = goodsOf(stages)
    return spaces.flatMap((at, index) => {
        const good = goods.at(index)
        return good ? [{ item: `good:${good}`, at }] : []
    })
}

function moveName(stages: BenchStages): string {
    return `Move ${plural(goodsOf(stages).length, 'good')}`
}

const upTo = (verb: string, most: number) => () => `${verb} up to ${most}`

/** R-4.6.1 Barn to market: Farmer push, Merchant pull. */
function barnToMarket(most: number, counts: 'sets' | 'shows'): BenchRow {
    return {
        line: upTo('Move', most),
        candidates: (seat, stages) => barnGoods(seat, stages, 0),
        name: moveName,
        counts,
        ghosts: (stages, { details }) =>
            details && 'spaces' in details ? ghostsAtSpaces(stages, details.spaces) : []
    }
}

/** R-4.6.4, R-4.6.5 Market to carts: Merchant push, Alchemist pull. */
function marketToCarts(most: number, area: number): BenchRow {
    return {
        line: upTo('Move', most),
        candidates: (seat, stages) => marketGoods(seat, stages, area),
        name: moveName,
        ghosts: (stages, { details }) =>
            details && 'moves' in details
                ? ghostsAtSpaces(
                      stages,
                      details.moves.map(({ to }) => to)
                  )
                : []
    }
}

function recipeOf(good: Readonly<Record<Good, number>>): string {
    return Goods.filter((kind) => good[kind] > 0)
        .map((kind) => `${good[kind]} ${kind}`)
        .join(', ')
}

/** R-4.6.5 What this one would add, so a barrel shows this push's price. */
function inventionCandidates(
    { state }: BenchSeat,
    stages: BenchStages,
    area: number
): readonly Candidate[] {
    const picked = picksOf(stages, 'invention').map(({ invention }) => invention)
    const before = inventionGoods(picked)
    return inventionOffers(state).map(({ invention }) => {
        const after = inventionGoods([...picked, invention])
        const added = Goods.reduce<Record<Good, number>>(
            (costs, good) => ({ ...costs, [good]: after[good] - before[good] }),
            { ...after }
        )
        return {
            pick: { kind: 'invention', invention },
            label: titled(words(invention)),
            area,
            note: { kind: 'cost', label: recipeOf(added) }
        }
    })
}

/** R-4.6.5, R-4.6.6 A vessel goes to the vessel space, a barrel to the rows it fills. */
function inventionGhosts(stages: BenchStages, { details }: BenchPreview): readonly BenchGhost[] {
    const barrels = details && 'barrels' in details ? details.barrels : []
    let barrel = 0
    return picksOf(stages, 'invention').flatMap(({ invention }): BenchGhost[] => {
        if (invention !== 'krud-barrel') {
            return [{ item: `invention:${invention}`, at: VesselSpace }]
        }
        const fills = barrels.at(barrel) ?? []
        barrel += 1
        return fills.map(({ colour }) => ({
            item: 'invention:krud-barrel',
            at: knightRowPlace(colour)
        }))
    })
}

function rowLabel(seat: BenchSeat, row: number): string {
    const owner = seat.state.guilds.knight.rows.at(row)?.playerId
    return owner ? `${seat.nameOf(owner)}'s row` : `Row ${row + 1}`
}

/** R-4.6.4, R-4.6.5 Rows on one side, empty scrolls on the other: Knight push, Noble pull. */
function rowsToScrolls(most: number, counts: 'sets' | 'shows', fixed: boolean): BenchRow {
    return {
        line: upTo('Move', most),
        candidates: (seat) => {
            const { knightRows, scrollSpaces } = rowsToScrollsOffer(seat.state, most)
            const { rows } = seat.state.guilds.knight
            return [
                ...knightRows.map((row): Candidate => ({
                    pick: { kind: 'row', row },
                    label: rowLabel(seat, row),
                    area: 0,
                    ...(rows[row] ? { count: rows[row].markers } : {})
                })),
                ...scrollSpaces.map((spaceId): Candidate => ({
                    pick: { kind: 'scroll', spaceId },
                    label: `Scroll ${scrollName(spaceId)}`,
                    area: 1
                }))
            ]
        },
        name: (stages) => `Move ${plural(picksOf(stages, 'row').length, 'marker')}`,
        counts,
        fixed,
        ghosts: (stages) => {
            const scrolls = picksOf(stages, 'scroll')
            return picksOf(stages, 'row').flatMap(({ row }, index) => {
                const scroll = scrolls.at(index)
                return scroll ? [{ item: `row:${row}`, at: scroll.spaceId }] : []
            })
        }
    }
}

function scrollName(spaceId: ScrollSpaceId): string {
    return spaceId.split('.').at(-1) ?? spaceId
}

/** R-5-H1 Filled scrolls by their space: a seal is unseen, so nothing names it. */
function sealCandidates({ state }: BenchSeat, note?: ChipNote): readonly Candidate[] {
    return nobleTradeOffer(state).scrollSpaces.map((spaceId) => ({
        pick: { kind: 'scroll', spaceId },
        label: `Seal ${scrollName(spaceId)}`,
        area: 0,
        ...(note ? { note } : {})
    }))
}

function sealGhosts(at: string) {
    return (stages: BenchStages): readonly BenchGhost[] =>
        picksOf(stages, 'scroll').map(({ spaceId }) => ({ item: `scroll:${spaceId}`, at }))
}

const drawABead: BenchRow = { name: () => 'Draw a bead' }

const BenchRows: Readonly<Record<GuildId, Readonly<Record<GuildFunctionName, BenchRow>>>> = {
    farmer: {
        trade: {
            fixed: true,
            name: () => 'Trade',
            ready: ({ farm, takeFood }) => farm !== undefined && takeFood !== undefined
        },
        pull: drawABead,
        push: barnToMarket(FarmerPushGoods, 'sets')
    },
    merchant: {
        trade: {
            line: upTo('Buy', MerchantTradeGoods),
            candidates: ({ state, playerId }, stages, source) => {
                const offers = merchantTradeOffers(state, playerId)
                return goodCandidates(marketHolds(state), stages, 0, (good) => {
                    const price =
                        nextPrice(source, stages, good) ??
                        offers.find((offer) => offer.good === good)?.price
                    return price === undefined ? undefined : { kind: 'cost', label: `${price}s` }
                })
            },
            dimsOnRefusal: true,
            name: (stages) => `Buy ${plural(goodsOf(stages).length, 'good')}`,
            ghosts: (stages) =>
                goodsOf(stages).map((good) => ({ item: `good:${good}`, at: SeatPlace }))
        },
        pull: barnToMarket(MerchantPullGoods, 'shows'),
        push: marketToCarts(MerchantPushGoods, 0)
    },
    alchemist: {
        trade: {
            fixed: true,
            pickOne: true,
            candidates: ({ state }) =>
                alchemistTradeOffers(state).map(({ vessel, price }) => ({
                    pick: { kind: 'vessel', vessel },
                    label: titled(words(vessel)),
                    area: 0,
                    note: { kind: 'cost', label: `${price}s` }
                })),
            name: () => 'Buy a vessel',
            ghosts: (stages) =>
                picksOf(stages, 'vessel').map(({ vessel }) => ({
                    item: `vessel:${vessel}`,
                    at: SeatPlace
                }))
        },
        pull: marketToCarts(AlchemistPullGoods, 1),
        push: {
            line: upTo('Invent', AlchemistPushInventions),
            candidates: (seat, stages) => inventionCandidates(seat, stages, 0),
            dimsOnRefusal: true,
            name: (stages) => `Invent ${picksOf(stages, 'invention').length}`,
            ghosts: inventionGhosts
        }
    },
    knight: {
        trade: {
            fixed: true,
            name: () => 'Take the markers',
            ready: ({ take }) => take === true,
            ghosts: ({ take, monster, deploy }) => [
                ...(take ? [{ item: 'row:seat', at: SeatPlace }] : []),
                ...(monster && monster !== 'none' && deploy
                    ? [{ item: `monster:${monster}`, at: deploy }]
                    : [])
            ]
        },
        pull: {
            fixed: true,
            pickOne: true,
            candidates: (seat, stages) => inventionCandidates(seat, { ...stages, picks: [] }, 0),
            dimsOnRefusal: true,
            name: () => 'Invent it',
            ghosts: inventionGhosts
        },
        push: rowsToScrolls(KnightPushMarkers, 'sets', false)
    },
    noble: {
        trade: {
            line: ({ state }) => `Buy up to ${nobleTradeOffer(state).most}`,
            candidates: (seat) =>
                sealCandidates(seat, {
                    kind: 'cost',
                    label: `${nobleTradeOffer(seat.state).price}s`
                }),
            dimsOnRefusal: true,
            name: (stages) => `Buy ${plural(picksOf(stages, 'scroll').length, 'seal')}`,
            ghosts: sealGhosts(SeatPlace)
        },
        pull: rowsToScrolls(NoblePullMarkers, 'shows', true),
        push: {
            line: () => `Flip ${plural(NoblePushSeals, 'seal')}`,
            candidates: (seat) => sealCandidates(seat),
            name: (stages) => `Flip ${plural(picksOf(stages, 'scroll').length, 'seal')}`,
            ghosts: sealGhosts(RosaryPlace)
        }
    },
    monk: {
        trade: drawABead,
        pull: {
            pickOne: true,
            line: () => 'Flip 1 seal',
            candidates: (seat) => sealCandidates(seat),
            name: () => 'Flip it',
            ghosts: sealGhosts(RosaryPlace)
        },
        push: drawABead
    }
}

/** R-4.6.3 The next one of a kind costs what the space it would leave prints. */
function nextPrice(source: BenchSource, stages: BenchStages, good: Good): number | undefined {
    const { details } = source.previewOf({ goods: [...goodsOf(stages), good] }) ?? {}
    return details && 'bought' in details ? details.bought.at(-1)?.price : undefined
}

function samePick(one: BenchPick, other: BenchPick): boolean {
    return JSON.stringify(one) === JSON.stringify(other)
}

function candidateId(pick: BenchPick): string {
    switch (pick.kind) {
        case 'good':
            return `good:${pick.good}`
        case 'invention':
            return `invention:${pick.invention}`
        case 'vessel':
            return `vessel:${pick.vessel}`
        case 'row':
            return `row:${pick.row}`
        case 'scroll':
            return `scroll:${pick.spaceId}`
    }
}

function repeats({ kind }: BenchPick): boolean {
    return kind === 'good' || kind === 'invention'
}

/** R-4.6.1 Lit while the logic reads the next picks; otherwise the logic's own line. */
function benchItem(
    row: BenchRow,
    source: BenchSource,
    stages: BenchStages,
    candidate: Candidate,
    presser: BenchPresser
): BenchItem {
    const { pick, label, area, note, count } = candidate
    const picked = stages.picks.some((other) => samePick(other, pick))
    const common = {
        id: candidateId(pick),
        label,
        area,
        picked,
        ...(note ? { note } : {}),
        ...(count !== undefined ? { count } : {})
    }
    const without = stages.picks.filter((other) => !samePick(other, pick))
    if (picked && (row.pickOne || pick.kind === 'scroll')) {
        return {
            ...common,
            role: 'picked',
            press: () => {
                presser.picks(without)
            }
        }
    }
    const next = row.pickOne ? [pick] : [...stages.picks, pick]
    const params = paramsOf({ ...stages, picks: next, sulfur: undefined, count: undefined })
    const preview = source.previewOf(params)
    const reason = source.reasonOf(params)
    if (!preview || (row.dimsOnRefusal && preview.refused)) {
        return {
            ...common,
            role: picked && !repeats(pick) ? 'picked' : 'dimmed',
            ...(reason ? { refusal: preview?.refused ?? reason } : {})
        }
    }
    return {
        ...common,
        role: picked ? 'picked' : 'lit',
        press: () => {
            presser.picks(next)
        }
    }
}

/** R-4.6.3, R-4.6-H2 The two beads a draw would choose between: lit, nothing to press. */
function beadItems(preview: BenchPreview | undefined): readonly BenchItem[] {
    const draw = preview?.beadDraw
    if (!draw) {
        return []
    }
    const note = preview.payment ? priceNote(preview.payment) : undefined
    return [...new Set([draw.high, draw.low])].map((sealId) => {
        const value = Seals.find(({ id }) => id === sealId)?.beadValue
        return {
            id: `bead:${sealId}`,
            label: `Bead ${value}`,
            area: 0,
            role: 'lit',
            picked: false,
            ...(note ? { note } : {})
        }
    })
}

function paymentTotal({ members, charity, generalSupply }: PaymentSplit): number {
    return members.reduce((total, { amount }) => total + amount, 0) + charity.amount + generalSupply
}

function priceNote(payment: PaymentSplit): ChipNote {
    return { kind: 'cost', label: `${paymentTotal(payment)}s` }
}

function seatWord({ playerId, nameOf }: BenchSeat, id: string): string {
    return id === playerId ? 'you' : nameOf(id)
}

/** R-4.6-H3 The charity's own word, off its id. */
function charityWord(id: string): string {
    return `the ${id.split('.').at(-1) ?? id}`
}

/** R-4.6.2 "1s to Ana, 1s to Ben, 1s to the coffer". */
function paymentLine(seat: BenchSeat, payment: PaymentSplit): string | undefined {
    const parts = [
        ...payment.members.map(({ playerId, amount }) => ({
            amount,
            to: seatWord(seat, playerId)
        })),
        { amount: payment.charity.amount, to: charityWord(payment.charity.id) },
        { amount: payment.generalSupply, to: 'the supply' }
    ].filter(({ amount }) => amount > 0)
    return parts.length > 0
        ? parts.map(({ amount, to }) => `${amount}s to ${to}`).join(', ')
        : undefined
}

/** R-4.6.5 A pot's shares, and what stays in it. */
function splitLine(seat: BenchSeat, { pot, shares, stays }: PotSplit): string | undefined {
    const parts = [
        ...shares
            .filter(({ amount }) => amount > 0)
            .map(({ playerId, amount }) => `${amount}s to ${seatWord(seat, playerId)}`),
        ...(stays > 0 ? [`${stays}s stay in ${charityWord(pot)}`] : [])
    ]
    return parts.length > 0 ? parts.join(', ') : undefined
}

/** R-4.6.1, R-4.6.4, R-4.6.5 Points, and the writs a pull draws; a draw or a flip gives a range. */
function scoringLine(fn: GuildFunctionName, preview: BenchPreview): string {
    const low = preview.beadDraw?.ifLow ?? preview.sealFlip?.ifLowest
    const lowest = Math.min(low?.points ?? preview.points, preview.points)
    const highest = Math.max(low?.points ?? preview.points, preview.points)
    const points = lowest === highest ? `${highest} vp` : `${lowest} to ${highest} vp`
    if (fn !== 'pull') {
        return points
    }
    const best = (low?.points ?? 0) > preview.points && low ? low : preview
    return best.drawnCount && best.drawnCount > 0
        ? `${points} · ${best.drawnCount} writs, keep ${best.keep}`
        : `${points} · no writ`
}

function tradeLine(preview: BenchPreview): string | undefined {
    const { trade, payment } = preview
    if (trade) {
        return `${trade.sent} sent: ${trade.food} food / ${trade.shillings}s`
    }
    return payment ? `${paymentTotal(payment)}s` : undefined
}

/** R-4.6.1 "3 goods · 1 row, 2 columns", the carts it completed last. */
function movedLine(row: BenchRow, stages: BenchStages, preview: BenchPreview): string | undefined {
    const goods = goodsOf(stages).length
    const markers = picksOf(stages, 'row').length
    const moved = goods > 0 ? plural(goods, 'good') : markers > 0 ? plural(markers, 'marker') : ''
    if (!moved || !row.line) {
        return undefined
    }
    const { rows = 0, columns = 0, details } = preview
    const lines = [
        ...(rows > 0 ? [plural(rows, 'row')] : []),
        ...(columns > 0 ? [plural(columns, 'column')] : []),
        ...(details && 'completed' in details && details.completed.length > 0
            ? [details.completed.map((good) => `${good} cart`).join(', ')]
            : [])
    ]
    return lines.length > 0 ? `${moved} · ${lines.join(', ')}` : moved
}

/** R-4.6, R-4.7, R-3.16.3 All from the preview: this restates no rule. */
function resultOf(
    seat: BenchSeat,
    source: BenchSource,
    row: BenchRow,
    stages: BenchStages,
    preview: BenchPreview | undefined
): BenchResult | undefined {
    if (!preview) {
        return undefined
    }
    const base = source.fn === 'trade' ? tradeLine(preview) : scoringLine(source.fn, preview)
    const feast = preview.feastPoints ? `+${preview.feastPoints} vp feast` : undefined
    const said = [base, feast].filter((part) => part !== undefined).join(' · ')
    const moved = movedLine(row, stages, preview)
    const payment = preview.payment && paymentLine(seat, preview.payment)
    const split = preview.split && splitLine(seat, preview.split)
    return {
        line: primaryLabel(said, preview),
        ...(moved ? { moved } : {}),
        ...(payment ? { payment } : {}),
        ...(split ? { split } : {}),
        ...(preview.reevePoints > 0 ? { reeve: `+${preview.reevePoints} vp reeve` } : {})
    }
}

/** The higher count, ties to rows: what the logic takes with no count named. */
function higherCount(rows: number, columns: number): CompletionCount {
    return columns > rows ? 'columns' : 'rows'
}

/** R-4.6.1 Shown only when both counts were reached. */
function countChoices(
    row: BenchRow,
    stages: BenchStages,
    preview: BenchPreview | undefined,
    presser: BenchPresser
): readonly BenchChoice[] | undefined {
    const { rows = 0, columns = 0 } = preview ?? {}
    if (!row.counts || rows <= 0 || columns <= 0) {
        return undefined
    }
    const chosen = stages.count ?? higherCount(rows, columns)
    const choice = (count: CompletionCount, label: string): BenchChoice => ({
        label,
        picked: chosen === count,
        ...(row.counts === 'sets'
            ? {
                  press: () => {
                      presser.count(count)
                  }
              }
            : {})
    })
    return [choice('rows', `Rows (${rows})`), choice('columns', `Columns (${columns})`)]
}

/** R-4.6.3, R-4.10.2 Of the sulfur bought, each count the logic would take, when there's a choice. */
function sulfurChoices(
    source: BenchSource,
    stages: BenchStages,
    presser: BenchPresser
): readonly BenchChoice[] {
    if (source.guildId !== 'merchant' || source.fn !== 'trade') {
        return []
    }
    const bought = goodsOf(stages).filter((good) => good === 'sulfur').length
    const params = paramsOf(stages)
    const counts = Array.from({ length: bought + 1 }, (_, count) => count).filter(
        (count) => !source.previewOf({ ...params, sulfurToBarrel: count })?.refused
    )
    if (counts.length < 2) {
        return []
    }
    const chosen = stages.sulfur ?? 0
    return counts.map((count) => ({
        label: count === 0 ? 'Keep it' : `Into the barrel: ${count}`,
        picked: chosen === count,
        press: () => {
            presser.sulfur(count)
        }
    }))
}

function monsterWord(monster: MonsterId): string {
    return words(monster)
}

/** A trade that goes to the map, and the popups on the way. */
interface MapStep {
    readonly collapsed?: string
    readonly popup?: FlowPopup
    readonly map?: readonly FlowPick[]
}

function farmStep(
    { state, playerId }: BenchSeat,
    source: BenchSource,
    stages: BenchStages,
    title: string,
    presser: BenchPresser
): MapStep {
    const offers = farmerTradeOffers(state, playerId)
    const { farm } = stages
    if (!farm) {
        return {
            collapsed: `${title}: pick a farm`,
            map: offers.map(({ spaceId, sent }) => ({
                target: spaceTarget(spaceId),
                notes: [{ kind: 'gain', label: `${sent} sent` }],
                press: () => {
                    presser.farm(spaceId)
                }
            }))
        }
    }
    if (stages.takeFood !== undefined) {
        return {}
    }
    const offer = offers.find(({ spaceId }) => spaceId === farm)
    const splits = Array.from({ length: (offer?.rewards ?? 0) + 1 }, (_, takeFood) => takeFood)
    return {
        popup: {
            anchor: spaceTarget(farm),
            choices: splits.flatMap((takeFood): PanelChoice[] => {
                const { trade } = source.previewOf({ farmSpaceId: farm, takeFood }) ?? {}
                return trade
                    ? [
                          {
                              label: `${trade.sent} sent: ${trade.food} food / ${trade.shillings}s`,
                              picked: false,
                              press: () => {
                                  presser.split(takeFood)
                              }
                          }
                      ]
                    : []
            })
        }
    }
}

/** R-4.6.3, R-4.2.4 With enough markers the row asks about a monster; a tame picks its space. */
function knightStep(
    { state, playerId }: BenchSeat,
    stages: BenchStages,
    title: string,
    presser: BenchPresser
): MapStep {
    if (!stages.take) {
        return {}
    }
    const { monsters } = knightTradeOffer(state, playerId)
    const { monster } = stages
    if (monsters.length === 0 || monster === 'none') {
        return {}
    }
    if (!monster) {
        return {
            popup: {
                anchor: guildTarget('knight'),
                choices: [
                    ...monsters.map(({ monster: id }): PanelChoice => ({
                        label: `Tame the ${monsterWord(id)}`,
                        picked: false,
                        press: () => {
                            presser.monster(id)
                        }
                    })),
                    {
                        label: 'No',
                        picked: false,
                        press: () => {
                            presser.monster('none')
                        }
                    }
                ]
            }
        }
    }
    if (stages.deploy) {
        return {}
    }
    const spaces = monsters.find(({ monster: id }) => id === monster)?.spaces ?? []
    return {
        collapsed: `${title}: tame the ${monsterWord(monster)}`,
        map: spaces.map((spaceId) => ({
            target: spaceTarget(spaceId),
            press: () => {
                presser.deploy(spaceId)
            }
        }))
    }
}

function knightItems(
    { state, playerId }: BenchSeat,
    stages: BenchStages,
    presser: BenchPresser
): readonly BenchItem[] {
    const { price, markers } = knightTradeOffer(state, playerId)
    return [
        {
            id: 'row:seat',
            label: `${price}s: take ${plural(markers, 'marker')}`,
            area: 0,
            role: stages.take ? 'picked' : 'lit',
            picked: stages.take === true,
            press: () => {
                presser.take()
            }
        }
    ]
}

function areasOf(guildId: GuildId, fn: GuildFunctionName): readonly GuildId[] {
    const { pullsFrom, pushesTo } = GuildById[guildId]
    if (fn === 'pull' && pullsFrom) {
        return [pullsFrom, guildId]
    }
    return fn === 'push' && pushesTo ? [guildId, pushesTo] : [guildId]
}

function isTradeOf(source: BenchSource, guildId: GuildId): boolean {
    return source.guildId === guildId && source.fn === 'trade'
}

/** R-4.6.1 Everything the bench shows, read off the preview. Pure. */
export function benchOffer(
    seat: BenchSeat,
    source: BenchSource,
    stages: BenchStages,
    presser: BenchPresser
): BenchOffer {
    const row = BenchRows[source.guildId][source.fn]
    const title = `${GuildById[source.guildId].name} ${source.fn}`
    const params = paramsOf(stages)
    const preview = source.previewOf(params)
    const step = isTradeOf(source, 'farmer')
        ? farmStep(seat, source, stages, title, presser)
        : isTradeOf(source, 'knight')
          ? knightStep(seat, stages, title, presser)
          : {}
    const refused = preview?.refused ?? (preview ? undefined : source.reasonOf(params))
    const ready = row.ready?.(stages) ?? true
    const completes = preview !== undefined && !refused && ready && !step.popup && !step.map
    const items = step.collapsed
        ? []
        : isTradeOf(source, 'knight')
          ? knightItems(seat, stages, presser)
          : isTradeOf(source, 'monk')
            ? beadItems(preview)
            : (row.candidates?.(seat, stages, source) ?? []).map((candidate) =>
                  benchItem(row, source, stages, candidate, presser)
              )
    const line = row.line?.(seat)
    const result = resultOf(seat, source, row, stages, preview)
    const count = countChoices(row, stages, preview, presser)
    return {
        title,
        areas: areasOf(source.guildId, source.fn),
        ...(line ? { line } : {}),
        ...(step.collapsed ? { collapsed: step.collapsed } : {}),
        items,
        ghosts: preview ? (row.ghosts?.(stages, preview) ?? []) : [],
        ...(result ? { result } : {}),
        ...(count ? { count } : {}),
        rows: sulfurChoices(source, stages, presser),
        ...(step.popup ? { popup: step.popup } : {}),
        ...(step.map ? { map: step.map } : {}),
        primary: {
            label: primaryLabel(row.name(stages), preview),
            enabled: completes
        },
        fixed: row.fixed === true,
        completes,
        params,
        ...(preview ? { preview } : {}),
        ...(refused ? { refused } : {})
    }
}

/** What a lone legal choice would stage, each read through as `auto` (contract: Pick conventions). */
export interface LoneChoices {
    readonly farm?: SpaceId
    readonly split?: number
    readonly deploy?: SpaceId
    readonly picks?: readonly BenchPick[]
    readonly count?: CompletionCount
}

function only<TValue>(values: readonly TValue[]): TValue | undefined {
    return values.length === 1 ? values[0] : undefined
}

function loneFarmer(seat: BenchSeat, stages: BenchStages): Pick<LoneChoices, 'farm' | 'split'> {
    const offers = farmerTradeOffers(seat.state, seat.playerId)
    const farm = stages.farm ?? only(offers.map(({ spaceId }) => spaceId))
    const rewards = offers.find(({ spaceId }) => spaceId === farm)?.rewards
    return {
        ...(farm ? { farm } : {}),
        ...(rewards === 0 ? { split: 0 } : {})
    }
}

/** R-4.2.4 A tame with one space to go to. */
function loneDeploy(seat: BenchSeat, stages: BenchStages): SpaceId | undefined {
    const { monsters } = knightTradeOffer(seat.state, seat.playerId)
    const spaces = monsters.find(({ monster }) => monster === stages.monster)?.spaces ?? []
    return only(spaces)
}

/** The single pick a one-pick function leaves, when the logic takes it. */
function lonePicks(
    seat: BenchSeat,
    source: BenchSource,
    row: BenchRow,
    stages: BenchStages
): readonly BenchPick[] | undefined {
    if (!row.pickOne || stages.picks.length > 0) {
        return undefined
    }
    const legal = (row.candidates?.(seat, stages, source) ?? []).filter(({ pick }) => {
        const preview = source.previewOf(paramsOf({ ...stages, picks: [pick] }))
        return preview && !(row.dimsOnRefusal && preview.refused)
    })
    const pick = only(legal.map((candidate) => candidate.pick))
    return pick ? [pick] : undefined
}

export function loneChoices(
    seat: BenchSeat,
    source: BenchSource,
    stages: BenchStages
): LoneChoices {
    const row = BenchRows[source.guildId][source.fn]
    const picks = lonePicks(seat, source, row, stages)
    const deploy = isTradeOf(source, 'knight') ? loneDeploy(seat, stages) : undefined
    const { rows = 0, columns = 0 } = source.previewOf(paramsOf(stages)) ?? {}
    return {
        ...(isTradeOf(source, 'farmer') ? loneFarmer(seat, stages) : {}),
        ...(deploy ? { deploy } : {}),
        ...(picks ? { picks } : {}),
        ...(row.counts === 'sets' && rows > 0 && columns > 0
            ? { count: higherCount(rows, columns) }
            : {})
    }
}
