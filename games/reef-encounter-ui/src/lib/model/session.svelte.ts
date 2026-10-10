import { GameSession } from '@tabletop/frontend-components'
import type { OffsetCoordinates } from '@tabletop/common'
import {
    ActionType,
    ChooseLarvaCubes,
    CoralColors,
    FeedParrotfish,
    IntroduceShrimp,
    MachineState,
    MoveShrimp,
    PlacePolyp,
    polypAt,
    PlayLarvaCube,
    ReefBoards,
    TakeOpenSeaSpace,
    type CoralColor,
    type ReefBoardId,
    type ReefSquare,
    type HydratedReefEncounterGameState,
    type ReefEncounterProjectedState
} from '@tabletop/reef-encounter'
import { assert, assertExists } from '@tabletop/common'
import {
    hasManualReefSelection,
    popReefSelection,
    setReefSelection,
    type ReefSelection,
    type ShrimpIntent
} from './stagedSelection.js'

export type PolypSource = 'screen' | 'consumed'
const PolypSources: readonly PolypSource[] = ['screen', 'consumed']

export type LarvaCubeChoice = { color: CoralColor; polypsToPlace: number }

export type PlacementTarget = { boardId: ReefBoardId; coords: OffsetCoordinates; attack: boolean }

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

    readonly isTakingTurn = $derived(
        this.canAct && this.gameState.machineState === MachineState.TakingTurn
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

    readonly larvaCubesToPlay: LarvaCubeChoice[] = $derived.by(() => {
        if (!this.canTake(ActionType.PlayLarvaCube)) return []
        const me = this.myPlayerId()
        const player = this.gameState.getPlayerState(me)
        return CoralColors.filter((color) => this.gameState.canPlayLarvaCube(me, color)).map(
            (color) => ({
                color,
                polypsToPlace:
                    (player.knownScreenPolyps?.[color] ?? 0) +
                    (player.secretScreenPolyps?.[color] ?? 0) +
                    player.consumedPolyps[color]
            })
        )
    })

    readonly placing = $derived(
        this.canTake(ActionType.PlacePolyp) ? this.gameState.turn.placing : undefined
    )

    readonly placementSources: PolypSource[] = $derived.by(() => {
        if (!this.placing) return []
        const me = this.myPlayerId()
        return PolypSources.filter((source) =>
            this.gameState.hasPolypToPlace(me, source === 'consumed')
        )
    })

    private chosenSource: PolypSource | undefined = $state()
    readonly placementSource: PolypSource | undefined = $derived(
        this.chosenSource && this.placementSources.includes(this.chosenSource)
            ? this.chosenSource
            : this.placementSources[0]
    )

    readonly placementTargets: PlacementTarget[] = $derived.by(() => {
        const placing = this.placing
        const source = this.placementSource
        if (!placing || !source || this.shrimpIntent) return []
        const me = this.myPlayerId()
        return this.gameState.reefs.flatMap((reef) =>
            ReefBoards[reef.boardId].rock
                .filter((coords) =>
                    this.gameState.canPlacePolyp(me, reef.boardId, coords, source === 'consumed')
                )
                .map((coords) => ({
                    boardId: reef.boardId,
                    coords,
                    attack: polypAt(reef, coords) !== undefined
                }))
        )
    })

    readonly takeableSpaces: CoralColor[] = $derived.by(() => {
        if (!this.canTake(ActionType.TakeOpenSeaSpace) || this.shrimpIntent) return []
        const me = this.myPlayerId()
        return CoralColors.filter((color) => this.gameState.canTakeOpenSeaSpace(me, color))
    })

    readonly shrimpIntent: ShrimpIntent | undefined = $derived(this.selection.shrimp?.value)
    readonly canIntroduceShrimp = $derived(this.canTake(ActionType.IntroduceShrimp))
    readonly hasShrimpOnBareRock = $derived(
        this.isTakingTurn && this.gameState.hasShrimpOnBareRock(this.myPlayerId())
    )

    // The viewer's shrimps that may be picked up, while no other shrimp choice is open.
    readonly movableShrimps: ReefSquare[] = $derived.by(() => {
        if (!this.canTake(ActionType.MoveShrimp) || this.shrimpIntent) return []
        const me = this.myPlayerId()
        return this.gameState.shrimps
            .filter((shrimp) => shrimp.playerId === me)
            .map((shrimp) => ({ boardId: shrimp.boardId, coords: shrimp.coords }))
    })

    readonly shrimpTargets: ReefSquare[] = $derived.by(() => {
        const intent = this.shrimpIntent
        if (!intent) return []
        const me = this.myPlayerId()
        const squares = this.gameState.reefs.flatMap((reef) =>
            ReefBoards[reef.boardId].rock.map((coords) => ({ boardId: reef.boardId, coords }))
        )
        return intent.kind === 'introduce'
            ? squares.filter((square) => this.gameState.canIntroduceShrimp(me, square))
            : squares.filter((square) => this.gameState.canMoveShrimp(me, intent.from, square))
    })

    override beforeNewState() {
        this.resetAction()
    }

    resetAction() {
        this.selection = {}
        this.chosenSource = undefined
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

    choosePlacementSource(source: PolypSource) {
        this.chosenSource = source
    }

    async playLarvaCube(color: CoralColor) {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(PlayLarvaCube, { color }))
    }

    async placePolyp(boardId: ReefBoardId, coords: OffsetCoordinates) {
        if (this.busy) return
        const source = this.placementSource
        assertExists(source, 'Placing a polyp needs a polyp to place')
        await this.applyAction(
            this.createPlayerAction(PlacePolyp, {
                boardId,
                coords,
                fromConsumed: source === 'consumed'
            })
        )
    }

    async takeOpenSeaSpace(larvaColor: CoralColor) {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(TakeOpenSeaSpace, { larvaColor }))
    }

    startIntroducingShrimp() {
        this.selection = setReefSelection(this.selection, 'shrimp', { kind: 'introduce' })
    }

    pickUpShrimp(from: ReefSquare) {
        this.selection = setReefSelection(this.selection, 'shrimp', { kind: 'move', from })
    }

    async placeShrimp(square: ReefSquare) {
        if (this.busy) return
        const intent = this.shrimpIntent
        assertExists(intent, 'Placing a shrimp needs a shrimp choice')
        await this.applyAction(
            intent.kind === 'introduce'
                ? this.createPlayerAction(IntroduceShrimp, {
                      boardId: square.boardId,
                      coords: square.coords
                  })
                : this.createPlayerAction(MoveShrimp, { from: intent.from, to: square })
        )
    }

    async returnShrimpBehindScreen() {
        if (this.busy) return
        const intent = this.shrimpIntent
        assert(intent?.kind === 'move', 'Only a picked-up shrimp returns behind the screen')
        await this.applyAction(this.createPlayerAction(MoveShrimp, { from: intent.from }))
    }

    private myPlayerId(): string {
        assertExists(this.myPlayer, 'Only a seated player acts')
        return this.myPlayer.id
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }
}
