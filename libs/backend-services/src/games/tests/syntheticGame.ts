import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AuctionType,
    BaseGameInitializer,
    Color,
    DrawBag,
    GameAction,
    GameState,
    HydratableAction,
    HydratableGameState,
    HydratedTurnManager,
    PlayerAction,
    PlayerState,
    Prng,
    SimultaneousAuction,
    TieResolutionStrategy,
    Visibility,
    type Game,
    type GameRuntime,
    type MachineContext,
    type UninitializedGameState
} from '@tabletop/common'

const Token = Type.Object({ id: Type.String() })
const State = Type.Object({
    ...GameState.properties,
    machineState: Type.Literal('playing'),
    board: Type.Array(Type.Number()),
    drawPile: DrawBag(Token),
    drawn: Type.Optional(Token),
    currentAuction: Type.Optional(SimultaneousAuction)
})
const CanonicalValidator = Compile(State)
const ProjectedState = Visibility.createProjectionSchema(State)
type ProjectedState = Type.Static<typeof ProjectedState>
const ProjectedValidator = Compile(ProjectedState)

class SyntheticState extends HydratableGameState<typeof ProjectedState, PlayerState> {
    declare machineState: 'playing'
    declare board: number[]
    declare drawPile: ProjectedState['drawPile']
    declare drawn?: ProjectedState['drawn']
    declare currentAuction?: ProjectedState['currentAuction']

    constructor(state: ProjectedState) {
        super(state, ProjectedValidator)
    }
}

export const Step = Type.Object({ ...PlayerAction.properties, type: Type.Literal('step') })
export type Step = Type.Static<typeof Step>
const StepValidator = Compile(Step)
class StepAction extends HydratableAction<typeof Step> {
    constructor(action: Step) {
        super(action, StepValidator)
    }
    apply(state: SyntheticState) {
        state.board.push(state.getPublicPrng().random(), state.getProtectedPrng().random())
    }
}

const OpenAuction = Type.Object({ ...GameAction.properties, type: Type.Literal('openAuction') })
const OpenAuctionValidator = Compile(OpenAuction)
class OpenAuctionAction extends HydratableAction<typeof OpenAuction> {
    constructor(action: Type.Static<typeof OpenAuction>) {
        super(action, OpenAuctionValidator)
    }
    apply(state: SyntheticState) {
        state.currentAuction = {
            id: state.getPublicPrng().randId(),
            type: AuctionType.Simultaneous,
            participants: state.players.map((player) => ({
                playerId: player.playerId,
                passed: false
            })),
            auctioneerId: state.activePlayerIds[0],
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        }
    }
}

export const Draw = Type.Object({
    ...PlayerAction.properties,
    type: Type.Literal('draw'),
    revealsInfo: Type.Literal(true)
})
export type Draw = Type.Static<typeof Draw>
const DrawValidator = Compile(Draw)
class DrawAction extends HydratableAction<typeof Draw> {
    constructor(action: Draw) {
        super(action, DrawValidator)
    }
    apply(state: SyntheticState, context?: MachineContext) {
        assertExists(context, 'Draw requires a cascade context')
        const token = state.drawPile.items.pop()
        assertExists(token, 'Draw requires a token')
        state.drawn = token
        state.drawPile.remaining--
        context.addSystemAction(OpenAuction, {})
    }
}

export const PlaceBid = Type.Object({
    ...PlayerAction.properties,
    type: Type.Literal('bid'),
    amount: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Actor })
})
export type PlaceBid = Type.Static<typeof PlaceBid>
const BidValidator = Compile(PlaceBid)
class BidAction extends HydratableAction<typeof PlaceBid> {
    declare playerId: string
    declare amount: number
    constructor(action: PlaceBid) {
        super(action, BidValidator)
    }
    apply(state: SyntheticState) {
        const participant = state.currentAuction?.participants.find(
            (player) => player.playerId === this.playerId
        )
        assertExists(participant, 'Bidder must participate in the auction')
        participant.bid = this.amount
    }
}

class Initializer extends BaseGameInitializer<ProjectedState, SyntheticState> {
    initializeGameState(game: Game, state: UninitializedGameState): SyntheticState {
        const colors = [Color.Red, Color.Blue, Color.Green]
        const players = game.players.map((player, index) => ({
            playerId: player.id,
            color: colors[index]
        }))
        return new SyntheticState({
            ...state,
            players,
            machineState: 'playing',
            board: [],
            turnManager: HydratedTurnManager.generate(players, new Prng(state.prng).random),
            drawPile: { items: [{ id: 'hidden-one' }, { id: 'hidden-two' }], remaining: 2 }
        })
    }
    initializeExplorationState(state: ProjectedState): ProjectedState {
        return state
    }
}

export const SyntheticRuntime = {
    initializer: new Initializer(),
    canonicalStateValidator: CanonicalValidator,
    hydrator: {
        hydrateState: (state: ProjectedState) => new SyntheticState(state),
        hydrateAction(action: GameAction) {
            if (StepValidator.Check(action)) return new StepAction(action)
            if (DrawValidator.Check(action)) return new DrawAction(action)
            if (OpenAuctionValidator.Check(action)) return new OpenAuctionAction(action)
            if (BidValidator.Check(action)) return new BidAction(action)
            throw Error('Unknown synthetic Action')
        }
    },
    playerColors: [Color.Red, Color.Blue, Color.Green],
    apiActions: { step: Step, draw: Draw, bid: PlaceBid },
    stateHandlers: {
        playing: {
            enter() {},
            validActionsForPlayer() {
                return ['step', 'draw', 'bid']
            },
            isValidAction(action: GameAction) {
                return (
                    StepValidator.Check(action) ||
                    DrawValidator.Check(action) ||
                    OpenAuctionValidator.Check(action) ||
                    BidValidator.Check(action)
                )
            },
            onAction(action: GameAction, context: MachineContext<SyntheticState>) {
                if (action.type === 'step') {
                    const state = context.gameState
                    state.turnManager.endTurn(state.actionCount)
                    state.activePlayerIds = [state.turnManager.startNextTurn(state.actionCount)]
                }
                return 'playing'
            }
        }
    },
    visibility: {
        state: Visibility.createProjector(State),
        actions: Visibility.createActionProjector({
            step: Step,
            draw: Draw,
            openAuction: OpenAuction,
            bid: PlaceBid
        })
    }
} satisfies GameRuntime<ProjectedState, SyntheticState>

export const SyntheticDefinition = {
    runtime: SyntheticRuntime,
    info: {
        id: 'synthetic',
        metadata: {
            name: 'Synthetic',
            description: 'Backend boundary test fixture',
            version: '1.0.0',
            designer: 'Tabletop',
            year: '2026',
            minPlayers: 3,
            maxPlayers: 3,
            defaultPlayerCount: 3,
            beta: true
        }
    }
}
