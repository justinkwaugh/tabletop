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
    type ReefEncounterProjectedState,
    SupplyPolypsPerLarvaCube
} from '@tabletop/reef-encounter'
import { assert, assertExists } from '@tabletop/common'
import {
    chooseCylinderAlga,
    chooseCylinderPayment,
    chooseFirstLarvaCube,
    choosePlacementSquare,
    chooseShrimp,
    hasManualReefSelection,
    popReefSelection,
    startEating,
    type PolypSource,
    type ReefSelection,
    type ShrimpIntent
} from './stagedSelection.js'
import { PiecesAnimator } from '$lib/animators/piecesAnimator.js'
import { tablePieces, type TablePiece } from '$lib/utils/tablePieces.js'

const PolypSources: readonly PolypSource[] = ['supply', 'consumed']

const isConsumed = (source: PolypSource) => source === 'consumed'

export type EdibleCoral = { square: ReefSquare; color: CoralColor; squares: OffsetCoordinates[] }

export type CylinderTargets = { openSea: boolean; tileIds: number[] }

export type LarvaCubeChoice = { color: CoralColor; polypsToPlace: number }

export type PlacementTarget = {
    boardId: ReefBoardId
    coords: OffsetCoordinates
    attack: boolean
    searchesBag: boolean
}

export class ReefEncounterGameSession extends GameSession<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> {
    // A full-action replay animates several actions while gameState stays frozen.
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

    playerAidOpen = $state(false)

    readonly possessiveName = (playerId: string): string =>
        playerId === this.myPlayer?.id ? 'your' : `${this.getPlayerName(playerId)}'s`

    togglePlayerAid() {
        this.playerAidOpen = !this.playerAidOpen
    }

    closePlayerAid() {
        this.playerAidOpen = false
    }

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
        const secret = this.myPlayerState?.secretSupplyPolyps
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
        const supply = player.getSupplyPolyps()
        return CoralColors.filter((color) => this.gameState.canPlayLarvaCube(me, color)).map(
            (color) => ({
                color,
                polypsToPlace:
                    Math.min(supply[color], SupplyPolypsPerLarvaCube) + player.consumedPolyps[color]
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
            this.gameState.hasPolypToPlace(me, isConsumed(source))
        )
    })

    readonly placementSquare: ReefSquare | undefined = $derived(
        this.selection.placementSquare?.value
    )

    readonly placementTargets: PlacementTarget[] = $derived.by(() => {
        const source = this.placementSources[0]
        const color = this.placing?.color
        if (!source || !color || this.turnChoiceOpen) return []
        const me = this.myPlayerId()
        return this.gameState.reefs.flatMap((reef) =>
            ReefBoards[reef.boardId].rock
                .filter((coords) =>
                    this.gameState.canPlacePolyp(me, reef.boardId, coords, isConsumed(source))
                )
                .map((coords) => ({
                    boardId: reef.boardId,
                    coords,
                    attack: polypAt(reef, coords) !== undefined,
                    searchesBag: this.gameState.placementSearchesBag(reef.boardId, coords, color)
                }))
        )
    })

    readonly placementSearchesBag = $derived(
        this.placementTargets.some((target) => target.searchesBag)
    )

    readonly shrimpProtectedPolyps: ReefSquare[] = $derived.by(() => {
        const placing = this.placing
        if (!placing || this.placementSources.length === 0 || this.turnChoiceOpen) return []
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
    // An open choice takes over the table (see the visual contract).
    readonly turnChoiceOpen = $derived(
        this.placementSquare !== undefined ||
            this.shrimpIntent !== undefined ||
            this.choosingCylinder ||
            this.choosingCoralToEat
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

    readonly cubesForPolypsFromBag: CoralColor[] = $derived(
        this.cubesForPolyps.filter((color) => this.gameState.exchangeSearchesBag(color))
    )

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
                const coral = coralAt(this.gameState.reefOn(square.boardId), square.coords)
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
        await this.applyAction(this.createPlayerAction(FeedParrotfish, { color }))
    }

    async chooseLarvaCube(color: CoralColor) {
        const first = this.firstLarvaCube
        if (first === undefined) {
            this.stage((selection) => chooseFirstLarvaCube(selection, color))
            return
        }
        await this.applyAction(
            this.createPlayerAction(ChooseLarvaCubes, { colors: [first, color] })
        )
    }

    async playLarvaCube(color: CoralColor) {
        await this.applyAction(this.createPlayerAction(PlayLarvaCube, { color }))
    }

    async placePolyp(square: ReefSquare) {
        const [only, other] = this.placementSources
        assertExists(only, 'Placing a polyp needs a polyp to place')
        if (other) {
            this.stage((selection) => choosePlacementSquare(selection, square))
            return
        }
        await this.applyPlacement(square, only)
    }

    async placePolypFrom(source: PolypSource) {
        const square = this.placementSquare
        assertExists(square, 'Choosing where a polyp comes from needs a square')
        assert(this.placementSources.includes(source), `No ${source} polyp to place`)
        await this.applyPlacement(square, source)
    }

    async takeOpenSeaSpace(larvaColor: CoralColor) {
        await this.applyAction(this.createPlayerAction(TakeOpenSeaSpace, { larvaColor }))
    }

    startIntroducingShrimp() {
        this.stage((selection) => chooseShrimp(selection, { kind: 'introduce' }))
    }

    pickUpShrimp(from: ReefSquare) {
        this.stage((selection) => chooseShrimp(selection, { kind: 'move', from }))
    }

    putDownShrimp() {
        assert(this.shrimpIntent?.kind === 'move', 'Only a picked-up shrimp is put down')
        this.stage(popReefSelection)
    }

    async placeShrimp(square: ReefSquare) {
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

    async returnShrimpToSupply() {
        const intent = this.shrimpIntent
        assert(intent?.kind === 'move', 'Only a picked-up shrimp returns to the supply')
        await this.applyAction(this.createPlayerAction(MoveShrimp, { from: intent.from }))
    }

    async exchangeConsumedPolyp(color: CoralColor) {
        await this.applyAction(this.createPlayerAction(ExchangeConsumedPolyp, { color }))
    }

    async exchangeLarvaCube(color: CoralColor) {
        await this.applyAction(this.createPlayerAction(ExchangeLarvaCube, { color }))
    }

    chooseCylinderPayment(color: CoralColor) {
        this.stage((selection) => chooseCylinderPayment(selection, color))
    }

    chooseCylinderAlga(alga: AlgaColor) {
        this.stage((selection) => chooseCylinderAlga(selection, alga))
    }

    async playAlgaCylinder(tileId?: number) {
        const consumedColor = this.cylinderPayment
        const alga = this.cylinderAlga
        assertExists(consumedColor, 'A cylinder needs a consumed polyp to pay for it')
        assertExists(alga, 'A cylinder needs a colour')
        await this.applyAction(
            this.createPlayerAction(PlayAlgaCylinder, { consumedColor, alga, tileId })
        )
    }

    startChoosingCoralToEat() {
        this.stage(startEating)
    }

    async eatCoral(square: ReefSquare) {
        await this.applyAction(
            this.createPlayerAction(EatCoral, { boardId: square.boardId, coords: square.coords })
        )
    }

    async passFinalTurn() {
        await this.applyAction(this.createPlayerAction(PassFinalTurn))
    }

    private stage(change: (selection: ReefSelection) => ReefSelection) {
        if (this.busy) return
        this.selection = change(this.selection)
    }

    private async applyPlacement({ boardId, coords }: ReefSquare, source: PolypSource) {
        await this.applyAction(
            this.createPlayerAction(PlacePolyp, {
                boardId,
                coords,
                fromConsumed: isConsumed(source)
            })
        )
    }

    private myPlayerId(): string {
        assertExists(this.myPlayer, 'Only a seated player acts')
        return this.myPlayer.id
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }
}
