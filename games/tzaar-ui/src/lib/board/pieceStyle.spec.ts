import { describe, expect, it } from 'vitest'
import { seedOf, sideSpecks, topSpecks, turnSpeck } from './pieceStyle.js'

describe('specks', () => {
    it('come out the same for the same piece, wherever it is drawn', () => {
        expect(topSpecks('white', seedOf('7:white'))).toEqual(topSpecks('white', seedOf('7:white')))
        expect(sideSpecks('black', seedOf('7:black'), 0.28)).toEqual(
            sideSpecks('black', seedOf('7:black'), 0.28)
        )
    })

    it('differ from one piece to the next', () => {
        expect(topSpecks('white', seedOf('7:white'))).not.toEqual(
            topSpecks('white', seedOf('8:white'))
        )
    })

    it('turn with the board, as its spaces do', () => {
        const speck = { x: 0.5, y: 0.2, r: 0.02, stretch: 1.5, angle: 30 }
        expect(turnSpeck(speck, 0)).toEqual(speck)
        expect(turnSpeck(speck, 1)).toMatchObject({ x: -0.2, y: 0.5, angle: 120 })
        expect(turnSpeck(speck, 2)).toMatchObject({ x: -0.5, y: -0.2, angle: 210 })
        expect(turnSpeck(speck, 3)).toMatchObject({ x: 0.2, y: -0.5 })
    })
})
