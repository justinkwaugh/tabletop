import { type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Roof } from './roof.js'
import { HydratedDrawBag, DrawBag, RandomFunction } from '@tabletop/common'
import { PieceType } from './pieceType.js'

export type RoofBag = Static<typeof RoofBag>
export const RoofBag = DrawBag(Roof)

export const RoofBagValidator = TypeCompiler.Compile(RoofBag)

export class HydratedRoofBag extends HydratedDrawBag<Roof, typeof RoofBag> implements RoofBag {
    static create(random: RandomFunction) {
        const roofs: Roof[] = []
        for (let i: number = 1; i < 7; i++) {
            roofs.push({ pieceType: PieceType.Roof, value: i })
            roofs.push({ pieceType: PieceType.Roof, value: i })
        }

        const roofBag: RoofBag = {
            items: roofs,
            remaining: roofs.length
        }

        const hydratedRoofBag = new HydratedRoofBag(roofBag)
        hydratedRoofBag.shuffle(random)
        return hydratedRoofBag
    }

    constructor(data: RoofBag) {
        super(data, RoofBagValidator)
    }
}
