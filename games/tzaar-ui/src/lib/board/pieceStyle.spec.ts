import { describe, expect, it } from 'vitest'
import { seedOf, sideSpecks, topSpecks } from './pieceStyle.js'

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
})
