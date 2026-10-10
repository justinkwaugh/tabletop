import { GameSession, type AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, OffsetCoordinates } from '@tabletop/common'
import {
    ActionType,
    AlgaColors,
    coralAt,
    EatCoral,
    ExchangeConsumedPolyp,
    ExchangeLarvaCube,
    PlayAlgaCylinder,
    type AlgaColor,
    ChooseLarvaCubes,
    CoralColors,
    FeedParrotfish,
    IntroduceShrimp,
    MachineState,
    MoveShrimp,
    PassFinalTurn,
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
    type PolypSource,
    type ReefSelection,
    type ShrimpIntent
} from './stagedSelection.js'
import { PiecesAnimator } from '$lib/animators/piecesAnimator.js'
import { tablePieces, type TablePiece } from '$lib/utils/tablePieces.js'

const PolypSources: readonly PolypSource[] = ['screen', 'consumed']

export type EdibleCoral = { square: ReefSquare; color: CoralColor; squares: OffsetCoordinates[] }

export type CylinderTargets = { openSea: boolean; tileIds: number[] }

export type LarvaCubeChoice = { color: CoralColor; polypsToPlace: number }

export type PlacementTarget = { boardId: ReefBoardId; coords: OffsetCoordinates; attack: boolean }

export class ReefEncounterGameSession extends GameSession<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> {
    // A full-action replay animates several actions while gameState stays frozen, so pieces
    // keep the last transition's result until gameState catches up.
    private settledPieces: TablePiece[] = $derived(tablePieces(this.gameState, this.game.id))
    private transitionPieces: TablePiece[] | undefined = $state()
    readonly tablePieces = $derived(this.transitionPieces ?? this.settledPieces)

    readonly piecesAnimator = new PiecesAnimator({
        gameId: () => this.game.id,
        show: (pieces) => {
            this.transitionPieces = pieces
        },
        settle: (pieces) => {
            this.settledPieces = pieces
            this.transitionPieces = undefined
        },
        isOwnLiveAction: (action) => !this.isViewingHistory && action.playerId === this.myPlayer?.id
    })

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
    readonly isTakingFinalTurn = $derived(
        this.canAct && this.gameState.machineState === MachineState.FinalTurns
    )

    readonly firstLarvaCube = $derived(this.selection.firstLarvaCube?.value)

    readonly canFeedParrotfish = $derived(this.canTake(ActionType.FeedParrotfish))
    readonly canChooseLarvaCubes = $derived(this.canTake(ActionType.ChooseLarvaCubes))

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
        const screen = player.getScreenPolyps()
        return CoralColors.filter((color) => this.gameState.canPlayLarvaCube(me, color)).map(
            (color) => ({
                color,
                polypsToPlace: screen[color] + player.consumedPolyps[color]
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

    readonly placementSource: PolypSource | undefined = $derived(
        this.selection.polypSource?.value ?? this.placementSources[0]
    )

    readonly placementTargets: PlacementTarget[] = $derived.by(() => {
        const placing = this.placing
        const source = this.placementSource
        if (!placing || !source || this.turnChoiceOpen) return []
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

    readonly shrimpProtectedPolyps: ReefSquare[] = $derived.by(() => {
        const placing = this.placing
        if (!placing || !this.placementSource || this.turnChoiceOpen) return []
        return this.gameState.reefs.flatMap((reef) =>
            this.gameState
                .shrimpProtectedPolyps(reef.boardId, placing.color)
                .map((coords) => ({ boardId: reef.boardId, coords }))
        )
    })

    readonly takeableSpaces: CoralColor[] = $derived.by(() => {
        if (!this.canTake(ActionType.TakeOpenSeaSpace) || this.turnChoiceOpen) return []
        const me = this.myPlayerId()
        return CoralColors.filter((color) => this.gameState.canTakeOpenSeaSpace(me, color))
    })

    readonly shrimpIntent: ShrimpIntent | undefined = $derived(this.selection.shrimp?.value)
    readonly cylinderPayment: CoralColor | undefined = $derived(
        this.selection.cylinderPayment?.value
    )
    readonly cylinderAlga: AlgaColor | undefined = $derived(this.selection.cylinderAlga?.value)
    readonly choosingCylinder = $derived(this.cylinderPayment !== undefined)
    readonly choosingCoralToEat = $derived(this.selection.eating?.value === true)
    // An open shrimp, cylinder or eating choice takes over the table (see the visual contract).
    readonly turnChoiceOpen = $derived(
        this.shrimpIntent !== undefined || this.choosingCylinder || this.choosingCoralToEat
    )
    readonly canIntroduceShrimp = $derived(this.canTake(ActionType.IntroduceShrimp))
    readonly shrimpsOnBareRock: ReefSquare[] = $derived(
        this.isTakingTurn
            ? this.gameState
                  .shrimpsOnBareRock(this.myPlayerId())
                  .map(({ boardId, coords }) => ({ boardId, coords }))
            : []
    )

    readonly movableShrimps: ReefSquare[] = $derived.by(() => {
        if (!this.canTake(ActionType.MoveShrimp) || this.turnChoiceOpen) return []
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

    readonly cubeToPlay: CoralColor | undefined = $derived(
        this.isTakingTurn ? this.gameState.turn.cubeToPlay : undefined
    )

    readonly consumedForCubes: CoralColor[] = $derived.by(() => {
        if (!this.canTake(ActionType.ExchangeConsumedPolyp) || this.turnChoiceOpen) return []
        const me = this.myPlayerId()
        return CoralColors.filter((color) => this.gameState.canExchangeConsumedPolyp(me, color))
    })

    readonly cubesForPolyps: CoralColor[] = $derived.by(() => {
        if (!this.canTake(ActionType.ExchangeLarvaCube) || this.turnChoiceOpen) return []
        const me = this.myPlayerId()
        return CoralColors.filter((color) => this.gameState.canExchangeLarvaCube(me, color))
    })

    readonly cylinderPayments: CoralColor[] = $derived.by(() => {
        if (!this.canTake(ActionType.PlayAlgaCylinder) || this.shrimpIntent) return []
        const consumed = this.gameState.getPlayerState(this.myPlayerId()).consumedPolyps
        return CoralColors.filter((color) => consumed[color] > 0)
    })

    readonly cylinderAlgas: AlgaColor[] = $derived(
        this.cylinderPayment === undefined
            ? []
            : AlgaColors.filter((alga) => this.gameState.algaSupply[alga] > 0)
    )

    readonly cylinderTargets: CylinderTargets = $derived.by(() => {
        const payment = this.cylinderPayment
        const alga = this.cylinderAlga
        if (payment === undefined || alga === undefined) return { openSea: false, tileIds: [] }
        const me = this.myPlayerId()
        return {
            openSea: this.gameState.canPlayAlgaCylinder(me, payment, alga),
            tileIds: this.gameState.coralTiles
                .map((tile) => tile.tileId)
                .filter((tileId) => this.gameState.canPlayAlgaCylinder(me, payment, alga, tileId))
        }
    })

    readonly canEatCoral = $derived(this.canTake(ActionType.EatCoral))
    readonly canPassFinalTurn = $derived(this.canTake(ActionType.PassFinalTurn))

    // Each coral the viewer may feed their parrotfish, named by the square of their shrimp on it.
    readonly lockingLastTile: number | undefined = $derived(
        this.cylinderTargets.tileIds.find((tileId) =>
            this.gameState.lockingStartsFinalTurns(tileId)
        )
    )

    readonly eatingStartsFinalTurns = $derived(
        this.choosingCoralToEat && this.gameState.eatingStartsFinalTurns(this.myPlayerId())
    )

    readonly edibleCorals: EdibleCoral[] = $derived.by(() => {
        if (!this.choosingCoralToEat || !this.canEatCoral) return []
        const me = this.myPlayerId()
        return this.gameState.shrimps
            .filter((shrimp) => shrimp.playerId === me)
            .map((shrimp) => ({ boardId: shrimp.boardId, coords: shrimp.coords }))
            .filter((square) => this.gameState.canEatCoral(me, square))
            .map((square) => {
                const reef = this.gameState.reefs.find(
                    (candidate) => candidate.boardId === square.boardId
                )
                assertExists(reef, `Reef board ${square.boardId} is not in play`)
                const coral = coralAt(reef, square.coords)
                return {
                    square,
                    color: coral[0].color,
                    squares: coral.map((polyp) => polyp.coords)
                }
            })
    })

    override async onGameStateChange(args: {
        to: HydratedReefEncounterGameState
        from?: HydratedReefEncounterGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        await this.piecesAnimator.onGameStateChange(args)
    }

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

    choosePlacementSource(source: PolypSource) {
        if (this.busy) return
        assert(this.placementSources.includes(source), `No ${source} polyp to place`)
        this.selection = setReefSelection(this.selection, 'polypSource', source)
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
        if (this.busy) return
        this.selection = setReefSelection(this.selection, 'shrimp', { kind: 'introduce' })
    }

    pickUpShrimp(from: ReefSquare) {
        if (this.busy) return
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

    async exchangeConsumedPolyp(color: CoralColor) {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(ExchangeConsumedPolyp, { color }))
    }

    async exchangeLarvaCube(color: CoralColor) {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(ExchangeLarvaCube, { color }))
    }

    chooseCylinderPayment(color: CoralColor) {
        if (this.busy) return
        this.selection = setReefSelection(this.selection, 'cylinderPayment', color)
    }

    chooseCylinderAlga(alga: AlgaColor) {
        if (this.busy) return
        this.selection = setReefSelection(this.selection, 'cylinderAlga', alga)
    }

    async playAlgaCylinder(tileId?: number) {
        if (this.busy) return
        const consumedColor = this.cylinderPayment
        const alga = this.cylinderAlga
        assertExists(consumedColor, 'A cylinder needs a consumed polyp to pay for it')
        assertExists(alga, 'A cylinder needs a colour')
        await this.applyAction(
            this.createPlayerAction(PlayAlgaCylinder, { consumedColor, alga, tileId })
        )
    }

    startChoosingCoralToEat() {
        if (this.busy) return
        this.selection = setReefSelection(this.selection, 'eating', true)
    }

    async eatCoral(square: ReefSquare) {
        if (this.busy) return
        await this.applyAction(
            this.createPlayerAction(EatCoral, { boardId: square.boardId, coords: square.coords })
        )
    }

    async passFinalTurn() {
        if (this.busy) return
        await this.applyAction(this.createPlayerAction(PassFinalTurn))
    }

    private myPlayerId(): string {
        assertExists(this.myPlayer, 'Only a seated player acts')
        return this.myPlayer.id
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }
}
