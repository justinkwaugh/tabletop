import { Compile } from 'typebox/compile'
import { Roof } from './roof.js'
import { HydratedDrawBag, DrawBag, type RandomFunction } from '@tabletop/common'
import { PieceType } from './pieceType.js'
import * as Type from 'typebox'

export type RoofBag = Type.Static<typeof RoofBag>
export const RoofBag = DrawBag(Roof)

export const RoofBagValidator = Compile(RoofBag)

const RoofValues = [1, 2, 3, 4, 5, 6]
const CopiesOfEachRoof = 2
export const RoofCount = RoofValues.length * CopiesOfEachRoof

export class HydratedRoofBag extends HydratedDrawBag<Roof, typeof RoofBag> implements RoofBag {
    static create(random: RandomFunction) {
        const roofs: Roof[] = RoofValues.flatMap((value) =>
            Array.from({ length: CopiesOfEachRoof }, () => ({ pieceType: PieceType.Roof, value }))
        )

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
