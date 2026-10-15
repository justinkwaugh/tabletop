import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { ReefBoardIdSchema } from '../components/reefBoards.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

export type BagSearchNeed = Type.Static<typeof BagSearchNeed>
export const BagSearchNeed = Type.Union([
    Type.Object({ kind: Type.Literal('exchange'), playerId: Type.String() }),
    Type.Object({ kind: Type.Literal('extraGrowth'), boardId: ReefBoardIdSchema })
])

export type BagSearchResult = Type.Static<typeof BagSearchResult>
export const BagSearchResult = Type.Object({ found: Type.Boolean() })

// With its bonus space empty, a polyp of one colour must be picked out of the bag (user
// ruling: the bonus polyps are part of the bag, set aside to save time). Nobody can see into
// the bag, so the search is a reveal and Undo cannot step back past it.
export type SearchBag = Type.Static<typeof SearchBag>
export const SearchBag = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.SearchBag),
            revealsInfo: Type.Literal(true),
            color: Type.Enum(CoralColor),
            need: BagSearchNeed,
            metadata: Type.Optional(BagSearchResult)
        })
    ])
)

export const SearchBagValidator = Compile(SearchBag)

export function isSearchBag(action?: GameAction): action is SearchBag {
    return action?.type === ActionType.SearchBag
}

export class HydratedSearchBag extends HydratableAction<typeof SearchBag> implements SearchBag {
    declare type: ActionType.SearchBag
    declare revealsInfo: true
    declare color: CoralColor
    declare need: BagSearchNeed
    declare metadata?: BagSearchResult

    constructor(data: SearchBag) {
        super(data, SearchBagValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = state.searchBag(this.color, this.need)
    }
}
