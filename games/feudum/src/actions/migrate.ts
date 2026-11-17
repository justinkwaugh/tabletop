import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import { GuildIds, type Character } from '../data/components.js'
import type { GuildRank } from '../data/guilds.js'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { rankOf, RankChange } from '../model/guildStatus.js'
import { presenceSpaceIds } from '../model/locationControl.js'
import { abandonVessel } from '../model/media.js'
import {
    canCoverWithWildTiles,
    canPayGoods,
    canSpendWildTiles,
    goodsShort,
    payGoods,
    WildTileSpend,
    type GoodPrice
} from '../model/payments.js'
import {
    GuildIdSchema,
    PawnNumberSchema,
    SpaceIdSchema,
    VesselTypeSchema
} from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    specialOffered,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'
import { StartingSpaceIds } from './placeStartingPawn.js'

/** R-3.6.1 What entering the board costs. */
export const MigrateFood: GoodPrice = { food: 1 }

export type PawnNumber = Type.Static<typeof PawnNumberSchema>

/** R-3.6.1 Where a pawn enters and what it turns to, or `off`. */
export type MigrateOnto = Type.Static<typeof MigrateOnto>
export const MigrateOnto = Type.Union([
    Type.Object({ character: GuildIdSchema, spaceId: SpaceIdSchema }),
    Type.Literal('off')
])

/** R-3.6.1 Going off: where the pawn stood and what it was; the input names only the pawn. */
export type PawnLeft = Type.Static<typeof PawnLeft>
export const PawnLeft = Type.Object({
    spaceId: SpaceIdSchema,
    character: GuildIdSchema,
    /** R-3.6-H1 Stays on the space, abandoned. */
    vessel: Type.Optional(VesselTypeSchema),
    /** R-3.6-H1 The pawn's wine sulfur went to the haversack. */
    wine: Type.Optional(Type.Literal(true))
})

export type MigrateMetadata = Type.Static<typeof MigrateMetadata>
export const MigrateMetadata = Type.Object({
    left: Type.Optional(PawnLeft),
    /** R-3.6.3 */
    rankChanges: Type.Array(RankChange)
})

export type Migrate = Type.Static<typeof Migrate>
export const Migrate = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Migrate),
            playerId: Type.String(),
            metadata: Type.Optional(MigrateMetadata),
            pawn: PawnNumberSchema,
            onto: MigrateOnto,
            /** R-3.6.2 */
            distantKin: Type.Optional(Type.Literal(true)),
            /** R-4.4-H1 Spent first, so they can cover the food. */
            wildTiles: Type.Optional(Type.Array(WildTileSpend))
        })
    ])
)

export const MigrateValidator = Compile(Migrate)

export function isMigrate(action?: GameAction): action is Migrate {
    return action?.type === ActionType.Migrate
}

export type MigrateInput = CardPlayInput &
    Readonly<Pick<Migrate, 'pawn' | 'onto' | 'distantKin' | 'wildTiles'>>

/** R-3.6.1 A space with the seat's pawn or marker; with neither anywhere, a starting space. */
export function migrateSpaceIds(state: HydratedFeudumGameState, playerId: string): SpaceId[] {
    const presence = presenceSpaceIds(state, playerId)
    return presence.length > 0 ? presence : [...StartingSpaceIds]
}

/** R-3.6.1, R-3.6.2, R-4.4-H1 */
function reasonEnterRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    input: MigrateInput
): string | undefined {
    const wildTiles = input.wildTiles ?? []
    if (!canSpendWildTiles(state, playerId, wildTiles)) {
        return "You can't spend those region tiles."
    }
    if (!canPayGoods(state, playerId, MigrateFood, wildTiles)) {
        return 'Migrating onto the board needs 1 food.'
    }
    if (input.distantKin) {
        return (
            reasonSpecialRefused(state, playerId, 'migrate') ??
            (StartingSpaceIds.includes(spaceId)
                ? undefined
                : 'Distant Kin enters at a starting space.')
        )
    }
    if (migrateSpaceIds(state, playerId).includes(spaceId)) {
        return undefined
    }
    return presenceSpaceIds(state, playerId).length > 0
        ? 'You have no pawn or marker on that space.'
        : 'With no pawn or marker on the board, a pawn enters at a starting space.'
}

/** R-3.6.1, R-3.6.2 */
export function reasonMigrateRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: MigrateInput
): string | undefined {
    const refused = reasonCardPlayRefused(state, playerId, 'migrate', input)
    if (refused) {
        return refused
    }
    const { pawns } = state.getPlayerState(playerId)
    const pawn = pawns.find((held) => held.n === input.pawn)
    assertExists(pawn, `R-1.1 ${playerId} has pawn ${input.pawn}`)
    if (input.onto === 'off') {
        if (!pawn.spaceId) {
            return "That pawn isn't on the board."
        }
        if (input.distantKin) {
            return 'Distant Kin brings a pawn onto the board.'
        }
        return input.wildTiles?.length ? 'Migrating off is free.' : undefined
    }
    if (pawns.every((held) => held.spaceId)) {
        return 'No pawn in supply.'
    }
    return pawn.spaceId
        ? 'That pawn is already on the board.'
        : reasonEnterRefused(state, playerId, input.onto.spaceId, input)
}

/**
 * R-3.6.1, R-3.6-H1 The pawn goes home with no space and no character. Its vessel stays on the
 * space (R-4.2.2) and its wine sulfur goes to the haversack.
 */
export function leaveBoard(
    state: HydratedFeudumGameState,
    playerId: string,
    pawnNumber: PawnNumber
): PawnLeft {
    const pawn = state.getPlayerState(playerId).pawns.find((held) => held.n === pawnNumber)
    assertExists(pawn, `R-1.1 ${playerId} has pawn ${pawnNumber}`)
    const { spaceId, character, vessel, wine } = pawn
    assertExists(spaceId, 'R-3.6.1 A pawn going off stands on a space')
    assertExists(character, 'R-1.1 A pawn on the board shows a character')
    if (vessel) {
        abandonVessel(state, spaceId, vessel)
    }
    if (wine) {
        returnGoodToHaversack(state, 'sulfur')
    }
    pawn.spaceId = undefined
    pawn.character = undefined
    pawn.vessel = undefined
    pawn.wine = undefined
    return { spaceId, character, ...(vessel ? { vessel } : {}), ...(wine ? { wine: true } : {}) }
}

function enterBoard(
    state: HydratedFeudumGameState,
    playerId: string,
    pawnNumber: PawnNumber,
    character: Character,
    spaceId: SpaceId
): void {
    const pawn = state.getPlayerState(playerId).pawns.find((held) => held.n === pawnNumber)
    assertExists(pawn, `R-1.1 ${playerId} has pawn ${pawnNumber}`)
    pawn.character = character
    pawn.spaceId = spaceId
}

export interface MigrateOffers {
    readonly pawnsOff: readonly PawnNumber[]
    readonly pawnsOn: readonly PawnNumber[]
    /** R-3.6.1 Empty when the food can't be found, by a wild tile either. */
    readonly spaces: readonly SpaceId[]
    /** R-3.6.2 Starting spaces open only by Distant Kin; empty when it isn't offered. */
    readonly distantKinSpaces: readonly SpaceId[]
    /** R-4.4-H1 The seat holds no food, so a wild tile must cover it. */
    readonly wildTileNeeded: boolean
    /** R-4.5 The rank each character would give now; absent: no rank. */
    readonly characters: readonly { readonly character: Character; readonly rank?: GuildRank }[]
}

/** R-3.6.1, R-3.6.2, R-4.5 The rank runs the real recompute on a copy of the table. */
export function migrateOffers(state: HydratedFeudumGameState, playerId: string): MigrateOffers {
    const { pawns } = state.getPlayerState(playerId)
    const pawnsOff = pawns.filter((pawn) => !pawn.spaceId).map((pawn) => pawn.n)
    const pawnsOn = pawns.filter((pawn) => pawn.spaceId).map((pawn) => pawn.n)
    const canEnter = pawnsOff.length > 0 && canCoverWithWildTiles(state, playerId, MigrateFood)
    const spaces = canEnter ? migrateSpaceIds(state, playerId) : []
    const distantKinSpaces =
        canEnter && specialOffered(state, playerId, 'migrate')
            ? StartingSpaceIds.filter((spaceId) => !spaces.includes(spaceId))
            : []
    const characters = canEnter
        ? GuildIds.map((character) => {
              const trial = new HydratedFeudumGameState(state.dehydrate())
              enterBoard(trial, playerId, pawnsOff[0], character, StartingSpaceIds[0])
              trial.recomputeRanks(playerId)
              const rank = rankOf(trial.guilds.tracks[character], playerId)
              return { character, ...(rank ? { rank } : {}) }
          })
        : []
    return {
        pawnsOff,
        pawnsOn,
        spaces,
        distantKinSpaces,
        wildTileNeeded: goodsShort(state, playerId, MigrateFood).food > 0,
        characters
    }
}

export class HydratedMigrate extends HydratableAction<typeof Migrate> implements Migrate {
    declare type: ActionType.Migrate
    declare playerId: string
    declare metadata?: MigrateMetadata
    declare pawn: PawnNumber
    declare onto: MigrateOnto
    declare distantKin?: true
    declare wildTiles?: WildTileSpend[]
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Migrate) {
        super(data, MigrateValidator)
    }

    /** R-3.6.1, R-3.6.2, R-3.6.3 Food goes to the haversack; status changes at once. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonMigrateRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(state, this.playerId, 'migrate', this.distantKin ? 'special' : 'regular', this)
        if (this.onto === 'off') {
            const left = leaveBoard(state, this.playerId, this.pawn)
            this.metadata = { left, rankChanges: state.recomputeRanks(this.playerId) }
            return
        }
        payGoods(state, this.playerId, MigrateFood, this.wildTiles ?? [])
        enterBoard(state, this.playerId, this.pawn, this.onto.character, this.onto.spaceId)
        this.metadata = { rankChanges: state.recomputeRanks(this.playerId) }
    }
}
