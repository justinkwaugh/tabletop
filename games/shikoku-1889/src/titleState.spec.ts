import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
    GameEngine,
    PlayerStatus,
    type HydratedGameState,
    type GameDefinition
} from '@tabletop/common'
import {
    HydratedEighteenXXState,
    createEighteenXXRuntime,
    titleComponents,
    extendEighteenXXState,
    type EighteenXXState,
    type EighteenXXMachineState,
    type EighteenXXStateHandler,
    type EighteenXXTitleRules,
    type Opening,
    type RailwayMap,
    type TileSet,
    type TrainDepot
} from '@tabletop/18xx'
import { Definition as Shikoku, Shikoku1889TitleRules } from './index.js'
import { startFromPublicSeed } from '@tabletop/18xx/scenarios'

const CharterState = extendEighteenXXState({ charterVotes: Type.Array(Type.String()) }, [
    'CharterRound'
])
const CharterStateValidator = Compile(CharterState)
type CharterState = Type.Static<typeof CharterState>
class HydratedCharterState extends HydratedEighteenXXState<typeof CharterState> {
    declare charterVotes: string[]
    constructor(data: unknown, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, CharterStateValidator)
    }
}

type CharterHandler = EighteenXXStateHandler<HydratedCharterState>
const charterRound: CharterHandler = {
    isValidAction: () => false,
    validActionsForPlayer: (_playerId, context) =>
        context.gameState.charterVotes.map((vote) => `Vote:${vote}`),
    enter: () => {},
    onAction: () => 'StockRound'
}
function offersCharterPetition(family: CharterHandler): CharterHandler {
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

const CharterRules: EighteenXXTitleRules<typeof CharterState, HydratedCharterState> = {
    ...Shikoku1889TitleRules,
    state: {
        schema: CharterState,
        hydrate: (data, map, tileSet, depot) => new HydratedCharterState(data, map, tileSet, depot)
    },
    createOpening: (setup) => ({
        ...Shikoku1889TitleRules.createOpening(setup),
        titleState: { charterVotes: [] }
    }),
    decisionHandlers: { WaterfallAuction: offersCharterPetition },
    titleStateHandlers: { CharterRound: charterRound }
}
const Charter: GameDefinition<CharterState, HydratedCharterState> = {
    info: Shikoku.info,
    runtime: createEighteenXXRuntime(CharterRules)
}

function start<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw>
>(definition: GameDefinition<Raw, State>) {
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
    return {
        game,
        engine: new GameEngine(definition.runtime),
        state: startFromPublicSeed(definition.runtime, game)
    }
}

function inCharterRound(state: CharterState, charterVotes: string[]): CharterState {
    const { openingAuction, ...afterOpening } = state
    return { ...afterOpening, machineState: 'CharterRound', charterVotes }
}

const CharterOpening: GameDefinition<CharterState, HydratedCharterState> = {
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
    it('preserves the declared types through composition', () => {
        const { state } = start(Charter)
        const hydrated = Charter.runtime.hydrator.hydrateState(state)
        expectTypeOf(state.charterVotes).toEqualTypeOf<string[]>()
        expectTypeOf(hydrated).toEqualTypeOf<HydratedCharterState>()
        expectTypeOf(hydrated.dehydrate()).toEqualTypeOf<CharterState>()
        expectTypeOf<CharterState>().not.toHaveProperty('charterVtoes')
        expectTypeOf<CharterState['machineState']>().toEqualTypeOf<
            EighteenXXMachineState | 'CharterRound'
        >()
        expectTypeOf<
            Opening<typeof CharterState, HydratedCharterState>['titleState']
        >().toEqualTypeOf<{ charterVotes: string[] }>()
    })

    it('rejects missing or malformed title fields at hydration', () => {
        const { state } = start(Charter)
        const { charterVotes, ...missing } = state
        expect(charterVotes).toEqual([])
        const hydrate = CharterRules.state.hydrate
        const { map, tileSet, depot } = titleComponents(CharterRules)
        expect(() => hydrate(missing, map, tileSet, depot)).toThrow()
        expect(() => hydrate({ ...state, charterVotes: [17] }, map, tileSet, depot)).toThrow()
    })

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
