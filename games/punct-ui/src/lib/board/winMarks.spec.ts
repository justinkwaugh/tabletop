import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine } from '@tabletop/common'
import {
    ActionType,
    CENTRE_SPACES,
    EndReason,
    HydratedPunctGameState,
    PieceKind,
    PunctGameStateValidator,
    PunctRuntime,
    spaceAt,
    spaceName
} from '@tabletop/punct'
import { winMarksOf } from './marks.js'
import { winningLine } from './winningLine.js'
import { VIEW } from './geometry.js'

const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')
const engine = new GameEngine(PunctRuntime)
const WHITE = 'player-1'

function placed(scenario: string, kind: PieceKind, punct: string, rotation: number) {
    const { game, state } = JSON.parse(readFileSync(join(FOLDER, `${scenario}.json`), 'utf8'))
    const action = {
        id: 'win',
        gameId: game.id,
        source: ActionSource.User,
        playerId: WHITE,
        type: ActionType.PlacePiece,
        kind,
        punct: spaceAt(punct),
        rotation
    }
    const { updatedState } = engine.executeCanonicalAction({ game, state, action })
    if (!PunctGameStateValidator.Check(updatedState)) throw Error('The move leads to a state')
    return new HydratedPunctGameState(updatedState)
}

describe('the marks of a win', () => {
    it('runs a connection along its shortest chain, side to side over every level', () => {
        const state = placed('one-from-a-connection', PieceKind.StraightEnd, 'D8', 2)
        expect(state.endReason).toBe(EndReason.Connection)
        const marks = winMarksOf(state)
        if (marks === undefined || !('run' in marks)) throw Error('A connection shows its run')
        expect(marks.run.cells.map(spaceName).join(' ')).toBe(
            'A8 B8 C8 D8 E8 F8 G8 H8 I8 J8 K8 L8 M8 N8 O9 P10 Q10'
        )
        expect(marks.run.cells.map((cell) => state.board.heightAt(cell))).toEqual([
            1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1
        ])
        const line = winningLine(state.board, marks.run, VIEW)
        expect(line.match(/[ML]/g)?.length).toBeGreaterThanOrEqual(2)
    })

    it('marks the winner’s central spaces when the last piece decides the count', () => {
        const before = new HydratedPunctGameState(
            JSON.parse(readFileSync(join(FOLDER, 'last-piece.json'), 'utf8')).state
        )
        const [kind] = before.kindsInReserve(WHITE)
        const [entry] = before.entriesOf(WHITE, kind)
        const state = placed('last-piece', kind, spaceName(entry.punct), entry.rotation)
        expect(state.endReason).toBe(EndReason.CentreCount)
        expect(state.winningPlayerIds).toEqual([WHITE])
        const marks = winMarksOf(state)
        if (marks === undefined || !('centre' in marks)) throw Error('A count shows its spaces')
        expect(marks.centre).toHaveLength(state.board.centreCount(WHITE))
        expect(
            CENTRE_SPACES.filter((coords) => state.board.topAt(coords)?.piece.playerId === WHITE)
        ).toEqual(marks.centre)
    })
})
