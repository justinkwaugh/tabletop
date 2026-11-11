import type { Color } from '@tabletop/common'
import type {
    ActionCardKind,
    BeadValue,
    GuildId,
    HydratedFeudumGameState,
    LandscapeKind,
    RegionId,
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

    openSeat(playerId: string): void {
        this.stackView = undefined
        this.tracksOpen = false
        this.openSeatId = playerId
    }

    openStack(view: StackViewOf): void {
        this.openSeatId = undefined
        this.tracksOpen = false
        this.stackView = view
    }

    openTracks(): void {
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = true
    }

    closeSeatOrStack(): void {
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
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
        if (this.openSeatId !== undefined || this.stackView || this.tracksOpen) {
            this.closeSeatOrStack()
            return true
        }
        return false
    }
}
