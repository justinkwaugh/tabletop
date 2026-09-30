import type { OathType } from '@tabletop/oath'
import { goalCardImage, reliquaryTraitImage } from '$lib/images/tileImages.js'
import type { CardPreview } from '$lib/model/cardPreview.svelte.js'

/** An uncovered Reliquary space shows the trait printed under it, enlarged like any card. */
export function reliquaryTraitPreview(spaceIndex: number, spaceLabel: string): CardPreview {
    return {
        faceDown: false,
        imageSrc: reliquaryTraitImage(spaceIndex),
        aspect: 357 / 360,
        label: `${spaceLabel}, uncovered: the Chancellor holds this trait`
    }
}

/** R-2.10 — the goal card carries the Oathkeeper goal above the Successor goal; the whole card is shown. */
export function goalCardPreview(oathType: OathType, title: string): CardPreview {
    return {
        faceDown: false,
        imageSrc: goalCardImage(oathType),
        aspect: 662 / 898,
        label: title
    }
}
