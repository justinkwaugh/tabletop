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
import type { SeatPaint } from './seatPaint.js'

/** What the enlarged view draws: its owner's props, so a back stays a back (R-4.4.4). */
export type EnlargedFace =
    | {
          readonly kind: 'card'
          readonly faceShown: boolean
          /** A back of a seat's hand has none: its kind is nowhere on this side of the perspective. */
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

/** A region stack's tiles by epoch, or the deck's seen writs. */
export type StackViewOf =
    { readonly kind: 'region'; readonly region: RegionId } | { readonly kind: 'deck' }

interface Enlarged {
    readonly owner: object
    readonly read: () => EnlargedFace
}

/**
 * What is open over the table (contract: Shared visual state). It stands apart from every draft: it
 * offers no choice, and it works in History View, reading the displayed state.
 */
export class TableLayers {
    private enlargedBy: Enlarged | undefined = $state.raw(undefined)

    openSeatId: string | undefined = $state(undefined)
    stackView: StackViewOf | undefined = $state.raw(undefined)
    /** A phone's Tracks sheet: for looking, with no target in it. */
    tracksOpen: boolean = $state(false)
    /** A phone's Guilds sheet: the guild standings, for looking. */
    guildsOpen: boolean = $state(false)

    /** A site's card: the one pressed open, else the one under a desk pointer. */
    private sitePressed: SpaceId | undefined = $state(undefined)
    private siteHovered: SpaceId | undefined = $state(undefined)
    get site(): SpaceId | undefined {
        return this.sitePressed ?? this.siteHovered
    }

    /** Read through its owner, so it follows the owner's current props. */
    enlarged: EnlargedFace | undefined = $derived(this.enlargedBy?.read())

    enlarge(owner: object, read: () => EnlargedFace): void {
        this.enlargedBy = { owner, read }
    }

    closeEnlarged(): void {
        this.enlargedBy = undefined
    }

    /** The preview's lifetime ends with its owner. */
    ownerGone(owner: object): void {
        if (this.enlargedBy?.owner === owner) {
            this.enlargedBy = undefined
        }
    }

    /** A second press on the same site closes its card. */
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
        this.openSeatId = playerId
    }

    openStack(view: StackViewOf): void {
        this.closeSite()
        this.openSeatId = undefined
        this.tracksOpen = false
        this.guildsOpen = false
        this.stackView = view
    }

    openTracks(): void {
        this.closeSite()
        this.openSeatId = undefined
        this.stackView = undefined
        this.guildsOpen = false
        this.tracksOpen = true
    }

    openGuilds(): void {
        this.closeSite()
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
        this.guildsOpen = true
    }

    closeSeatOrStack(): void {
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
        this.guildsOpen = false
    }

    /**
     * Contract, Coexistence and precedence: Escape closes one layer at a time. False once none of
     * these is open, so the key goes on to full screen. The bench is no layer: Undo closes it.
     */
    escape(): boolean {
        if (this.enlargedBy) {
            this.closeEnlarged()
            return true
        }
        if (this.openSeatId !== undefined || this.stackView || this.tracksOpen || this.guildsOpen) {
            this.closeSeatOrStack()
            return true
        }
        if (this.site) {
            this.closeSite()
            return true
        }
        return false
    }
}
