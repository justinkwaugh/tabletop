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
}
