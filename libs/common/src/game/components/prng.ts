import { Static, Type } from '@sinclair/typebox'
import { Hydratable } from '../../util/hydration.js'
import { getPrng, RandomFunction } from '../../util/prng.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'

export type Prng = Static<typeof Prng>
export const Prng = Type.Object({
    seed: Type.Number(),
    invocations: Type.Number()
})

const PrngValidator = TypeCompiler.Compile(Prng)

export class HydratedPrng extends Hydratable<typeof Prng> implements Prng {
    declare seed: number
    declare invocations: number

    private prng: RandomFunction

    constructor(data: Prng) {
        super(data, PrngValidator)

        this.prng = getPrng(this.seed)
        for (let i = 0; i < this.invocations; i++) {
            this.prng()
        }
    }

    random(): number {
        this.invocations += 1
        return this.prng()
    }

    randInt(min: number, max: number): number {
        return Math.floor(this.random() * (max - min + 1)) + min
    }
}
