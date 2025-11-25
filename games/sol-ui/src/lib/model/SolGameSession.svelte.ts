import { GameSession, GameSessionMode } from '@tabletop/frontend-components'
import {
    ActionType,
    Cell,
    Fly,
    HydratedSolGameState,
    isLaunch,
    Launch,
    MachineState,
    SolGameState,
    Sundiver
} from '@tabletop/sol'
import { GameAction, OffsetCoordinates, Point } from '@tabletop/common'
import { ActionCategory } from '$lib/definition/actionCategory.js'
import { getCellLayout } from '$lib/utils/cellLayouts.js'

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    numPlayers = $derived.by(() => this.gameState.players.length)

    chosenAction?: string = $state(undefined)
    chosenActionCategory?: ActionCategory = $state(undefined)
    chosenMothership?: string = $state(undefined)
    chosenNumDivers?: number = $state(undefined)
    chosenSource?: OffsetCoordinates = $state(undefined)
    chosenDestination?: OffsetCoordinates = $state(undefined)

    midAction = $derived.by(() => {
        if (this.chosenSource) {
            return true
        }

        if (this.isMoving) {
            return this.chosenMothership || this.chosenNumDivers
        }

        return this.chosenActionCategory
    })
    isMoving = $derived(this.gameState.machineState === MachineState.Moving)

    override initializeTimeline({
        to,
        from,
        timeline
    }: {
        to: SolGameState
        from?: SolGameState
        timeline: gsap.core.Timeline
    }): void {
        const isUndo = to.actionCount < (from?.actionCount ?? -1)
        // Add labels for different phases
        if (isUndo) {
            timeline.addLabel('mothership', 0)
            timeline.addLabel('cellsFadeOut', 'mothership+=0')
            timeline.addLabel('movingPieces', 'mothership+=0.1')
            timeline.addLabel('cellsFadeIn', 'cellsFadeOut+=0.3')
        } else {
            timeline.addLabel('cellsFadeOut', 0)
            timeline.addLabel('movingPieces', 'cellsFadeOut+=0.2')
            timeline.addLabel('cellsFadeIn', 'movingPieces+=0.3')
            timeline.addLabel('mothership', 'movingPieces+=0.1')
        }
    }

    override async onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: SolGameState
        from?: SolGameState
        timeline: unknown
    }) {
        this.resetAction()
    }

    numPlayerCanMoveFromSource(): number {
        if (!this.isMyTurn || !this.myPlayerState) {
            return 0
        }

        let availableFromSource = 0
        if (this.chosenSource) {
            const cell = this.gameState.board.cellAt(this.chosenSource)
            if (!cell) {
                return 0
            }
            availableFromSource = this.gameState.board.sundiversForPlayer(
                this.myPlayerState.playerId,
                cell
            ).length
        } else if (this.chosenMothership) {
            availableFromSource = this.myPlayerState.numSundiversInHold()
        }

        return Math.min(this.myPlayerState.movementPoints, availableFromSource)
    }

    locationForDiverInCell(playerId: string, cell: Cell): Point | undefined {
        const cellLayout = getCellLayout(cell, this.numPlayers, this.gameState.board)

        const seen = new Set()
        const orderedPlayers = cell.sundivers.filter((diver) => {
            if (!seen.has(diver.playerId)) {
                seen.add(diver.playerId)
                return true
            }
            return false
        })
        const diverIndex = orderedPlayers.findIndex((d) => d.playerId === playerId)
        return cellLayout.divers[diverIndex]
    }

    cancel() {}

    override willUndo(action: GameAction) {
        if (isLaunch(action)) {
            this.chosenActionCategory = ActionCategory.Move
            this.chosenMothership = action.mothership
            this.chosenNumDivers = action.numSundivers
            this.chosenDestination = undefined
        }
    }

    back() {
        if (this.chosenNumDivers) {
            this.chosenNumDivers = undefined
            if (this.numPlayerCanMoveFromSource() === 1) {
                if (this.chosenMothership) {
                    this.chosenMothership = undefined
                } else if (this.chosenSource) {
                    this.chosenSource = undefined
                }
            }
        } else if (this.chosenMothership) {
            this.chosenMothership = undefined
            if (!this.myPlayerState?.hasSundiversOnTheBoard()) {
                this.chosenActionCategory = undefined
            }
        } else if (this.chosenSource) {
            this.chosenSource = undefined
        } else if (this.chosenActionCategory && !this.isMoving) {
            this.chosenActionCategory = undefined
        } else if (this.chosenAction) {
            this.chosenAction = undefined
        }
    }

    resetAction() {
        this.chosenAction = undefined
        this.chosenActionCategory = undefined
        this.chosenMothership = undefined
        this.chosenSource = undefined
        this.chosenNumDivers = undefined
    }

    override shouldAutoStepAction(_action: GameAction) {
        return false
    }

    async launch() {
        if (
            !this.myPlayer ||
            !this.chosenMothership ||
            !this.chosenNumDivers ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid launch')
        }

        const action = {
            ...this.createBaseAction(ActionType.Launch),
            mothership: this.myPlayer.id,
            numSundivers: this.chosenNumDivers,
            destination: this.chosenDestination
        }

        await this.doAction(action)

        this.chosenMothership = undefined
        this.chosenNumDivers = undefined
        this.chosenDestination = undefined
    }

    async fly() {
        if (
            !this.myPlayer ||
            !this.chosenSource ||
            !this.chosenNumDivers ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid flight')
        }
        const cell = this.gameState.board.cellAt(this.chosenSource)
        const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
        if (playerDivers.length < this.chosenNumDivers) {
            throw new Error('Not enough divers')
        }

        // We want to take the last ones first
        const diverIds = playerDivers
            .toReversed()
            .slice(0, this.chosenNumDivers)
            .map((diver) => diver.id)

        const action = {
            ...this.createBaseAction(ActionType.Fly),
            playerId: this.myPlayer.id,
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination
        }

        await this.doAction(action)

        this.chosenSource = undefined
        this.chosenNumDivers = undefined
        this.chosenDestination = undefined
    }

    async doAction(action: GameAction) {
        if (!this.isPlayable) {
            return
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error for action', e, action)
        }
    }
}
