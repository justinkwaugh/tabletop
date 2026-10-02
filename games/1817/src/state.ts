import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert } from '@tabletop/common'
import {
    HydratedEighteenXXState,
    extendEighteenXXState,
    type EighteenXXState,
    type EighteenXXStateDefinition,
    type RailwayMap,
    type TileSet,
    type TrainDepot
} from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })
/** The company converted or merged this turn, until its trading, loans and stations are done. */
export const Conversion = Type.Object(
    {
        companyId: Id,
        merged: Type.Optional(Type.Literal(true)),
        price: Type.Integer({ minimum: 1 }),
        traderIds: Type.Array(Id),
        stationsOwed: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type Conversion = Type.Static<typeof Conversion>
/** The merger and conversion round that follows an operating round. */
export const MergerRound = Type.Object(
    {
        set: Type.Integer({ minimum: 1 }),
        round: Type.Integer({ minimum: 1 }),
        companyIds: Type.Array(Id),
        convertedIds: Type.Array(Id),
        conversion: Type.Optional(Conversion),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type MergerRound = Type.Static<typeof MergerRound>
export const MergerRoundStates = [
    'MergerRound',
    'TradingConvertedShares',
    'BorrowingAfterConversion',
    'ReducingStations',
    'DiscardingMergedTrains'
] as const

const EighteenSeventeenState = extendEighteenXXState(
    {
        // The bank's remaining subsidy toward privates sold below face value in the opening
        // auction; positions prepared after the opening have none.
        seedMoney: Type.Optional(Type.Integer({ minimum: 0 })),
        shortSqueeze: Type.Optional(Type.Literal(true)),
        fiveShorts: Type.Optional(Type.Literal(true)),
        mergerRound: Type.Optional(MergerRound)
    },
    MergerRoundStates
)
const Validator = Compile(EighteenSeventeenState)
const MergerRoundValidator = Compile(MergerRound)

/** The latest merger and conversion round, as recorded in the state. */
export function mergerRoundOf(state: object): MergerRound | undefined {
    if (!('mergerRound' in state)) return undefined
    assert(MergerRoundValidator.Check(state.mergerRound), 'Invalid merger round')
    return state.mergerRound
}

export function setMergerRound(state: object, round: MergerRound): void {
    Object.assign(state, { mergerRound: round })
}

/** The round in progress, whose conversion is underway when one is. */
export function activeMergerRound(state: object): MergerRound | undefined {
    const round = mergerRoundOf(state)
    return round && !round.completed ? round : undefined
}

/** The optional rules chosen when the game was set up. */
export function eighteenSeventeenOptions(state: object): {
    shortSqueeze: boolean
    fiveShorts: boolean
} {
    return { shortSqueeze: 'shortSqueeze' in state, fiveShorts: 'fiveShorts' in state }
}

export class HydratedEighteenSeventeenState extends HydratedEighteenXXState {
    declare seedMoney?: number
    declare shortSqueeze?: true
    declare fiveShorts?: true
    declare mergerRound?: MergerRound
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, Validator)
        const active = MergerRoundStates.some((machineState) => machineState === this.machineState)
        assert(
            active === (!!this.mergerRound && !this.mergerRound.completed),
            'A merger round in progress belongs to its own states'
        )
    }
}

export const EighteenSeventeenStateDefinition: EighteenXXStateDefinition = {
    schema: EighteenSeventeenState,
    hydrate: (data, map, tileSet, depot) =>
        new HydratedEighteenSeventeenState(data, map, tileSet, depot)
}
