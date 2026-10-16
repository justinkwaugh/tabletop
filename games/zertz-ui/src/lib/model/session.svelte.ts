import { GameSession, type TitlePreferences } from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    ActionType,
    Capture,
    PlaceMarble,
    RemoveRing,
    ZertzPreferenceDefinition,
    type HydratedZertzGameState,
    type ZertzPreferences,
    type MarbleColor,
    type ZertzGameState
} from '@tabletop/zertz'
import {
    hasManualZertzSelection,
    popZertzSelection,
    setZertzSelection,
    type ZertzSelection
} from './stagedSelection.js'
import { boardFrame } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'
import { sinkingRingsAfter } from '$lib/board/sinkingRings.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export class ZertzGameSession extends GameSession<ZertzGameState, HydratedZertzGameState> {
    selection: ZertzSelection = $state({})

    readonly preferences: TitlePreferences<typeof ZertzPreferences> =
        this.createPreferences(ZertzPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)
    rippleWater: boolean = $derived(this.preferences.values.rippleWater)

    notation: BoardNotation = $derived(boardNotation(boardFrame(this.gameState.setup).positions))

    // The actions list moves ahead as soon as an action is taken, so the sunken rings follow the
    // actions behind the state on show, which an animated transition still holds back.
    sinkingRings: AxialCoordinates[] = $derived(
        sinkingRingsAfter(this.actions.slice(0, this.gameState.actionCount))
    )

    canPlace = $derived(this.canAct(ActionType.PlaceMarble))
    canRemove = $derived(this.canAct(ActionType.RemoveRing))
    canCapture = $derived(this.canAct(ActionType.Capture))

    placeableColors: MarbleColor[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canPlace && playerId ? this.gameState.placeableColors(playerId) : []
    })

    chosenColor: MarbleColor | undefined = $derived.by(() => {
        const manual = this.selection.color?.value
        if (manual !== undefined && this.placeableColors.includes(manual)) {
            return manual
        }
        return this.placeableColors.length === 1 ? this.placeableColors[0] : undefined
    })

    jumpers: AxialCoordinates[] = $derived.by(() => {
        if (!this.canCapture) {
            return []
        }
        const chainFrom = this.gameState.captureChainFrom
        if (chainFrom !== undefined) {
            return [chainFrom]
        }
        const froms: AxialCoordinates[] = []
        for (const jump of this.gameState.board.allJumps()) {
            if (!includesCoords(froms, jump.from)) {
                froms.push(jump.from)
            }
        }
        return froms
    })

    chosenJumper: AxialCoordinates | undefined = $derived.by(() => {
        const manual = this.selection.jumper?.value
        if (manual !== undefined && includesCoords(this.jumpers, manual)) {
            return manual
        }
        return this.jumpers.length === 1 ? this.jumpers[0] : undefined
    })

    landingRings: AxialCoordinates[] = $derived(
        this.chosenJumper
            ? this.gameState.board.jumpsFrom(this.chosenJumper).map((jump) => jump.to)
            : []
    )

    placementRings: AxialCoordinates[] = $derived(
        this.chosenColor ? this.gameState.board.vacantRings().map((ring) => ring.coords) : []
    )

    removableRings: AxialCoordinates[] = $derived(
        this.canRemove ? this.gameState.board.freeRings().map((ring) => ring.coords) : []
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    hasManualSelection(): boolean {
        return hasManualZertzSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popZertzSelection(this.selection)
            return
        }
        await super.undo()
    }

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    toggleRippleWater() {
        this.preferences.set({ rippleWater: !this.rippleWater })
    }

    resetAction() {
        this.selection = {}
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    chooseColor(color: MarbleColor) {
        if (!this.placeableColors.includes(color)) {
            return
        }
        const toggledOff = this.selection.color?.value === color
        this.selection = setZertzSelection(this.selection, 'color', toggledOff ? undefined : color)
    }

    chooseJumper(coords: AxialCoordinates) {
        if (!includesCoords(this.jumpers, coords)) {
            return
        }
        const current = this.selection.jumper?.value
        const toggledOff = current !== undefined && sameCoordinates(current, coords)
        this.selection = setZertzSelection(
            this.selection,
            'jumper',
            toggledOff ? undefined : coords
        )
    }

    async chooseRing(coords: AxialCoordinates) {
        if (includesCoords(this.removableRings, coords)) {
            await this.removeRing(coords)
        } else if (includesCoords(this.landingRings, coords)) {
            await this.capture(coords)
        } else if (includesCoords(this.placementRings, coords)) {
            await this.placeMarble(coords)
        }
    }

    private async placeMarble(coords: AxialCoordinates) {
        const color = this.chosenColor
        if (color === undefined) {
            return
        }
        await this.applyAction(this.createPlayerAction(PlaceMarble, { color, coords }))
    }

    private async removeRing(coords: AxialCoordinates) {
        await this.applyAction(this.createPlayerAction(RemoveRing, { coords }))
    }

    private async capture(to: AxialCoordinates) {
        const from = this.chosenJumper
        if (from === undefined) {
            return
        }
        await this.applyAction(this.createPlayerAction(Capture, { from, to }))
    }
}
