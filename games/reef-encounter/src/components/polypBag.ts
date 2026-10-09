import { DrawBag, HydratedDrawBag } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CoralColor } from './colors.js'

export type PolypBag = Type.Static<typeof PolypBag>
export const PolypBag = DrawBag(Type.Enum(CoralColor))

const PolypBagValidator = Compile(PolypBag)

export class HydratedPolypBag
    extends HydratedDrawBag<CoralColor, typeof PolypBag>
    implements PolypBag
{
    static create(polyps: readonly CoralColor[]): HydratedPolypBag {
        return new HydratedPolypBag({ items: [...polyps], remaining: polyps.length })
    }

    constructor(data: PolypBag) {
        super(data, PolypBagValidator)
    }

    // Bonus polyps are replenished by picking their colour out of the bag, not by drawing.
    takeColor(color: CoralColor): boolean {
        const index = this.items.slice(0, this.remaining).indexOf(color)
        if (index < 0) {
            return false
        }
        this.items.splice(index, 1)
        this.remaining -= 1
        return true
    }
}
