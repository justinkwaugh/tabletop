import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState, Visibility, assertExists } from '@tabletop/common'
import { BonusChit } from '../components/bonusChits.js'
import { GoodCounts, totalGoods } from '../components/goods.js'
import { sortMarkers, withoutMarkers } from '../components/routeMarkers.js'
import { concealedValuePolicy } from './city.js'

export type KoggePlayerState = Type.Static<typeof KoggePlayerState>
export const KoggePlayerState = Type.Object({
    ...PlayerState.properties,
    goods: GoodCounts,
    markers: Visibility.protect(Type.Array(Type.Integer({ minimum: 0 })), {
        policy: concealedValuePolicy
    }),
    markerCount: Type.Integer({ minimum: 0 }),
    city: Type.Optional(Type.Integer({ minimum: 0 })),
    raidMarkers: Type.Integer({ minimum: 0 }),
    claimedSecondRaid: Type.Boolean(),
    bonusChits: Type.Array(Type.Enum(BonusChit))
})

export const KoggeProjectedPlayerState = Visibility.createProjectionSchema(KoggePlayerState)
export type KoggeProjectedPlayerState = Type.Static<typeof KoggeProjectedPlayerState>
const KoggeProjectedPlayerStateValidator = Compile(KoggeProjectedPlayerState)

export class HydratedKoggePlayerState
    extends Hydratable<typeof KoggeProjectedPlayerState>
    implements KoggeProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare goods: GoodCounts
    declare markers?: number[]
    declare markerCount: number
    declare city?: number
    declare raidMarkers: number
    declare claimedSecondRaid: boolean
    declare bonusChits: BonusChit[]

    constructor(data: KoggeProjectedPlayerState) {
        super(data, KoggeProjectedPlayerStateValidator)
    }

    hand(): number[] {
        assertExists(this.markers, 'Route markers are unavailable in this representation')
        return this.markers
    }

    takeMarkers(markers: readonly number[]) {
        this.markers = sortMarkers([...this.hand(), ...markers])
        this.markerCount = this.markers.length
    }

    giveMarkers(markers: readonly number[]) {
        this.markers = withoutMarkers(this.hand(), markers)
        this.markerCount = this.markers.length
    }

    location(): number {
        assertExists(this.city, `${this.playerId} has not chosen a start city`)
        return this.city
    }

    hasBonus(chit: BonusChit): boolean {
        return this.bonusChits.includes(chit)
    }

    bonusCount(chit: BonusChit): number {
        return this.bonusChits.filter((held) => held === chit).length
    }

    cargoCount(): number {
        return totalGoods(this.goods)
    }
}
