import { describe, expect, it } from 'vitest'
import { addressReader } from './agreement.js'

describe('addressReader', () => {
    it('turns third-person phrases to the reader', () => {
        expect(addressReader(' sails from ')).toBe(' sail from ')
        expect(addressReader(' has no route out and stays in ')).toBe(
            ' have no route out and stays in '
        )
        expect(addressReader(', a city they raided, and stays in ')).toBe(
            ', a city you raided, and stays in '
        )
        expect(addressReader(' splits their cargo, setting aside ')).toBe(
            ' split your cargo, setting aside '
        )
        expect(addressReader(' cannot bid')).toBe(' cannot bid')
        expect(addressReader(' reaches five')).toBe(' reach five')
    })
})
