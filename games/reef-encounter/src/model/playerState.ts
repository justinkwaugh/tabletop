import { assert, assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addCounts,
    CoralColor,
    CoralColors,
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
        knownSupplyPolyps: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        secretSupplyPolyps: Visibility.protect(CoralCounts, { policy: secretPolicy }),
        // How many secret polyps are left is trackable: everyone saw how many were dealt, and
        // the known ones are always played first.
        secretSupplyPolypCount: Visibility.protect(Type.Number(), { policy: trackablePolicy }),
        secretParrotfishPolyps: Visibility.protect(CoralCounts, { policy: secretPolicy }),
        knownParrotfishPolyps: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        larvaCubes: Visibility.protect(CoralCounts, { policy: trackablePolicy }),
        shrimpsInSupply: Visibility.protect(Type.Number(), { policy: trackablePolicy }),
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
        knownSupplyPolyps: coralCounts(),
        secretSupplyPolyps: dealtPolyps,
        secretSupplyPolypCount: totalCount(dealtPolyps),
        secretParrotfishPolyps: coralCounts(),
        knownParrotfishPolyps: coralCounts(),
        larvaCubes: coralCounts(),
        shrimpsInSupply: ShrimpsPerPlayer,
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
    declare knownSupplyPolyps?: CoralCounts
    declare secretSupplyPolyps?: CoralCounts
    declare secretSupplyPolypCount?: number
    declare secretParrotfishPolyps?: CoralCounts
    declare knownParrotfishPolyps?: CoralCounts
    declare larvaCubes?: CoralCounts
    declare shrimpsInSupply?: number
    declare shrimpOnOpenSea: boolean
    declare shrimpsInParrotfish?: number
    declare consumedPolyps: CoralCounts

    constructor(data: ReefEncounterProjectedPlayerState) {
        super(data, ReefEncounterProjectedPlayerStateValidator)
    }

    hasFedParrotfish(): boolean {
        return totalCount(this.getSecretParrotfishPolyps()) > 0
    }

    setupParrotfishPolyp(): CoralColor {
        const secret = this.getSecretParrotfishPolyps()
        const color = CoralColors.find((candidate) => secret[candidate] > 0)
        assertExists(color, `Player ${this.playerId} has not fed their parrotfish`)
        return color
    }

    hasSecretSupplyPolyp(color: CoralColor): boolean {
        return this.getSecretSupplyPolyps()[color] > 0
    }

    feedParrotfish(color: CoralColor) {
        assert(!this.hasFedParrotfish(), `Player ${this.playerId} has already fed their parrotfish`)
        assert(
            this.hasSecretSupplyPolyp(color),
            `Player ${this.playerId} has no ${color} polyp to feed`
        )
        this.spendSecretSupplyPolyp(color)
        this.getSecretParrotfishPolyps()[color] += 1
    }

    addLarvaCube(color: CoralColor) {
        this.getLarvaCubes()[color] += 1
    }

    // Polyps taken from the open sea were seen by everyone, so they join the known polyps.
    addKnownSupplyPolyps(polyps: readonly CoralColor[]) {
        const known = this.getKnownSupplyPolyps()
        for (const polyp of polyps) {
            known[polyp] += 1
        }
    }

    hasSupplyPolyp(color: CoralColor): boolean {
        return this.getKnownSupplyPolyps()[color] + this.getSecretSupplyPolyps()[color] > 0
    }

    // Polyps others saw arrive are played first, so opponents learn only what they could track.
    spendSupplyPolyp(color: CoralColor) {
        assert(
            this.hasSupplyPolyp(color),
            `Player ${this.playerId} has no ${color} polyp in the supply`
        )
        const known = this.getKnownSupplyPolyps()
        if (known[color] > 0) {
            known[color] -= 1
        } else {
            this.spendSecretSupplyPolyp(color)
        }
    }

    private spendSecretSupplyPolyp(color: CoralColor) {
        this.getSecretSupplyPolyps()[color] -= 1
        this.secretSupplyPolypCount = this.getSecretSupplyPolypCount() - 1
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
        assert(this.getShrimpsInSupply() > 0, `Player ${this.playerId} has no shrimp in the supply`)
        this.shrimpsInSupply = this.getShrimpsInSupply() - 1
    }

    returnShrimp() {
        this.shrimpsInSupply = this.getShrimpsInSupply() + 1
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

    shrimpsEaten(): number {
        return (this.shrimpOnOpenSea ? 1 : 0) + this.getShrimpsInParrotfish()
    }

    supplyPolypCount(): number {
        return totalCount(this.getKnownSupplyPolyps()) + this.getSecretSupplyPolypCount()
    }

    getSupplyPolyps(): CoralCounts {
        return addCounts(this.getKnownSupplyPolyps(), this.getSecretSupplyPolyps())
    }

    getParrotfishPolyps(): CoralCounts {
        return addCounts(this.getKnownParrotfishPolyps(), this.getSecretParrotfishPolyps())
    }

    visibleParrotfishPolyps(): CoralCounts | undefined {
        return this.knownParrotfishPolyps
            ? addCounts(this.knownParrotfishPolyps, this.secretParrotfishPolyps)
            : undefined
    }

    visibleSupplyPolyps(): CoralCounts | undefined {
        return this.knownSupplyPolyps
            ? addCounts(this.knownSupplyPolyps, this.secretSupplyPolyps)
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

    getKnownSupplyPolyps(): CoralCounts {
        assertExists(
            this.knownSupplyPolyps,
            'Known supply polyps are unavailable in this representation'
        )
        return this.knownSupplyPolyps
    }

    getSecretSupplyPolyps(): CoralCounts {
        assertExists(
            this.secretSupplyPolyps,
            'Secret supply polyps are unavailable in this representation'
        )
        return this.secretSupplyPolyps
    }

    getSecretSupplyPolypCount(): number {
        assertExists(
            this.secretSupplyPolypCount,
            'The number of secret supply polyps is unavailable in this representation'
        )
        return this.secretSupplyPolypCount
    }

    getSecretParrotfishPolyps(): CoralCounts {
        assertExists(
            this.secretParrotfishPolyps,
            'The secret parrotfish polyp is unavailable in this representation'
        )
        return this.secretParrotfishPolyps
    }

    getShrimpsInSupply(): number {
        assertExists(
            this.shrimpsInSupply,
            'Shrimps in the supply are unavailable in this representation'
        )
        return this.shrimpsInSupply
    }

    getLarvaCubes(): CoralCounts {
        assertExists(this.larvaCubes, 'Larva cubes are unavailable in this representation')
        return this.larvaCubes
    }
}
