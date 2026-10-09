import { assert, assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CoralColor, CoralCounts, coralCounts, totalCount } from '../components/colors.js'

export const ShrimpsPerPlayer = 4

// Facts any careful player could track are open unless the game plays Concealed.
const trackablePolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('concealed', false, { defaultValue: false })
)

export type ReefEncounterPlayerState = Type.Static<typeof ReefEncounterPlayerState>
// Left unevaluated: Type.Evaluate drops the protection from object-valued fields in the
// projected static type, which would make the hidden counts look always present.
export const ReefEncounterPlayerState = Type.Intersect([
    PlayerState,
    Type.Object({
        knownScreenPolyps: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        secretScreenPolyps: Visibility.protect(CoralCounts, {
            policy: Visibility.Policy.Owner
        }),
        secretParrotfishPolyps: Visibility.protect(CoralCounts, {
            policy: Visibility.Policy.Owner
        }),
        larvaCubes: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        shrimpsBehindScreen: Visibility.protect(Type.Number(), { policy: trackablePolicy })
    })
])

export const ReefEncounterPlayerStateValidator = Compile(ReefEncounterPlayerState)

export const ReefEncounterProjectedPlayerState =
    Visibility.createProjectionSchema(ReefEncounterPlayerState)
export type ReefEncounterProjectedPlayerState = Type.Static<
    typeof ReefEncounterProjectedPlayerState
>
const ReefEncounterProjectedPlayerStateValidator = Compile(ReefEncounterProjectedPlayerState)

export function newPlayerState(
    playerId: string,
    color: Color,
    dealtPolyps: CoralCounts
): ReefEncounterPlayerState {
    return {
        playerId,
        color,
        knownScreenPolyps: coralCounts(),
        secretScreenPolyps: dealtPolyps,
        secretParrotfishPolyps: coralCounts(),
        larvaCubes: coralCounts(),
        shrimpsBehindScreen: ShrimpsPerPlayer
    }
}

export class HydratedReefEncounterPlayerState
    extends Hydratable<typeof ReefEncounterProjectedPlayerState>
    implements ReefEncounterProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare knownScreenPolyps?: CoralCounts
    declare secretScreenPolyps?: CoralCounts
    declare secretParrotfishPolyps?: CoralCounts
    declare larvaCubes?: CoralCounts
    declare shrimpsBehindScreen?: number

    constructor(data: ReefEncounterProjectedPlayerState) {
        super(data, ReefEncounterProjectedPlayerStateValidator)
    }

    hasFedParrotfish(): boolean {
        return totalCount(this.getSecretParrotfishPolyps()) > 0
    }

    hasSecretScreenPolyp(color: CoralColor): boolean {
        return this.getSecretScreenPolyps()[color] > 0
    }

    feedParrotfish(color: CoralColor) {
        assert(!this.hasFedParrotfish(), `Player ${this.playerId} has already fed their parrotfish`)
        assert(
            this.hasSecretScreenPolyp(color),
            `Player ${this.playerId} has no ${color} polyp to feed`
        )
        this.getSecretScreenPolyps()[color] -= 1
        this.getSecretParrotfishPolyps()[color] += 1
    }

    addLarvaCube(color: CoralColor) {
        this.getLarvaCubes()[color] += 1
    }

    getSecretScreenPolyps(): CoralCounts {
        assertExists(
            this.secretScreenPolyps,
            'Secret screen polyps are unavailable in this representation'
        )
        return this.secretScreenPolyps
    }

    getSecretParrotfishPolyps(): CoralCounts {
        assertExists(
            this.secretParrotfishPolyps,
            'The secret parrotfish polyp is unavailable in this representation'
        )
        return this.secretParrotfishPolyps
    }

    getLarvaCubes(): CoralCounts {
        assertExists(this.larvaCubes, 'Larva cubes are unavailable in this representation')
        return this.larvaCubes
    }
}
