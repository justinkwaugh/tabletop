import { Hold, Star, type LocaleId, type StarHold } from '@tabletop/napoleons-triumph'

export const STAR_POINTS =
    '0.000,-1.000 0.247,-0.340 0.951,-0.309 0.399,0.130 0.588,0.809 0.000,0.420 -0.588,0.809 -0.399,0.130 -0.951,-0.309 -0.247,-0.340'

export const STAR_INKS: Record<Star, string> = {
    [Star.Green]: '#11934a',
    [Star.Red]: '#d4262c',
    [Star.Black]: '#231f20',
    [Star.Blue]: '#1f6fb2'
}

// The map prints a locale's stars top to bottom in this order.
const PRINTED_ORDER = [Star.Green, Star.Red, Star.Black, Star.Blue]

export function inPrintedOrder(stars: readonly Star[]): Star[] {
    return PRINTED_ORDER.filter((star) => stars.includes(star))
}

export interface StarPaint {
    fill: string
    fillOpacity: number
}

const PERHAPS_HELD_FILL_OPACITY = 0.35

export function starPaint(star: Star, hold: Hold | undefined): StarPaint {
    return hold === undefined
        ? { fill: 'none', fillOpacity: 1 }
        : {
              fill: STAR_INKS[star],
              fillOpacity: hold === Hold.Held ? 1 : PERHAPS_HELD_FILL_OPACITY
          }
}

export function holdOf(holds: readonly StarHold[], star: Star, locale: LocaleId): Hold | undefined {
    return holds
        .find((candidate) => candidate.star === star)
        ?.locales.find((candidate) => candidate.locale === locale)?.hold
}
