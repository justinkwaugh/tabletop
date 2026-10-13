import type { Banner, HydratedOathGameState } from '@tabletop/oath'
import { bannerImage } from '$lib/images/tileImages.js'
import type { CardPreview } from '$lib/model/cardPreview.svelte.js'
import { bannerName, bannerTokenKind } from '$lib/model/names.js'

export type BannerPreview = CardPreview & { imageSrc: string; label: string }

/** A banner as its tile (2:1, the side it lies on), its tokens as the badge, as a magnifier enlarges it. */
export function bannerPreview(state: HydratedOathGameState, banner: Banner): BannerPreview {
    return {
        imageSrc: bannerImage(banner, state.isOnMobSide(banner)),
        aspect: 2,
        label: `the ${bannerName(banner)}`,
        badge: { kind: bannerTokenKind(banner), count: state.banners[banner].value }
    }
}
