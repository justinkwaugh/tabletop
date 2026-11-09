import { tick } from 'svelte'
import { MediaQuery } from 'svelte/reactivity'
import type { GameAction, Point } from '@tabletop/common'
import {
    GameSession,
    undoableStagedSelection,
    type AnimationContext,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    ActionType,
    BoardPerspective,
    MachineState,
    MedinaPreferenceDefinition,
    PALACE_COLORS,
    PlaceBuilding,
    PlaceMerchant,
    PlaceRooftop,
    PlaceStable,
    PlaceWall,
    TakeTeaBreak,
    type HydratedMedinaGameState,
    type MedinaProjectedState,
    type MedinaPreferences,
    type PlayerScore,
    type WallSection
} from '@tabletop/medina'
import type { BoardView } from '$lib/art/sprites.js'
import { GHOST_OPACITY, arrivalKeysOf, playArrival } from '$lib/animators/pieceArrival.js'
import { boardPieces, type RooftopSprite } from '$lib/utils/boardPieces.js'
import type { BoardProjection } from '$lib/utils/boardGeometry.js'
import { placementOf, recentPlacements, type RecentPlacement } from '$lib/utils/recentPlacements.js'
import {
    ToolStageOrder,
    carryTool,
    chooseTool,
    chosenTool,
    sameTool,
    type ChosenTool,
    type PieceTool,
    type ToolSelection
} from './pieceTool.js'

type SessionOptions = ConstructorParameters<
    typeof GameSession<MedinaProjectedState, HydratedMedinaGameState>
>[0]

export type SpaceTarget = { kind: 'space'; coords: Point }
export type RoofTarget = { kind: 'roof'; coords: Point }
export type WallTarget = { kind: 'wall'; section: WallSection }
export type BoardTarget = SpaceTarget | RoofTarget | WallTarget

export type PieceBay = {
    tool: PieceTool
    sprite: string
    count: number
    label: string
    enabled: boolean
    selected: boolean
}

export const ROOFTOP_SPRITE_NEUTRAL = 'dome-neutral-roof'

export class MedinaGameSession extends GameSession<MedinaProjectedState, HydratedMedinaGameState> {
    private toolSelection: ToolSelection = $state({})
    private carriedTool: ChosenTool | undefined
    private toolChosenWhileUpdating: ChosenTool | undefined

    boardElement: SVGSVGElement | undefined = $state()

    pieceState: HydratedMedinaGameState = $derived(this.gameState)

    private chosenPalaceId: string | undefined = $state()
    focusedPalaceId: string | undefined = $derived(
        this.pieceState.palaces.some((palace) => palace.id === this.chosenPalaceId)
            ? this.chosenPalaceId
            : undefined
    )

    readonly preferences: TitlePreferences<typeof MedinaPreferences> = this.createPreferences(
        MedinaPreferenceDefinition
    )

    boardPerspective: BoardPerspective = $derived(this.preferences.values.boardPerspective)

    private placedOverGhost = false

    private portraitPhone = new MediaQuery('(max-width: 639px) and (orientation: portrait)', false)

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                ToolStageOrder,
                () => this.toolSelection,
                (selection) => {
                    this.toolSelection = selection
                }
            )
        )
    }

    canAct = $derived(
        this.isMyTurn &&
            !this.isViewingHistory &&
            this.gameState.machineState === MachineState.TakingTurn
    )

    myPlayerId = $derived(this.myPlayer?.id)

    scores: Record<string, PlayerScore> = $derived(this.gameState.scores())

    private turnNumber = $derived(this.gameState.turnManager.series.length)

    boardView: BoardView = $derived(
        this.boardPerspective === BoardPerspective.TopDown ? 'plan' : 'cavalier'
    )

    projection: BoardProjection = $derived({
        view: this.boardView,
        sideways: this.portraitPhone.current,
        size: this.pieceState.size()
    })

    rooftopSprite: RooftopSprite = $derived.by(() => {
        const colorBlind = this.colors.colorBlind
        return (rooftop) => {
            if (!rooftop.playerId) {
                return ROOFTOP_SPRITE_NEUTRAL
            }
            const color = this.colors.getPlayerColor(rooftop.playerId)
            return `dome-${color}${colorBlind ? '-cb' : ''}`
        }
    })

    pieces = $derived(boardPieces(this.pieceState, this.projection, this.rooftopSprite))

    showsPieceCounts(playerId: string): boolean {
        return (
            !this.gameState.hiddenPieces ||
            playerId === this.myPlayerId ||
            this.gameState.machineState === MachineState.EndOfGame
        )
    }

    override get canExplore(): boolean {
        return !this.gameState.hiddenPieces && super.canExplore
    }

    recent: RecentPlacement[] = $derived.by(() => {
        if (this.isViewingHistory) {
            const placement = this.currentAction && placementOf(this.currentAction)
            return placement ? [placement] : []
        }
        return this.gameState.result
            ? []
            : recentPlacements(this.actions, {
                  playerId: this.myPlayerId,
                  acting: this.isMyTurn
              })
    })

    activeTool: PieceTool | undefined = $derived.by(() => {
        const chosen = chosenTool(this.toolSelection)
        if (!this.canAct || !chosen || chosen.turn !== this.turnNumber) {
            return undefined
        }
        return this.toolIsPlaceable(chosen.tool) ? chosen.tool : undefined
    })

    private stockFor(tool: PieceTool): number {
        const playerId = this.myPlayerId
        const player = playerId ? this.gameState.findPlayerState(playerId) : undefined
        if (!player) {
            return 0
        }
        switch (tool.kind) {
            case 'building':
                return player.buildings?.[tool.color] ?? 0
            case 'rooftop':
                return player.rooftops
            case 'neutralRooftop':
                return player.neutralRooftops
            case 'stable':
                return player.stables ?? 0
            case 'merchant':
                return player.merchants ?? 0
            case 'wall':
                return player.walls ?? 0
        }
    }

    private targetsFor(tool: PieceTool): BoardTarget[] {
        const playerId = this.myPlayerId
        if (!playerId) {
            return []
        }
        const state = this.gameState
        const roofTargets = (neutral: boolean): BoardTarget[] =>
            state.claimablePalaces(playerId, neutral).flatMap((palace) =>
                state.palaceBuildings(palace.id).map((coords) => ({
                    kind: 'roof' as const,
                    coords
                }))
            )
        switch (tool.kind) {
            case 'building':
                return state.buildingSpaces(tool.color).map((coords) => ({ kind: 'space', coords }))
            case 'rooftop':
                return roofTargets(false)
            case 'neutralRooftop':
                return roofTargets(true)
            case 'stable':
                return state.stableSpaces().map(({ coords }) => ({ kind: 'space', coords }))
            case 'merchant':
                return state.merchantSpaces().map((coords) => ({ kind: 'space', coords }))
            case 'wall':
                return state.wallSections().map((section) => ({ kind: 'wall', section }))
        }
    }

    private toolIsPlaceable(tool: PieceTool): boolean {
        return this.stockFor(tool) > 0 && this.targetsFor(tool).length > 0
    }

    targets: BoardTarget[] = $derived(this.activeTool ? this.targetsFor(this.activeTool) : [])

    myRooftopSprite: string = $derived(
        this.myPlayerId
            ? this.rooftopSprite({ coords: { x: 0, y: 0 }, playerId: this.myPlayerId })
            : ROOFTOP_SPRITE_NEUTRAL
    )

    bays: PieceBay[] = $derived.by(() => {
        const tools: { tool: PieceTool; sprite: string; label: string }[] = [
            ...PALACE_COLORS.map((color) => ({
                tool: { kind: 'building' as const, color },
                sprite: `tall-${color}-0`,
                label: color.charAt(0).toUpperCase() + color.slice(1)
            })),
            { tool: { kind: 'rooftop' }, sprite: `${this.myRooftopSprite}-0`, label: 'Rooftop' },
            { tool: { kind: 'stable' }, sprite: 'stable-0', label: 'Stable' },
            { tool: { kind: 'merchant' }, sprite: 'merchant-0', label: 'Merchant' },
            { tool: { kind: 'wall' }, sprite: 'wall-h-0', label: 'Wall' }
        ]
        const neutral: PieceTool = { kind: 'neutralRooftop' }
        if (this.stockFor(neutral) > 0) {
            tools.splice(5, 0, {
                tool: neutral,
                sprite: `${ROOFTOP_SPRITE_NEUTRAL}-0`,
                label: 'Neutral'
            })
        }
        return tools.map(({ tool, sprite, label }) => ({
            tool,
            sprite,
            label,
            count: this.stockFor(tool),
            enabled: this.toolIsPlaceable(tool),
            selected: sameTool(tool, this.activeTool)
        }))
    })

    placementsLeft: number = $derived(this.gameState.turn?.placementsLeft ?? 0)

    canTakeTeaBreak: boolean = $derived(this.validActionTypes.includes(ActionType.TakeTeaBreak))

    myTeaTiles: number = $derived(
        this.myPlayerId ? (this.gameState.findPlayerState(this.myPlayerId)?.teaTiles ?? 0) : 0
    )

    choose(tool: PieceTool) {
        if (!this.canAct) {
            return
        }
        if (this.updatingVisibleState) {
            this.toolChosenWhileUpdating = { tool, turn: this.turnNumber }
            return
        }
        if (!sameTool(tool, this.activeTool)) {
            this.toolSelection = chooseTool(this.toolSelection, { tool, turn: this.turnNumber })
        }
    }

    toggleTopDown() {
        this.preferences.set({
            boardPerspective:
                this.boardPerspective === BoardPerspective.TopDown
                    ? BoardPerspective.Cavalier
                    : BoardPerspective.TopDown
        })
    }

    focusPalace(palaceId: string | undefined) {
        this.chosenPalaceId = palaceId
    }

    togglePalaceFocus(palaceId: string) {
        this.chosenPalaceId = this.focusedPalaceId === palaceId ? undefined : palaceId
    }

    override beforeNewState(transition: PresentedTransition): void {
        this.chosenPalaceId = undefined
        if (transition.kind === 'own-action') {
            if (this.toolChosenWhileUpdating) {
                this.toolSelection = chooseTool(this.toolSelection, this.toolChosenWhileUpdating)
            } else if (this.carriedTool) {
                this.toolSelection = carryTool(this.toolSelection, this.carriedTool)
            }
        }
        this.toolChosenWhileUpdating = undefined
        this.carriedTool = undefined
    }

    override async onGameStateChange({
        to,
        action,
        animationContext
    }: {
        to: HydratedMedinaGameState
        from?: HydratedMedinaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        this.pieceState = to
        const startOpacity = this.placedOverGhost ? GHOST_OPACITY : 0
        this.placedOverGhost = false
        const keys = arrivalKeysOf(action, to)
        if (keys.length === 0) {
            return
        }
        await tick()
        playArrival(this.boardElement, keys, startOpacity, animationContext)
    }

    private keepToolForNextPlacement() {
        const chosen = chosenTool(this.toolSelection)
        this.carriedTool = chosen && this.placementsLeft > 1 ? chosen : undefined
    }

    async placeAt(target: BoardTarget, overGhost: boolean) {
        const tool = this.activeTool
        if (!tool) {
            return
        }
        this.placedOverGhost = overGhost
        this.keepToolForNextPlacement()
        switch (target.kind) {
            case 'wall':
                await this.applyAction(
                    this.createPlayerAction(PlaceWall, {
                        side: target.section.side,
                        position: target.section.position
                    })
                )
                return
            case 'roof':
                await this.applyAction(
                    this.createPlayerAction(PlaceRooftop, {
                        coords: target.coords,
                        neutral: tool.kind === 'neutralRooftop'
                    })
                )
                return
            case 'space':
                await this.placeOnSpace(tool, target.coords)
        }
    }

    private async placeOnSpace(tool: PieceTool, coords: Point) {
        switch (tool.kind) {
            case 'building':
                await this.applyAction(
                    this.createPlayerAction(PlaceBuilding, { color: tool.color, coords })
                )
                return
            case 'stable':
                await this.applyAction(this.createPlayerAction(PlaceStable, { coords }))
                return
            case 'merchant':
                await this.applyAction(this.createPlayerAction(PlaceMerchant, { coords }))
                return
            default:
                throw new Error(`A ${tool.kind} does not go on a space`)
        }
    }

    async takeTeaBreak() {
        if (!this.canTakeTeaBreak) {
            return
        }
        await this.applyAction(this.createPlayerAction(TakeTeaBreak, {}))
    }
}
