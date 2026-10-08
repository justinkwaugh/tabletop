import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { DrawBag, HydratedDrawBag, Visibility, type RandomFunction } from '@tabletop/common'

export type RouteMarkerReserve = Type.Static<typeof RouteMarkerReserve>
export const RouteMarkerReserve = DrawBag(Type.Integer({ minimum: 0 }))

const RouteMarkerReserveProjection = Visibility.createProjectionSchema(RouteMarkerReserve)
type RouteMarkerReserveProjection = Type.Static<typeof RouteMarkerReserveProjection>
const RouteMarkerReserveProjectionValidator = Compile(RouteMarkerReserveProjection)

export class HydratedRouteMarkerReserve
    extends HydratedDrawBag<number, typeof RouteMarkerReserveProjection>
    implements RouteMarkerReserve
{
    declare items: number[]
    declare remaining: number

    constructor(data: RouteMarkerReserveProjection) {
        super(data, RouteMarkerReserveProjectionValidator)
    }

    static filled(markers: readonly number[]): HydratedRouteMarkerReserve {
        return new HydratedRouteMarkerReserve({ items: [...markers], remaining: markers.length })
    }

    returnMarkers(markers: readonly number[]) {
        for (const marker of markers) {
            this.addItem(marker)
        }
    }

    drawRandom(count: number, random: RandomFunction): number[] {
        const drawn = Math.min(count, this.count())
        if (drawn === 0) {
            return []
        }
        this.shuffle(random)
        return this.drawItems(drawn)
    }

    contains(value: number): boolean {
        return this.items.includes(value)
    }

    takeValue(value: number) {
        const index = this.items.indexOf(value)
        if (index < 0) {
            throw Error(`No route marker ${value} in the reserve`)
        }
        this.items.splice(index, 1)
        this.remaining -= 1
    }
}
