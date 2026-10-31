import {
    BOARD_GRID,
    TownEventKind,
    openSpaceIds,
    repairsBill,
    townEffectAt,
    type HydratedPromontoryPointGameState,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'
import type { RepairsTown, TurnPlacement } from './thisTurn.js'

export enum HexPick {
    Lit = 'Lit',
    Dimmed = 'Dimmed',
    Plain = 'Plain'
}

export enum ChipKind {
    Dividend = 'Dividend',
    Repairs = 'Repairs'
}

// O-3: what the deciding seat would receive, or be billed, if the piece lands here.
export type EffectChip = {
    kind: ChipKind
    dollars: number
}

export type HexOffer = {
    pick: HexPick
    placementOrder?: number
    beingDecided?: RailroadId
    chip?: EffectChip
    previewed: boolean
}

export type BoardOffer = {
    hexes: ReadonlyMap<SpaceId, HexOffer>
    lit: SpaceId[]
    veiled: boolean
}

export enum OfferView {
    Live = 'Live',
    History = 'History',
    Updating = 'Updating'
}

export type BoardOfferInput = {
    state: HydratedPromontoryPointGameState
    view: OfferView
    // The deciding seat's picked piece, only while it may be placed.
    placing?: { railroadId: RailroadId; decidingPlayerId: string }
    hovered?: RailroadId
    placements: readonly TurnPlacement[]
    repairsTown?: RepairsTown
}

// One derivation for every board layer: each hex's pick, badge, outline, chip and preview ring.
export function boardOffer(input: BoardOfferInput): BoardOffer {
    if (input.view === OfferView.Updating) {
        return emptyOffer()
    }
    const live = input.view === OfferView.Live
    const lit =
        live && input.placing ? openSpaceIds(input.state.track, input.placing.railroadId) : []
    const previewed =
        live && input.hovered !== undefined && input.state.turn?.pieces.includes(input.hovered)
            ? openSpaceIds(input.state.track, input.hovered)
            : []
    const chips =
        live && input.placing
            ? effectChips(input.state, input.placing, lit)
            : new Map<SpaceId, EffectChip>()
    const placementOrders = new Map(
        input.placements.map((placement) => [placement.spaceId, placement.order])
    )
    const veiled = lit.length > 0
    const litIds = new Set(lit)
    const previewedIds = new Set(previewed)
    const hexes = new Map(
        BOARD_GRID.spaces().map((space): [SpaceId, HexOffer] => {
            const isLit = litIds.has(space.spaceId)
            return [
                space.spaceId,
                {
                    pick: isLit ? HexPick.Lit : veiled ? HexPick.Dimmed : HexPick.Plain,
                    placementOrder: placementOrders.get(space.spaceId),
                    beingDecided:
                        input.repairsTown?.spaceId === space.spaceId
                            ? input.repairsTown.railroadId
                            : undefined,
                    chip: chips.get(space.spaceId),
                    previewed: !isLit && previewedIds.has(space.spaceId)
                }
            ]
        })
    )
    return { hexes, lit, veiled }
}

export function hexOffer(offer: BoardOffer, spaceId: SpaceId): HexOffer {
    return offer.hexes.get(spaceId) ?? PLAIN_HEX
}

const PLAIN_HEX: HexOffer = { pick: HexPick.Plain, previewed: false }

function emptyOffer(): BoardOffer {
    return { hexes: new Map(), lit: [], veiled: false }
}

// O-3, R-4.2, R-4.3-H1: from the deciding seat's own shares of the picked railroad.
function effectChips(
    state: HydratedPromontoryPointGameState,
    placing: NonNullable<BoardOfferInput['placing']>,
    lit: readonly SpaceId[]
): Map<SpaceId, EffectChip> {
    const shares = state.getPlayerState(placing.decidingPlayerId).shares
    const chips = new Map<SpaceId, EffectChip>()
    for (const spaceId of lit) {
        const event = townEffectAt(state, spaceId)?.event
        if (event?.kind === TownEventKind.Dividend) {
            const dollars = event.dollarsPerShare * shares[placing.railroadId]
            chips.set(spaceId, { kind: ChipKind.Dividend, dollars })
        } else if (event?.kind === TownEventKind.Repairs) {
            const dollars = repairsBill(shares, placing.railroadId)
            chips.set(spaceId, { kind: ChipKind.Repairs, dollars })
        }
    }
    return chips
}
