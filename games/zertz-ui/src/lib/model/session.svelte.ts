import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Capture,
    isPlaceMarble,
    PlaceMarble,
    ZertzPreferenceDefinition,
    type HydratedZertzGameState,
    type ZertzPreferences,
    type MarbleColor,
    type ZertzGameState
} from '@tabletop/zertz'
import {
    hasManualZertzSelection,
    popZertzSelection,
    restagedZertzSelection,
    setZertzSelection,
    type ZertzSelection
} from './stagedSelection.js'
import { viewOf, type BoardView } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export class ZertzGameSession extends GameSession<ZertzGameState, HydratedZertzGameState> {
    selection: ZertzSelection = $state({})
    // The move being undone. Undo takes your marble back onto its ring, staged as you chose it,
    // and a further Undo takes it off the ring.
    undoingMove: PlaceMarble | undefined

    readonly preferences: TitlePreferences<typeof ZertzPreferences> =
        this.createPreferences(ZertzPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)
    // The board seen from the far side, half a turn round.
    turned: boolean = $derived(this.preferences.values.turned)
    view: BoardView = $derived(viewOf(this.turned))

    notation: BoardNotation = $derived(
        boardNotation(this.view.frame(this.gameState.setup).positions, this.view)
    )

    canPlace = $derived(this.canAct(ActionType.PlaceMarble))
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

    private vacantRings: AxialCoordinates[] = $derived(
        this.gameState.board.vacantRings().map((ring) => ring.coords)
    )

    // The ring your marble stands on, staged until you choose a ring to remove.
    chosenPlace: AxialCoordinates | undefined = $derived.by(() => {
        const place = this.selection.place?.value
        if (place === undefined || this.chosenColor === undefined) return undefined
        return includesCoords(this.vacantRings, place) ? place : undefined
    })

    placementRings: AxialCoordinates[] = $derived(
        this.chosenColor && !this.chosenPlace ? this.vacantRings : []
    )

    removableRings: AxialCoordinates[] = $derived.by(() => {
        const place = this.chosenPlace
        const color = this.chosenColor
        if (place === undefined || color === undefined) return []
        return this.removableAfterPlacing(color, place)
    })

    // Choosing the staged marble again changes its colour, when there is another to place.
    canChangeStagedColor: boolean = $derived(
        this.chosenPlace !== undefined && this.placeableColors.length > 1
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

    toggleTurned() {
        this.preferences.set({ turned: !this.turned })
    }

    resetAction() {
        this.selection = {}
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isPlaceMarble(action) && action.remove !== undefined ? action : undefined
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        const move = kind === 'undo' ? this.undoingMove : undefined
        this.selection = move ? restagedZertzSelection(move, this.hadColorChoice(move)) : {}
        if (kind !== 'undo') this.undoingMove = undefined
    }

    // Whether the player of a move taken back could have placed another colour.
    private hadColorChoice(move: PlaceMarble): boolean {
        const state = this.incomingGameState ?? this.gameState
        return state.placeableColors(move.playerId).length > 1
    }

    chooseColor(color: MarbleColor) {
        if (!this.placeableColors.includes(color)) {
            return
        }
        const toggledOff = this.selection.color?.value === color
        const place = this.chosenPlace
        if (toggledOff || place === undefined) {
            this.selection = setZertzSelection(
                this.selection,
                'color',
                toggledOff ? undefined : color
            )
            return
        }
        // A marble already staged in its ring changes to the colour chosen.
        void this.stagePlacement(setZertzSelection(this.selection, 'color', color), place)
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

    // Tapping where there is nothing to choose takes a staged marble off its ring, or else lets go
    // of a chosen colour or jumper.
    letGo() {
        if (this.selection.place !== undefined) {
            this.selection = setZertzSelection(this.selection, 'place', undefined)
        } else if (this.hasManualSelection()) {
            this.selection = setZertzSelection(this.selection, 'color', undefined)
        }
    }

    // A placement that leaves a ring to remove stands staged on its ring; one that ends the move
    // goes straight in, as does the removal that completes a staged one.
    async chooseRing(coords: AxialCoordinates) {
        if (includesCoords(this.removableRings, coords)) {
            await this.placeMarble(coords)
        } else if (includesCoords(this.landingRings, coords)) {
            await this.capture(coords)
        } else if (includesCoords(this.placementRings, coords)) {
            await this.stagePlacement(this.selection, coords)
        }
    }

    // The next colour takes the staged marble's place.
    async changeStagedColor() {
        const place = this.chosenPlace
        const color = this.chosenColor
        if (place === undefined || color === undefined || !this.canChangeStagedColor) return
        const colors = this.placeableColors
        const next = colors[(colors.indexOf(color) + 1) % colors.length]
        await this.stagePlacement(setZertzSelection(this.selection, 'color', next), place)
    }

    private async stagePlacement(selection: ZertzSelection, place: AxialCoordinates) {
        this.selection = setZertzSelection(selection, 'place', place)
        const color = this.chosenColor
        if (color !== undefined && this.removableAfterPlacing(color, place).length === 0) {
            await this.placeMarble()
        }
    }

    private removableAfterPlacing(color: MarbleColor, place: AxialCoordinates) {
        const playerId = this.myPlayer?.id
        if (playerId === undefined) return []
        return this.gameState.removableAfterPlacing(playerId, color, place)
    }

    private async placeMarble(remove?: AxialCoordinates) {
        const color = this.chosenColor
        const coords = this.chosenPlace
        if (color === undefined || coords === undefined) {
            return
        }
        await this.applyAction(
            this.createPlayerAction(PlaceMarble, {
                color,
                coords,
                ...(remove === undefined ? {} : { remove })
            })
        )
    }

    private async capture(to: AxialCoordinates) {
        const from = this.chosenJumper
        if (from === undefined) {
            return
        }
        await this.applyAction(this.createPlayerAction(Capture, { from, to }))
    }
}
