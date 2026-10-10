import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    ChooseLarvaCubes,
    CoralColors,
    FeedParrotfish,
    type CoralColor,
    type HydratedReefEncounterGameState,
    type ReefEncounterProjectedState
} from '@tabletop/reef-encounter'
import {
    hasManualReefSelection,
    popReefSelection,
    setReefSelection,
    type ReefSelection
} from './stagedSelection.js'

export class ReefEncounterGameSession extends GameSession<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> {
    private selection: ReefSelection = $state({})
    readonly hasManualSelection = $derived(hasManualReefSelection(this.selection))
    private readonly canAct = $derived(this.isPlayable && !this.isViewingHistory && this.isMyTurn)
    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasManualSelection || Boolean(this.undoableAction))
    )

    readonly firstLarvaCube = $derived(this.selection.firstLarvaCube?.value)

    readonly canFeedParrotfish = $derived(this.canTake(ActionType.FeedParrotfish))
    readonly canChooseLarvaCubes = $derived(this.canTake(ActionType.ChooseLarvaCubes))

    // The dealt polyps behind the viewer's screen, one choice per colour.
    readonly feedableColors: CoralColor[] = $derived.by(() => {
        if (!this.canFeedParrotfish) return []
        const secret = this.myPlayerState?.secretScreenPolyps
        return CoralColors.filter((color) => (secret?.[color] ?? 0) > 0)
    })

    readonly larvaCubeChoices: CoralColor[] = $derived.by(() => {
        if (!this.canChooseLarvaCubes) return []
        const first = this.firstLarvaCube
        return CoralColors.filter((color) =>
            first === undefined
                ? this.gameState.larvaCubeSupply[color] > 0
                : this.gameState.canTakeLarvaCubes([first, color])
        )
    })

    override beforeNewState() {
        this.resetAction()
    }

    resetAction() {
        this.selection = {}
    }

    override async undo() {
        if (!this.canUndo || this.busy) return
        if (this.hasManualSelection) {
            this.selection = popReefSelection(this.selection)
            return
        }
        await super.undo()
    }

    async feedParrotfish(color: CoralColor) {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(FeedParrotfish, { color }))
    }

    async chooseLarvaCube(color: CoralColor) {
        if (this.busy) return
        const first = this.firstLarvaCube
        if (first === undefined) {
            this.selection = setReefSelection(this.selection, 'firstLarvaCube', color)
            return
        }
        await this.applyAction(
            this.createPlayerAction(ChooseLarvaCubes, { colors: [first, color] })
        )
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }
}
