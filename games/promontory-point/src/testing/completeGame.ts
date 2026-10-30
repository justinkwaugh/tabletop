import { assert, type Game, type GameAction, type GameConfig } from '@tabletop/common'
import { PROMONTORY, type SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { isRedTile } from '../components/townTiles.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type {
    HydratedPromontoryPointGameState,
    PromontoryPointGameState
} from '../model/gameState.js'
import { openSpaceIds } from '../rules/network.js'
import { SeededPlayer } from './seededPlayer.js'
import type { Step, Walk } from './seededWalk.js'
import { canonical, engine, startGame } from './startGame.js'

// Far more than any game takes: the bag of 96 runs out within a few dozen turns.
const ACTION_LIMIT = 2000

// How a seat leans once every action type has been tried; each is a legal way to play.
export enum PlayStyle {
    // Places on red towns and Promontory when it can, racing the red-tile end.
    TownSeeker = 'TownSeeker',
    // Places to shut a railroad out of open spaces, so its pieces must be scrapped.
    Blocker = 'Blocker',
    // Buys whenever it can, so a Repairs finds it short.
    Spender = 'Spender'
}

export type CompleteGameSetting = {
    playerCount: number
    config: GameConfig
    seed: number
    style: PlayStyle
}

// A game's own master seed, one per policy seed, so the bag differs from run to run.
export function masterSeedOf(seed: number): string {
    return seed.toString(16).padStart(32, '0')
}

// R-X.1: a seat that prefers what it has not yet done this game, and otherwise plays at random.
export class CompleteGamePlayer extends SeededPlayer {
    private readonly takenTypes = new Set<string>()
    private readonly takenKeepChoices = new Set<boolean>()

    constructor(
        seed: number,
        private readonly style: PlayStyle
    ) {
        super(seed)
    }

    override nextAction(game: Game, state: PromontoryPointGameState): GameAction {
        const submitted = super.nextAction(game, state)
        this.takenTypes.add(submitted.type)
        return submitted
    }

    protected override chooseType(types: string[]): string {
        const untaken = preferUntaken(types, this.takenTypes)
        if (this.style === PlayStyle.Spender && untaken === types) {
            return this.pick(preferred(types, (type) => type === ActionType.BuyShare))
        }
        return this.pick(untaken)
    }

    protected override choosePlacement(
        state: HydratedPromontoryPointGameState,
        placements: [RailroadId, SpaceId][]
    ): [RailroadId, SpaceId] {
        switch (this.style) {
            case PlayStyle.TownSeeker:
                return this.pick(
                    preferred(placements, ([, spaceId]) => endsTheGame(state, spaceId))
                )
            case PlayStyle.Blocker:
                return this.pick(blocking(state, placements))
            case PlayStyle.Spender:
                return this.pick(placements)
        }
    }

    // R-6.3: keep and return both taken before either is chosen at random.
    protected override chooseReturnKeptPiece(): boolean {
        const returned = this.pick(preferUntaken([false, true], this.takenKeepChoices))
        this.takenKeepChoices.add(returned)
        return returned
    }
}

// R-6.1, R-6.1-H1: a red tile or Promontory, the spaces the red-tile end counts.
function endsTheGame(state: HydratedPromontoryPointGameState, spaceId: SpaceId): boolean {
    const kindId = state.towns[spaceId]
    return spaceId === PROMONTORY.spaceId || (kindId !== undefined && isRedTile(kindId))
}

// R-3.3, R-3.3-H1: the placements leaving the most hemmed-in railroad the fewest open spaces.
function blocking(
    state: HydratedPromontoryPointGameState,
    placements: [RailroadId, SpaceId][]
): [RailroadId, SpaceId][] {
    const openCounts = RAILROAD_IDS.map((railroadId) => ({
        railroadId,
        open: openSpaceIds(state.track, railroadId).length
    })).filter(({ open }) => open > 0)
    const target = openCounts.reduce((least, next) => (next.open < least.open ? next : least))
    const openAfter = ([railroadId, spaceId]: [RailroadId, SpaceId]) =>
        openSpaceIds({ ...state.track, [spaceId]: railroadId }, target.railroadId).length
    const fewest = Math.min(...placements.map(openAfter))
    return placements.filter((placement) => openAfter(placement) === fewest)
}

function preferred<Choice>(choices: Choice[], prefers: (choice: Choice) => boolean): Choice[] {
    const chosen = choices.filter(prefers)
    return chosen.length > 0 ? chosen : choices
}

function preferUntaken<Choice>(choices: Choice[], taken: ReadonlySet<Choice>): Choice[] {
    const untaken = choices.filter((choice) => !taken.has(choice))
    return untaken.length > 0 ? untaken : choices
}

// A seat with no legal action while the game goes on is a rules or handler finding, never a
// reason to widen the policy to System Actions.
function stallFinding(game: Game, state: PromontoryPointGameState): string | undefined {
    const [playerId] = state.activePlayerIds
    if (playerId === undefined) {
        return `Stall: no seat is active in ${state.machineState}`
    }
    if (engine.getValidActionTypesForPlayer(game, state, playerId).length === 0) {
        return `Stall: ${playerId} is offered no action in ${state.machineState}`
    }
    return undefined
}

// R-6.1, R-6.1-H2: a game from its real setup and a master seed to its end, through the engine,
// with ordinary user actions only.
export function playCompleteGame({ playerCount, config, seed, style }: CompleteGameSetting): Walk {
    const { game, state: initial } = startGame({
        playerCount,
        config,
        masterSeed: masterSeedOf(seed)
    })
    const player = new CompleteGamePlayer(seed, style)
    const steps: Step[] = []
    let state = initial
    while (state.machineState !== MachineState.EndOfGame) {
        assert(steps.length < ACTION_LIMIT, 'A complete game ends')
        const stall = stallFinding(game, state)
        assert(stall === undefined, stall ?? '')
        const submitted = player.nextAction(game, state)
        const { processedActions, actionCascade } = engine.executeCanonicalAction({
            action: submitted,
            state,
            game
        })
        const states = actionCascade.transitions.map(({ after }) => canonical(after))
        steps.push({ before: state, submitted, processedActions, states })
        state = states[states.length - 1]
    }
    return { game, initial, steps }
}
