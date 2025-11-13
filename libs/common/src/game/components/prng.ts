import { type Static, Type } from '@sinclair/typebox'
import { getPrng, type RandomFunction } from '../../util/prng.js'
import { customRandom } from 'nanoid'

export type PrngState = Static<typeof PrngState>
export const PrngState = Type.Object({
    seed: Type.Number(),
    invocations: Type.Number()
})

export class Prng {
    private prng: RandomFunction
    private nanoid: () => string

    constructor(private state: PrngState) {
        this.prng = getPrng(state.seed)
        for (let i = 0; i < state.invocations; i++) {
            this.prng()
        }

        this.nanoid = customRandom(
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            21,
            (size) => {
                return new Uint8Array(size).map(() => 256 * this.random())
            }
        )
    }

    random = (): number => {
        this.state.invocations += 1
        return this.prng()
    }

    randInt = (max: number): number => {
        return Math.floor(this.random() * max)
    }

    randRange = (min: number, max: number): number => {
        return Math.floor(this.random() * (max - min + 1)) + min
    }

    randId = (): string => {
        return this.nanoid()
    }

    dieRoll = (sides: number): number => {
        return 1 + this.randInt(sides)
    }
}
