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
import { guildSideFollowing, type GuildSide, type PickFrame } from './boardFocus.svelte.js'
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

/** A region stack's tiles by epoch. */
export interface StackViewOf {
    readonly kind: 'region'
    readonly region: RegionId
}

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
    /** Contract, Supply: the writ reference, every writ in the game, for looking. */
    writsOpen: boolean = $state(false)
    private readonly pickKey = $derived.by(() => this.pickFrame()?.key)
    /** The side shown last, which a pick in both sides keeps. */
    private sideShown: GuildSide | undefined
    /**
     * Contract, Desk layout and Pick framing: the guild side open over a desk's map, one at a time.
     * A pick new to it opens the side that holds every target, keeps the side as it is when its
     * targets stand in both sides, and closes it when one stands on the map or a track, as the
     * pick's end does. A button opens, switches or closes it until the pick changes; with no pick
     * open a side opened by hand is a look, and stays open.
     */
    guildSide: GuildSide | undefined = $derived.by(() => {
        void this.pickKey
        const next = untrack(() => guildSideFollowing(this.pickFrame()))
        if (next !== 'keep') {
            this.sideShown = next
        }
        return this.sideShown
    })

    /** A site's card: the one pressed open, else the one under a desk pointer; a side opening closes it. */
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

    /** Its button opens a side, switches from the other, or closes it again. */
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
        this.sideShown = side
        this.guildSide = side
    }

    closeSeatOrStack(): void {
        this.openSeatId = undefined
        this.stackView = undefined
        this.tracksOpen = false
        this.guildsOpen = false
        this.writsOpen = false
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
        if (
            this.openSeatId !== undefined ||
            this.stackView ||
            this.tracksOpen ||
            this.guildsOpen ||
            this.writsOpen
        ) {
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
        return false
    }
}
