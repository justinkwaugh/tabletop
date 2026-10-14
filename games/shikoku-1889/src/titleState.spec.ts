import {
    AuctionFields,
    composeEighteenXXState,
    beginWaterfallAuction,
    createEighteenXXRuntime,
    defineEighteenXXState,
    LoanStep,
    OrdinaryCompany,
    PrivatePowerFields,
    PrivateRequestFields,
    PrivateTrackFields,
    PrivateWindowFields,
    RailwayFields,
    RailwayMachineStates,
    titleComponents,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type EighteenXXState,
    type EighteenXXStateHandler,
    type EighteenXXTitleRules,
    type HydratedEighteenXXState,
    type Opening
} from '@tabletop/18xx'
import { startFromPublicSeed } from '@tabletop/18xx/scenarios'
import {
    GameEngine,
    assert,
    GameState,
    PlayerStatus,
    type GameDefinition,
    type HydratedGameState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { Definition as Shikoku, Shikoku1889TitleRules, Shikoku1889AuctionRules } from './index.js'

const CharterState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...AuctionFields,
        ...PrivateTrackFields,
        ...PrivateWindowFields,
        ...PrivateRequestFields,
        charterVotes: Type.Array(Type.String()),
        companies: Type.Array(
            Type.Object(
                { ...OrdinaryCompany.properties, charterLicense: Type.Optional(Type.String()) },
                { additionalProperties: false }
            )
        )
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates, 'CharterRound']
)
type CharterState = Type.Static<typeof CharterState>
type HydratedCharterState = HydratedEighteenXXState<typeof CharterState>
const CharterStateDefinition = defineEighteenXXState(CharterState, [
    validateRailwayState,
    validateWaterfallAuction
])

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
    state: CharterStateDefinition,
    createOpening: (setup) => ({
        position: Shikoku1889TitleRules.createOpening(setup).position,
        begin: beginWaterfallAuction(Shikoku1889AuctionRules, setup.startingPositions),
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
            | (typeof RailwayMachineStates)[number]
            | (typeof WaterfallAuctionMachineStates)[number]
            | 'CharterRound'
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
        const components = titleComponents(CharterRules)
        expect(() => hydrate(missing, components)).toThrow()
        expect(() => hydrate({ ...state, charterVotes: [17] }, components)).toThrow()
    })

    it('keeps its fields and machine states through hydration', () => {
        const { engine, state } = start(Charter)
        const stored = inCharterRound(state, ['AR'])
        engine.validateCanonicalState(stored)
        const hydrated = Charter.runtime.hydrator.hydrateState(stored)
        expect(hydrated.turnManager.currentTurn()).toBeDefined()
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
            Shikoku1889TitleRules.state.hydrate(
                { ...state, machineState: 'CharterRound' },
                titleComponents(Shikoku1889TitleRules)
            )
        ).toThrow()
    })

    it('cannot redefine what the family owns', () => {
        expect(() => composeEighteenXXState({ players: Type.String() }, ['StockRound'])).toThrow(
            'players already belongs'
        )
        expect(() => composeEighteenXXState({}, ['StockRound', 'StockRound'])).toThrow(
            'Duplicate machine state'
        )
        expect(() =>
            createEighteenXXRuntime({
                ...CharterRules,
                titleStateHandlers: { StockRound: charterRound }
            })
        ).toThrow('StockRound already has a family handler')
    })
})

it('composes a state without railway, finance, or auction mechanisms', () => {
    const schema = composeEighteenXXState({ bids: Type.Array(Type.Number()) }, ['Bidding'])
    const definition = defineEighteenXXState(schema, [])
    const { state } = start(Shikoku)
    const coreValidator = Compile(GameState)
    const core = coreValidator.Clean(state)
    assert(coreValidator.Check(core), 'The common state envelope is valid')
    const stored = { ...core, machineState: 'Bidding', bids: [10] }
    const hydrated = definition.hydrate(stored, titleComponents(Shikoku1889TitleRules))
    expect(hydrated.dehydrate()).toEqual(stored)
    expectTypeOf(hydrated).not.toHaveProperty('stockRound')
    expectTypeOf(hydrated).not.toHaveProperty('companies')
    expectTypeOf(hydrated).not.toHaveProperty('loanStep')
})

it('allows title-owned company fields without extending the family company', () => {
    const { state } = start(Charter)
    state.companies[0].charterLicense = 'Northern charter'
    expect(Charter.runtime.hydrator.hydrateState(state).dehydrate()).toEqual(state)
    const ordinary = start(Shikoku).state
    const invalid = {
        ...ordinary,
        companies: ordinary.companies.map((company) => ({
            ...company,
            charterLicense: 'Northern charter'
        }))
    }
    expect(() => Shikoku.runtime.hydrator.hydrateState(invalid)).toThrow()
})

it('requires selected mechanism state and rules to agree', () => {
    const state = Shikoku1889TitleRules.state
    expect(() =>
        createEighteenXXRuntime({
            ...Shikoku1889TitleRules,
            state: {
                ...state,
                schema: Type.Object(
                    { ...state.schema.properties, loanStep: Type.Optional(LoanStep) },
                    { additionalProperties: false }
                )
            }
        })
    ).toThrow('loanStep state and rules must be selected together')
    expect(() => createEighteenXXRuntime({ ...CharterRules, titleStateHandlers: {} })).toThrow(
        'CharterRound has no state handler'
    )
})
