import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    PhaseManager,
    PrngState,
    RoundManager
} from '@tabletop/common'
import { FeudumPlayerState, HydratedFeudumPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { Spaces, type SpaceId } from '../data/board.js'
import { GuildIds, MonsterIds, PlayerDiscRoles, type MonsterId } from '../data/components.js'
import { RegionIds, type LandscapeKind, type RegionId, type TileId } from '../data/regionTiles.js'
import { EpicVoyageTrack, MilitaryServiceTrack, type Epoch } from '../data/tracks.js'
import { FlowState } from './flow.js'
import { GuildsState } from './guildsState.js'
import { MonsterState, SpaceState } from './mapState.js'
import { SupplyState } from './supplyState.js'
import { FeudumVault } from './vault.js'
import {
    ComponentCount,
    EpochSchema,
    LandscapeKindSchema,
    recordOf,
    TileIdSchema,
    WritIdSchema
} from './stateSchemas.js'

export const CURRENT_FEUDUM_REVISION = 1

export type FeudumGameState = Type.Static<typeof FeudumGameState>
export const FeudumGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(FeudumPlayerState),
            machineState: Type.Enum(MachineState),
            /** R-X.3 */
            feudumRevision: Type.Number(),
            roundManager: RoundManager,
            phaseManager: PhaseManager,
            /** R-2.1, R-4.11 */
            epoch: EpochSchema,
            spaces: recordOf(
                Spaces.map((space) => space.id),
                SpaceState
            ),
            /** R-4.2.4 */
            monsters: Type.Record(Type.Enum(MonsterIds), MonsterState),
            guilds: GuildsState,
            /** R-4.3.1 Top first. */
            regionStacks: Type.Record(Type.Enum(RegionIds), Type.Array(TileIdSchema)),
            /** R-4.3.3, R-4.11.1 Discarded or removed tiles. */
            tilesOutOfGame: Type.Array(TileIdSchema),
            /** R-1.4-H2 The landscape of each tile no longer in a stack, by tile id. */
            tileLandscapes: Type.Record(Type.String(), LandscapeKindSchema),
            supply: SupplyState,
            /** R-5.1 Deck slots: a draw takes `top`, a writ going under gets `nextBottom`. */
            writDeck: Type.Object({ top: ComponentCount, nextBottom: ComponentCount }),
            /** R-4.4.2, R-4.4.4 Writs the table saw go under the deck. */
            publicDeckWrits: Type.Array(
                Type.Object({ slot: ComponentCount, writId: WritIdSchema })
            ),
            /** R-3.7.5 By playerId; absent: no disc on the track yet. */
            voyageTrack: Type.Record(
                Type.String(),
                Type.Integer({ minimum: 1, maximum: EpicVoyageTrack.length })
            ),
            /** R-4.9-H2 By playerId: spaces covered. */
            militaryService: Type.Record(
                Type.String(),
                Type.Integer({ minimum: 0, maximum: MilitaryServiceTrack.length })
            ),
            vault: FeudumVault,
            flow: FlowState
        })
    ])
)

export const FeudumGameStateValidator = Compile(FeudumGameState)

export class HydratedFeudumGameState
    extends HydratableGameState<typeof FeudumGameState, HydratedFeudumPlayerState>
    implements FeudumGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedFeudumPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare feudumRevision: number
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare roundManager: HydratedRoundManager
    declare phaseManager: HydratedPhaseManager
    declare epoch: Epoch
    declare spaces: Record<SpaceId, SpaceState>
    declare monsters: Record<MonsterId, MonsterState>
    declare guilds: GuildsState
    declare regionStacks: Record<RegionId, TileId[]>
    declare tilesOutOfGame: TileId[]
    declare tileLandscapes: Record<string, LandscapeKind>
    declare supply: SupplyState
    declare writDeck: FeudumGameState['writDeck']
    declare publicDeckWrits: FeudumGameState['publicDeckWrits']
    declare voyageTrack: Record<string, number>
    declare militaryService: Record<string, number>
    declare vault: FeudumVault
    declare flow: FlowState

    constructor(data: FeudumGameState) {
        super(data, FeudumGameStateValidator)

        this.players = data.players.map((player) => new HydratedFeudumPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }

    /** R-2.2.5 The turn order always starts at the starting player. */
    get startingPlayerId(): string {
        return this.turnManager.turnOrder[0]
    }

    /** R-2.2.5 The marker goes clockwise: the turn order rotates and the seat order stays. */
    passStartingPlayer(): string {
        this.turnManager.newFirstPlayer(this.turnManager.turnOrder[1])
        return this.startingPlayerId
    }

    /** R-1.1 Derived: the shared discs less reeves, the voyage disc and military discs. */
    freeDiscs(playerId: string): number {
        const reeves = GuildIds.flatMap((guild) => {
            const { master, journeyman, apprentice } = this.guilds.tracks[guild]
            return [master, journeyman, apprentice]
        }).filter((holder) => holder?.playerId === playerId && holder.reeve).length
        const voyage = Object.hasOwn(this.voyageTrack, playerId) ? 1 : 0
        return PlayerDiscRoles.shared - reeves - voyage - (this.militaryService[playerId] ?? 0)
    }

    /** R-4.1.4 Derived: the spaces this player rules. */
    ruledSpaceIds(playerId: string): SpaceId[] {
        return Spaces.map((space) => space.id).filter(
            (spaceId) => this.spaces[spaceId].ruler?.playerId === playerId
        )
    }

    /** R-4.9.2 Derived: ruling at least one feudum. */
    isVassal(playerId: string): boolean {
        return this.ruledSpaceIds(playerId).some(
            (spaceId) => this.spaces[spaceId].location.kind === 'feudum'
        )
    }
}
