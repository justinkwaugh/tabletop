import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus, type GameDefinition } from '@tabletop/common'
import {
    HydratedEighteenXXState,
    createEighteenXXRuntime,
    extendEighteenXXState,
    type EighteenXXState,
    type EighteenXXStateHandler,
    type EighteenXXTitleRules,
    type RailwayMap,
    type TileSet,
    type TrainDepot
} from '@tabletop/18xx'
import { Definition as Shikoku, Shikoku1889TitleRules } from '@tabletop/shikoku-1889'

const CharterState = extendEighteenXXState(
    { charterVotes: Type.Optional(Type.Array(Type.String())) },
    ['CharterRound']
)
const CharterStateValidator = Compile(CharterState)
class HydratedCharterState extends HydratedEighteenXXState {
    declare charterVotes?: string[]
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, CharterStateValidator)
    }
}

const charterRound: EighteenXXStateHandler = {
    isValidAction: () => false,
    validActionsForPlayer: (_playerId, context) =>
        context.gameState instanceof HydratedCharterState
            ? (context.gameState.charterVotes ?? []).map((vote) => `Vote:${vote}`)
            : [],
    enter: () => {},
    onAction: () => 'StockRound'
}
function offersCharterPetition(family: EighteenXXStateHandler): EighteenXXStateHandler {
    return {
        isValidAction: (action, context) => family.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) => [
            ...family.validActionsForPlayer(playerId, context),
            'PetitionForCharter'
        ],
        enter: (context) => family.enter(context),
        onAction: (action, context) => family.onAction(action, context)
    }
}

const CharterRules: EighteenXXTitleRules = {
    ...Shikoku1889TitleRules,
    state: {
        schema: CharterState,
        hydrate: (data, map, tileSet, depot) => new HydratedCharterState(data, map, tileSet, depot)
    },
    decisionHandlers: { WaterfallAuction: offersCharterPetition },
    titleStateHandlers: { CharterRound: charterRound }
}
const Charter: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: Shikoku.info,
    runtime: createEighteenXXRuntime(CharterRules)
}

function start(definition: typeof Charter) {
    const game = definition.runtime.initializer.initializeGame(
        {
            id: 'title-state',
            typeId: definition.info.id,
            ownerId: 'alex',
            seed: 1889,
            players: ['alex', 'blair', 'casey'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    const engine = new GameEngine(definition.runtime)
    return { game, engine, state: engine.startGame(game).initialState }
}

function inCharterRound(state: EighteenXXState, charterVotes: string[]) {
    const { openingAuction, ...afterOpening } = state
    return { ...afterOpening, machineState: 'CharterRound', charterVotes }
}

const CharterOpening: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: Shikoku.info,
    runtime: createEighteenXXRuntime({
        ...CharterRules,
        createOpening(setup) {
            const { position } = Shikoku1889TitleRules.createOpening(setup)
            return {
                position,
                titleState: { charterVotes: ['KO'] },
                begin(state) {
                    const playerId = state.turnManager.turnOrder[1]
                    state.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
                    state.activePlayerIds = [playerId]
                    state.machineState = 'CharterRound'
                }
            }
        }
    })
}

describe('a title that defines its own state', () => {
    it('keeps its fields and machine states through hydration', () => {
        const { engine, state } = start(Charter)
        const stored = inCharterRound(state, ['AR'])
        engine.validateCanonicalState(stored)
        const hydrated = Charter.runtime.hydrator.hydrateState(stored)
        expect(hydrated).toBeInstanceOf(HydratedCharterState)
        expect(hydrated.dehydrate()).toEqual(stored)
    })

    it('opens in its own machine state with its own initial fields', () => {
        const { game, engine, state } = start(CharterOpening)
        expect(state.machineState).toBe('CharterRound')
        expect(state.openingAuction).toBeUndefined()
        expect(state.activePlayerIds).toEqual(['blair'])
        expect(engine.getValidActionTypesForPlayer(game, state, 'blair')).toEqual(['Vote:KO'])
    })

    it('cannot open with a field its State does not define', () => {
        const undeclared: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
            info: Shikoku.info,
            runtime: createEighteenXXRuntime({
                ...Shikoku1889TitleRules,
                createOpening: (setup) => ({
                    ...Shikoku1889TitleRules.createOpening(setup),
                    titleState: { charterVotes: [] }
                })
            })
        }
        expect(() => start(undeclared)).toThrow()
    })

    it('decides its own machine states', () => {
        const { game, engine, state } = start(Charter)
        const stored = inCharterRound(state, ['AR', 'IR'])
        expect(
            engine.getValidActionTypesForPlayer(game, stored, stored.activePlayerIds[0])
        ).toEqual(['Vote:AR', 'Vote:IR'])
    })

    it('adds a decision to a family machine state', () => {
        const family = start(Shikoku)
        const title = start(Charter)
        const playerId = title.state.activePlayerIds[0]
        expect(
            title.engine.getValidActionTypesForPlayer(title.game, title.state, playerId)
        ).toEqual([
            ...family.engine.getValidActionTypesForPlayer(family.game, family.state, playerId),
            'PetitionForCharter'
        ])
    })

    it('remains unknown to a title that did not define it', () => {
        const { engine, state } = start(Shikoku)
        const withTitleField = { ...state, charterVotes: [] }
        expect(() => engine.validateCanonicalState(withTitleField)).toThrow()
        expect(() =>
            Shikoku.runtime.hydrator.hydrateState({ ...state, machineState: 'CharterRound' })
        ).toThrow()
    })

    it('cannot redefine what the family owns', () => {
        expect(() => extendEighteenXXState({ stockRound: Type.String() })).toThrow(
            'stockRound already belongs'
        )
        expect(() => extendEighteenXXState({}, ['StockRound'])).toThrow(
            'StockRound already belongs'
        )
        expect(() =>
            createEighteenXXRuntime({
                ...Shikoku1889TitleRules,
                titleStateHandlers: { StockRound: charterRound }
            })
        ).toThrow('StockRound already has a family handler')
    })
})
