import { Variety } from '@tabletop/dicke-kartoffeln'
import amalie from '$lib/images/tokens/amalie.webp'
import biola from '$lib/images/tokens/biola.webp'
import chris from '$lib/images/tokens/chris.webp'
import fertilizer from '$lib/images/tokens/fertilizer.webp'
import skull from '$lib/images/tokens/skull.webp'
import sunflower from '$lib/images/tokens/sunflower.webp'
import worm from '$lib/images/tokens/worm1.webp'
import worms from '$lib/images/tokens/worms2.webp'

export const SEED_IMAGES: Record<Variety, string> = {
    [Variety.Amalie]: amalie,
    [Variety.Biola]: biola,
    [Variety.Chris]: chris
}

export const TOKEN_IMAGES = { fertilizer, skull, sunflower, worm, worms }

// The worm counters come as pairs and singles.
export function wormTiles(count: number): ('pair' | 'single')[] {
    return [
        ...Array.from({ length: Math.floor(count / 2) }, () => 'pair' as const),
        ...(count % 2 === 1 ? ['single' as const] : [])
    ]
}

export const VARIETY_LETTERS: Record<Variety, string> = {
    [Variety.Amalie]: 'A',
    [Variety.Biola]: 'B',
    [Variety.Chris]: 'C'
}
