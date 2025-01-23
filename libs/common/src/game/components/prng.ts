import { Static, Type } from '@sinclair/typebox'
import { getPrng, RandomFunction } from '../../util/prng.js'

export type PrngState = Static<typeof PrngState>
export const PrngState = Type.Object({
    seed: Type.Number(),
    invocations: Type.Number()
})

export class Prng {
    private prng: RandomFunction

    constructor(private state: PrngState) {
        this.prng = getPrng(state.seed)
        for (let i = 0; i < state.invocations; i++) {
            this.prng()
        }
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

    dieRoll = (sides: number): number => {
        return 1 + this.randInt(sides)
    }
}
