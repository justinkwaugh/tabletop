import type { Color } from '@tabletop/common'
import type {
    ActionCardKind,
    BeadValue,
    GuildId,
    HydratedFeudumGameState,
    LandscapeKind,
    RegionId,
    SpaceId,
    TileEpoch,
    WritId
} from '@tabletop/feudum'
import { untrack } from 'svelte'
import {
    guildSideFollowing,
    guildSideOf,
    type GuildSide,
    type PickFrame
} from './boardFocus.svelte.js'
import type { BoardTarget } from './boardOffer.js'
import type { SeatPaint } from './seatPaint.js'

/** R-4.4.4 Its owner's props, so a back stays a back. */
export type EnlargedFace =
    | {
          readonly kind: 'card'
          readonly faceShown: boolean
          /** docs/hidden-information.md: a back of a seat's hand has no kind. */
          readonly card?: ActionCardKind
          readonly paint: SeatPaint
          readonly number?: number
      }
    | {
          readonly kind: 'writ'
          readonly faceShown: boolean
          readonly writId?: WritId
          readonly sealed?: boolean
      }
    | {
          readonly kind: 'tile'
          readonly faceShown: boolean
          readonly epoch: TileEpoch
          readonly landscape?: LandscapeKind
          readonly region?: RegionId
      }
    | { readonly kind: 'bead'; readonly faceShown: boolean; readonly beadValue?: BeadValue }
    /** R-1.3 A guild area, drawn from the state its owner draws. */
    | {
          readonly kind: 'guild'
          readonly guild: GuildId
          readonly state: HydratedFeudumGameState
          readonly paintOf: (playerId: string) => SeatPaint
          readonly colourPaintOf: (colour: Color) => SeatPaint
      }

export interface StackViewOf {
    readonly kind: 'region'
    readonly region: RegionId
}

export type CornerCard = 'key' | 'supply'

interface Enlarged {
    readonly owner: object
    readonly read: () => EnlargedFace
}

/** Contract, Shared visual state: no draft, so it works in History View. */
export class TableLayers {
    private enlargedBy: Enlarged | undefined = $state.raw(undefined)

    openSeatId: string | undefined = $state(undefined)
    stackView: StackViewOf | undefined = $state.raw(undefined)
    tracksOpen: boolean = $state(false)
    guildsOpen: boolean = $state(false)
    /** Contract, Supply: the writ reference. */
    writsOpen: boolean = $state(false)
    /** Contract, Symbol key and Supply: the looking card open over the board's corner. */
    corner: CornerCard | undefined = $state(undefined)
    private readonly pickKey = $derived.by(() => this.pickFrame()?.key)
    private sideChosen: GuildSide | undefined = $state(undefined)
    /** Contract, Desk layout: the guild side open over a desk's map. */
    guildSide: GuildSide | undefined = $derived.by(() => {
        void this.pickKey
        return untrack(() => {
            const next = guildSideFollowing(this.pickFrame())
            return next === 'keep' ? this.sideChosen : next
        })
    })

    private sitePressed: SpaceId | undefined = $derived.by(() => {
        void this.guildSide
        return undefined
    })
    private siteHovered: SpaceId | undefined = $derived.by(() => {
        void this.guildSide
        return undefined
    })

    constructor(private readonly pickFrame: () => PickFrame | undefined = () => undefined) {}
    get site(): SpaceId | undefined {
        return this.sitePressed ?? this.siteHovered
    }

    enlarged: EnlargedFace | undefined = $derived(this.enlargedBy?.read())

    enlarge(owner: object, read: () => EnlargedFace): void {
        this.enlargedBy = { owner, read }
    }

    closeEnlarged(): void {
        this.enlargedBy = undefined
    }

    ownerGone(owner: object): void {
        if (this.enlargedBy?.owner === owner) {
            this.enlargedBy = undefined
        }
    }

    openSite(spaceId: SpaceId): void {
        this.sitePressed = this.sitePressed === spaceId ? undefined : spaceId
    }

    hoverSite(spaceId: SpaceId | undefined): void {
        this.siteHovered = spaceId
    }

    closeSite(): void {
        this.sitePressed = undefined
        this.siteHovered = undefined
    }

    openSeat(playerId: string): void {
        this.closeSite()
        this.stackView = undefined
        this.tracksOpen = false
        this.guildsOpen = false
        this.writsOpen = false
        this.openSeatId = playerId
    }

    openStack(view: StackViewOf): void {
        this.closeSite()
        this.openSeatId = undefined
        this.tracksOpen = false
        this.guildsOpen = false
        this.writsOpen = false
        this.stackView = view
    }

    openTracks(): void {
        this.closeSite()
        this.openSeatId = undefined
        this.stackView = undefined
        this.guildsOpen = false
        this.writsOpen = false
        this.tracksOpen = true
    }

    openGuilds(): void {
        this.closeSite()
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
        this.writsOpen = false
        this.guildsOpen = true
    }

    openWrits(): void {
        this.closeSite()
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
        this.guildsOpen = false
        this.writsOpen = true
    }

    toggleGuildSide(side: GuildSide): void {
        if (this.guildSide === side) {
            this.closeGuildSide()
            return
        }
        this.showSide(side)
    }

    closeGuildSide(): void {
        this.showSide(undefined)
    }

    private showSide(side: GuildSide | undefined): void {
        this.sideChosen = side
        this.guildSide = side
    }

    closeSeatOrStack(): void {
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
        this.guildsOpen = false
        this.writsOpen = false
    }

    toggleCorner(card: CornerCard): void {
        this.corner = this.corner === card ? undefined : card
    }

    closeCorner(): void {
        this.corner = undefined
    }

    /** Contract, Coexistence and precedence: the layers that stand over the board's popups. */
    get covering(): boolean {
        return (
            this.enlargedBy !== undefined ||
            this.openSeatId !== undefined ||
            this.stackView !== undefined ||
            this.tracksOpen ||
            this.guildsOpen ||
            this.writsOpen
        )
    }

    /**
     * Contract, Coexistence and precedence: Escape closes one layer at a time; in full screen it
     * leaves full screen to the wrapper before an open Key or Supply card.
     */
    escape(fullScreen: boolean): boolean {
        if (this.enlargedBy) {
            this.closeEnlarged()
            return true
        }
        if (this.covering) {
            this.closeSeatOrStack()
            return true
        }
        if (this.guildSide) {
            this.closeGuildSide()
            return true
        }
        if (this.site) {
            this.closeSite()
            return true
        }
        if (this.corner && !fullScreen) {
            this.closeCorner()
            return true
        }
        return false
    }
}

export type BoardFloat<TPopup> =
    | { readonly kind: 'popup'; readonly popup: TPopup }
    | { readonly kind: 'site'; readonly spaceId: SpaceId }

export interface BoardFloatInput<TPopup> {
    readonly popup?: TPopup
    readonly bench: boolean
    readonly benchCovers: boolean
    readonly desk: boolean
}

/**
 * Contract, Coexistence and precedence: the one card over the board, the open popup or the site
 * card. A layer over the board covers both; on a desk a popup beside a guild area stands only while
 * its side is open (Desk layout); the bench leaves no site card.
 */
export function boardFloatOf<TPopup extends { readonly anchor: BoardTarget }>(
    layers: TableLayers,
    { popup, bench, benchCovers, desk }: BoardFloatInput<TPopup>
): BoardFloat<TPopup> | undefined {
    if (layers.covering) {
        return undefined
    }
    const side = popup && guildSideOf(popup.anchor)
    if (popup && !(desk && !benchCovers && side !== undefined && layers.guildSide !== side)) {
        return { kind: 'popup', popup }
    }
    return layers.site && !bench ? { kind: 'site', spaceId: layers.site } : undefined
}
