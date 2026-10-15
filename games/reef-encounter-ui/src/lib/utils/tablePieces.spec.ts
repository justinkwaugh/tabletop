import { describe, expect, it } from 'vitest'
import { AlgaColor, CoralColor } from '@tabletop/reef-encounter'
import {
    pieceChanges,
    type CoralTilePiece,
    type PolypPiece,
    type ShrimpPiece,
    type TablePiece
} from './tablePieces.js'

const shrimp = (
    key: string,
    playerId: string,
    x: number,
    container: 1 | 2 | 'sea' = 1
): ShrimpPiece => ({
    kind: 'shrimp',
    key,
    container,
    center: { x, y: 0 },
    place: '',
    playerId,
    upsideDown: false
})

const polyp = (key: string, color: CoralColor, x: number, larvaSpace?: CoralColor): PolypPiece => ({
    kind: 'polyp',
    key,
    container: larvaSpace ? 'sea' : 1,
    center: { x, y: 0 },
    place: '',
    color,
    box: { x, y: 0, width: 10, height: 10 },
    url: '',
    mirrored: false,
    larvaSpace
})

const tile = (key: string, tileId: number): CoralTilePiece => ({
    kind: 'coralTile',
    key,
    container: 'sea',
    center: { x: 0, y: 0 },
    place: '',
    tileId,
    face: {
        stronger: CoralColor.Pink,
        weaker: CoralColor.Grey,
        largeAlga: AlgaColor.Blue,
        smallAlga: AlgaColor.Red
    },
    starfishSideUp: true,
    box: { x: 0, y: 0, width: 10, height: 10 },
    url: ''
})

const keys = (pieces: TablePiece[]) => pieces.map((piece) => piece.key)

describe('pieceChanges', () => {
    it('finds nothing when the pieces stay put', () => {
        const pieces = [shrimp('a', 'p1', 0), polyp('b', CoralColor.Pink, 1)]
        expect(pieceChanges(pieces, pieces)).toEqual({
            arriving: [],
            leaving: [],
            removed: [],
            moves: [],
            flips: []
        })
    })

    it('slides a shrimp moved along its reef', () => {
        const { arriving, leaving, removed, moves } = pieceChanges(
            [shrimp('from', 'p1', 0)],
            [shrimp('to', 'p1', 5)]
        )
        expect(arriving).toEqual([])
        expect(keys(leaving)).toEqual(['from'])
        expect(removed).toEqual([])
        expect(moves.map(({ piece, source }) => [piece.key, source.key])).toEqual([['to', 'from']])
    })

    it("lifts a shrimp off one drawing and lays it on another, and never slides another player's", () => {
        const { arriving, leaving, moves } = pieceChanges(
            [shrimp('reef', 'p1', 0), shrimp('other', 'p2', 0)],
            [shrimp('sea', 'p1', 0, 'sea'), shrimp('moved', 'p1', 3)]
        )
        expect(keys(arriving)).toEqual(['sea'])
        expect(moves.map(({ piece, source }) => [piece.key, source.key])).toEqual([
            ['moved', 'reef']
        ])
        expect(keys(leaving)).toEqual(['reef', 'other'])
    })

    it('replaces an attacked polyp on a reef rather than sliding one', () => {
        const { arriving, leaving, removed, moves } = pieceChanges(
            [polyp('weak', CoralColor.Grey, 0)],
            [polyp('strong', CoralColor.Grey, 0)]
        )
        expect(keys(arriving)).toEqual(['strong'])
        expect(keys(leaving)).toEqual(['weak'])
        expect(keys(removed)).toEqual(['weak'])
        expect(moves).toEqual([])
    })

    it('shuffles polyps along a larva space as it fills', () => {
        const { arriving, moves } = pieceChanges(
            [polyp('1of1', CoralColor.Pink, 0, CoralColor.White)],
            [
                polyp('1of2', CoralColor.Pink, 0, CoralColor.White),
                polyp('2of2', CoralColor.Grey, 5, CoralColor.White)
            ]
        )
        expect(moves.map(({ piece, source }) => [piece.key, source.key])).toEqual([
            ['1of2', '1of1']
        ])
        expect(keys(arriving)).toEqual(['2of2'])
    })

    it('turns a flipped coral tile over in place', () => {
        const { arriving, leaving, removed, flips } = pieceChanges(
            [tile('1:starfish', 1), tile('2:starfish', 2)],
            [tile('1:plain', 1), tile('2:starfish', 2)]
        )
        expect(removed).toEqual([])
        expect(flips.map(({ piece, from }) => [piece.key, from.key])).toEqual([
            ['1:plain', '1:starfish']
        ])
        expect(arriving).toEqual([])
        expect(keys(leaving)).toEqual(['1:starfish'])
    })
})
