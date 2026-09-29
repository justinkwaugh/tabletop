import { Color } from '@tabletop/common'
/** R-2.1.1 */
export enum Region {
    Cradle = 'cradle',
    Provinces = 'provinces',
    Hinterland = 'hinterland'
}

export enum Suit {
    Discord = 'discord',
    Hearth = 'hearth',
    Nomad = 'nomad',
    Order = 'order',
    Beast = 'beast',
    Arcane = 'arcane'
}

export enum OathType {
    Supremacy = 'supremacy',
    ThePeople = 'thePeople',
    Devotion = 'devotion',
    Protection = 'protection'
}

/** R-1.4, R-9.3 — favor is component-limited; the total is a conservation invariant. */
export const TOTAL_FAVOR = 36

/** R-6.6.3 — the Chancellor's colour, held and mustered by Citizens too (R-1.15, R-5.2.2). */
export const IMPERIAL_COLOR: Color = Color.Purple

export enum PlayerStatus {
    Chancellor = 'chancellor',
    Exile = 'exile',
    Citizen = 'citizen'
}

export enum Banner {
    PeoplesFavor = 'peoplesFavor',
    DarkestSecret = 'darkestSecret'
}

/** A card's kind is its id's first segment: `<kind>.<suit-or-group>.<name-slug>`. */
export enum CardKind {
    Denizen = 'denizen',
    Vision = 'vision',
    Relic = 'relic',
    Site = 'site'
}

export enum RecoverTargetKind {
    Relic = 'relic',
    /** Includes a banner you already hold. */
    Banner = 'banner'
}

export enum SearchPlay {
    /** R-5.1.4.I */
    Site = 'site',
    /** R-5.1.4.II */
    Adviser = 'adviser',
    /** R-5.1.4.III — not an adviser. */
    RevealedVision = 'revealedVision',
    /** R-5.1.4 */
    Discard = 'discard',
    /** R-5.1.4.IV — anyone may play it faceup; it never reaches the Revealed Vision space. */
    Conspiracy = 'conspiracy'
}
