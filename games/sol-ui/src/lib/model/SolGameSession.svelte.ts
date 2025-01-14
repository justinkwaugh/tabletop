import { GameSession, GameSessionMode } from '@tabletop/frontend-components'
import {
    ActionType,
    Fly,
    HydratedSolGameState,
    isLaunch,
    Launch,
    MachineState,
    SolGameState
} from '@tabletop/sol'
import { GameAction, OffsetCoordinates } from '@tabletop/common'
import { ActionCategory } from '$lib/definition/actionCategory.js'

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

    cancel() {}

    override willUndo(action: GameAction) {
        if (isLaunch(action)) {
            this.chosenActionCategory = ActionCategory.Move
            this.chosenMothership = action.mothership
            this.chosenNumDivers = action.numSundivers
            this.chosenDestination = undefined
        } else {
            this.resetAction()
        }
    }

    back() {
        if (this.chosenNumDivers) {
            this.chosenNumDivers = undefined
        } else if (this.chosenMothership) {
            this.chosenMothership = undefined
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

        const action: Launch = {
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
        const diverIds = playerDivers.slice(0, this.chosenNumDivers).map((diver) => diver.id)

        const action: Fly = {
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
        if (this.mode !== GameSessionMode.Play) {
            return
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error for action', e, action)
            this.resetAction()
        }
    }

    // async drawRoof(index: number) {
    //     const action = {
    //         ...this.createBaseAction(ActionType.DrawRoof),
    //         visibleIndex: index,
    //         revealsInfo: true
    //     }

    //     await this.doAction(action)
    // }
}
