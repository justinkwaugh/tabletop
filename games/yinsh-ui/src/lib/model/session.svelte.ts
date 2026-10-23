import { GameSession, type TitlePreferences } from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    ActionType,
    MoveRing,
    PlaceRing,
    POINTS,
    RemoveRing,
    RemoveRow,
    YinshPreferenceDefinition,
    type HydratedYinshGameState,
    type RingMove,
    type YinshGameState,
    type YinshPreferences
} from '@tabletop/yinsh'
import {
    hasManualYinshSelection,
    popYinshSelection,
    setYinshSelection,
    type YinshSelection
} from './stagedSelection.js'
import { rowChoice, rowsThrough, type Row, type RowChoice } from './rowChoice.js'
import { coordsKey } from '$lib/board/geometry.js'
import { toneOf, type Tone } from '$lib/board/pieceStyle.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export class YinshGameSession extends GameSession<YinshGameState, HydratedYinshGameState> {
    selection: YinshSelection = $state({})

    readonly preferences: TitlePreferences<typeof YinshPreferences> =
        this.createPreferences(YinshPreferenceDefinition)
    clouds: boolean = $derived(this.preferences.values.clouds)

    toggleClouds() {
        this.preferences.set({ clouds: !this.clouds })
    }

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // Like the board, the ring spaces stay put whoever is watching. The starting player, White,
    // has theirs at the top, as their card is above the other in the players panel.
    topPlayerId: string = $derived(this.gameState.turnManager.turnOrder[0])

    canPlace = $derived(this.canAct(ActionType.PlaceRing))
    canMove = $derived(this.canAct(ActionType.MoveRing))
    canRemoveRow = $derived(this.canAct(ActionType.RemoveRow))
    canRemoveRing = $derived(this.canAct(ActionType.RemoveRing))

    private actorId: string | undefined = $derived(this.myPlayer?.id)

    placeable: AxialCoordinates[] = $derived(
        this.canPlace ? POINTS.filter((coords) => this.gameState.board.isVacant(coords)) : []
    )

    private ringMoves: { from: AxialCoordinates; moves: RingMove[] }[] = $derived(
        this.canMove && this.actorId !== undefined ? this.gameState.movesFor(this.actorId) : []
    )

    movable: AxialCoordinates[] = $derived(this.ringMoves.map((ring) => ring.from))

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => coordsKey(coords) === this.selection.from?.value)
    )

    destinations: RingMove[] = $derived(
        this.ringMoves.find(
            (ring) => this.chosenFrom && sameCoordinates(ring.from, this.chosenFrom)
        )?.moves ?? []
    )

    private rows: Row[] = $derived(
        this.canRemoveRow && this.actorId !== undefined
            ? this.gameState.board.rowsOf(this.actorId)
            : []
    )

    anchor: AxialCoordinates | undefined = $derived(
        this.rows.flat().find((coords) => coordsKey(coords) === this.selection.anchor?.value)
    )

    rowOptions: RowChoice = $derived(rowChoice(this.rows, this.anchor))

    removableRings: AxialCoordinates[] = $derived(
        this.canRemoveRing && this.actorId !== undefined
            ? this.gameState.board.ringsOf(this.actorId)
            : []
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    toneOfPlayer(playerId: string): Tone {
        return toneOf(this.gameState.getPlayerState(playerId).color)
    }

    hasManualSelection(): boolean {
        return hasManualYinshSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popYinshSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = {}
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    isClickable(coords: AxialCoordinates): boolean {
        return (
            includesCoords(this.placeable, coords) ||
            this.destinations.some((move) => sameCoordinates(move.to, coords)) ||
            includesCoords(this.movable, coords) ||
            includesCoords(this.rowOptions.markers, coords) ||
            includesCoords(this.removableRings, coords)
        )
    }

    async choosePoint(coords: AxialCoordinates) {
        if (includesCoords(this.placeable, coords)) {
            await this.applyAction(this.createPlayerAction(PlaceRing, { coords }))
        } else if (
            this.chosenFrom &&
            this.destinations.some((m) => sameCoordinates(m.to, coords))
        ) {
            await this.applyAction(
                this.createPlayerAction(MoveRing, { from: this.chosenFrom, to: coords })
            )
        } else if (includesCoords(this.movable, coords)) {
            const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, coords)
            this.selection = setYinshSelection(
                this.selection,
                'from',
                same ? undefined : coordsKey(coords)
            )
        } else if (includesCoords(this.rowOptions.markers, coords)) {
            await this.chooseMarker(coords)
        } else if (includesCoords(this.removableRings, coords)) {
            await this.applyAction(this.createPlayerAction(RemoveRing, { coords }))
        }
    }

    private async chooseMarker(coords: AxialCoordinates) {
        if (this.anchor && sameCoordinates(this.anchor, coords)) {
            this.selection = setYinshSelection(this.selection, 'anchor', undefined)
            return
        }
        if (includesCoords(this.rowOptions.settling, coords)) {
            const through = this.anchor === undefined ? [coords] : [this.anchor, coords]
            const [row] = rowsThrough(this.rows, ...through)
            await this.applyAction(
                this.createPlayerAction(RemoveRow, { from: row[0], to: row[row.length - 1] })
            )
            return
        }
        this.selection = setYinshSelection(this.selection, 'anchor', coordsKey(coords))
    }
}
