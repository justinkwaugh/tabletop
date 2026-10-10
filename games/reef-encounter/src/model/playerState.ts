import { assert, assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addCounts,
    CoralColor,
    CoralCounts,
    coralCounts,
    totalCount
} from '../components/colors.js'
import { MachineState } from '../definition/states.js'

export const ShrimpsPerPlayer = 4

// Facts any careful player could track are open unless the game plays Concealed.
const trackablePolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('concealed', false, { defaultValue: false }),
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

const secretPolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

export type ReefEncounterPlayerState = Type.Static<typeof ReefEncounterPlayerState>
// Left unevaluated: Type.Evaluate drops the protection from object-valued fields in the
// projected static type, which would make the hidden counts look always present.
export const ReefEncounterPlayerState = Type.Intersect([
    PlayerState,
    Type.Object({
        knownScreenPolyps: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        secretScreenPolyps: Visibility.protect(CoralCounts, { policy: secretPolicy }),
        // How many secret polyps are left is trackable: everyone saw how many were dealt, and
        // the known ones are always played first.
        secretScreenPolypCount: Visibility.protect(Type.Number(), { policy: trackablePolicy }),
        secretParrotfishPolyps: Visibility.protect(CoralCounts, { policy: secretPolicy }),
        knownParrotfishPolyps: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        larvaCubes: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        shrimpsBehindScreen: Visibility.protect(Type.Number(), { policy: trackablePolicy }),
        // The first shrimp a parrotfish eats goes on the open-sea board for all to see;
        // later ones go inside the parrotfish.
        shrimpOnOpenSea: Type.Boolean(),
        shrimpsInParrotfish: Visibility.protect(Type.Number(), { policy: trackablePolicy }),
        consumedPolyps: CoralCounts
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
        secretScreenPolypCount: totalCount(dealtPolyps),
        secretParrotfishPolyps: coralCounts(),
        knownParrotfishPolyps: coralCounts(),
        larvaCubes: coralCounts(),
        shrimpsBehindScreen: ShrimpsPerPlayer,
        shrimpOnOpenSea: false,
        shrimpsInParrotfish: 0,
        consumedPolyps: coralCounts()
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
    declare secretScreenPolypCount?: number
    declare secretParrotfishPolyps?: CoralCounts
    declare knownParrotfishPolyps?: CoralCounts
    declare larvaCubes?: CoralCounts
    declare shrimpsBehindScreen?: number
    declare shrimpOnOpenSea: boolean
    declare shrimpsInParrotfish?: number
    declare consumedPolyps: CoralCounts

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
        this.spendSecretScreenPolyp(color)
        this.getSecretParrotfishPolyps()[color] += 1
    }

    addLarvaCube(color: CoralColor) {
        this.getLarvaCubes()[color] += 1
    }

    // Polyps taken from the open sea were seen by everyone, so they join the known polyps.
    addKnownScreenPolyps(polyps: readonly CoralColor[]) {
        const known = this.getKnownScreenPolyps()
        for (const polyp of polyps) {
            known[polyp] += 1
        }
    }

    hasScreenPolyp(color: CoralColor): boolean {
        return this.getKnownScreenPolyps()[color] + this.getSecretScreenPolyps()[color] > 0
    }

    // Polyps others saw arrive are played first, so opponents learn only what they could track.
    spendScreenPolyp(color: CoralColor) {
        assert(
            this.hasScreenPolyp(color),
            `Player ${this.playerId} has no ${color} polyp behind the screen`
        )
        const known = this.getKnownScreenPolyps()
        if (known[color] > 0) {
            known[color] -= 1
        } else {
            this.spendSecretScreenPolyp(color)
        }
    }

    private spendSecretScreenPolyp(color: CoralColor) {
        this.getSecretScreenPolyps()[color] -= 1
        this.secretScreenPolypCount = this.getSecretScreenPolypCount() - 1
    }

    spendConsumedPolyp(color: CoralColor) {
        assert(
            this.consumedPolyps[color] > 0,
            `Player ${this.playerId} has no consumed ${color} polyp`
        )
        this.consumedPolyps[color] -= 1
    }

    addConsumedPolyp(color: CoralColor) {
        this.consumedPolyps[color] += 1
    }

    spendLarvaCube(color: CoralColor) {
        assert(
            this.getLarvaCubes()[color] > 0,
            `Player ${this.playerId} has no ${color} larva cube`
        )
        this.getLarvaCubes()[color] -= 1
    }

    spendShrimp() {
        assert(
            this.getShrimpsBehindScreen() > 0,
            `Player ${this.playerId} has no shrimp behind the screen`
        )
        this.shrimpsBehindScreen = this.getShrimpsBehindScreen() - 1
    }

    returnShrimp() {
        this.shrimpsBehindScreen = this.getShrimpsBehindScreen() + 1
    }

    // Action 1: what is left of the eaten coral, and its shrimp, go into the parrotfish.
    eat(color: CoralColor, polyps: number) {
        this.getKnownParrotfishPolyps()[color] += polyps
        if (this.shrimpOnOpenSea) {
            this.shrimpsInParrotfish = this.getShrimpsInParrotfish() + 1
        } else {
            this.shrimpOnOpenSea = true
        }
    }

    screenPolypCount(): number {
        return totalCount(this.getKnownScreenPolyps()) + this.getSecretScreenPolypCount()
    }

    getScreenPolyps(): CoralCounts {
        return addCounts(this.getKnownScreenPolyps(), this.getSecretScreenPolyps())
    }

    getParrotfishPolyps(): CoralCounts {
        return addCounts(this.getKnownParrotfishPolyps(), this.getSecretParrotfishPolyps())
    }

    visibleParrotfishPolyps(): CoralCounts | undefined {
        return this.knownParrotfishPolyps
            ? addCounts(this.knownParrotfishPolyps, this.secretParrotfishPolyps)
            : undefined
    }

    visibleScreenPolyps(): CoralCounts | undefined {
        return this.knownScreenPolyps
            ? addCounts(this.knownScreenPolyps, this.secretScreenPolyps)
            : undefined
    }

    getKnownParrotfishPolyps(): CoralCounts {
        assertExists(
            this.knownParrotfishPolyps,
            'Known parrotfish polyps are unavailable in this representation'
        )
        return this.knownParrotfishPolyps
    }

    getShrimpsInParrotfish(): number {
        assertExists(
            this.shrimpsInParrotfish,
            'Shrimps in the parrotfish are unavailable in this representation'
        )
        return this.shrimpsInParrotfish
    }

    getKnownScreenPolyps(): CoralCounts {
        assertExists(
            this.knownScreenPolyps,
            'Known screen polyps are unavailable in this representation'
        )
        return this.knownScreenPolyps
    }

    getSecretScreenPolyps(): CoralCounts {
        assertExists(
            this.secretScreenPolyps,
            'Secret screen polyps are unavailable in this representation'
        )
        return this.secretScreenPolyps
    }

    getSecretScreenPolypCount(): number {
        assertExists(
            this.secretScreenPolypCount,
            'The number of secret screen polyps is unavailable in this representation'
        )
        return this.secretScreenPolypCount
    }

    getSecretParrotfishPolyps(): CoralCounts {
        assertExists(
            this.secretParrotfishPolyps,
            'The secret parrotfish polyp is unavailable in this representation'
        )
        return this.secretParrotfishPolyps
    }

    getShrimpsBehindScreen(): number {
        assertExists(
            this.shrimpsBehindScreen,
            'Shrimps behind the screen are unavailable in this representation'
        )
        return this.shrimpsBehindScreen
    }

    getLarvaCubes(): CoralCounts {
        assertExists(this.larvaCubes, 'Larva cubes are unavailable in this representation')
        return this.larvaCubes
    }
}
