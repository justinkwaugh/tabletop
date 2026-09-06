import * as Type from 'typebox'
import { getChaChaPrng } from '../../util/chachaPrng.js'
import { getPrng, type RandomFunction } from '../../util/prng.js'
import { customRandom } from 'nanoid'
import { NeutralPrngAdapter, Policy, protect, redaction } from '../visibility/visibilitySchema.js'

export type PrngState = Type.Static<typeof PrngState>
export const PrngState = Type.Object({
    seed: Type.Number(),
    invocations: Type.Number()
})

export const ChaChaPrngState = Type.Object({
    algorithm: Type.Literal('chacha20-v1'),
    seed: Type.String({ pattern: '^[0-9a-f]{64}$' }),
    invocations: Type.Integer({ minimum: 0, maximum: 0xffffffff * 16 })
})
export type ChaChaPrngState = Type.Static<typeof ChaChaPrngState>
export const RandomState = Type.Union([
    Type.Object({ ...PrngState.properties, algorithm: Type.Optional(Type.Never()) }),
    ChaChaPrngState
])
export type RandomState = Type.Static<typeof RandomState>

export const ProtectedPrngState = protect(RandomState, {
    policy: Policy.HostOnly,
    redaction: redaction.replaceWith(
        NeutralPrngAdapter,
        Type.Object({ seed: Type.Literal(0), invocations: Type.Literal(0) })
    )
})

export class Prng {
    private prng: RandomFunction
    private nanoid: () => string

    constructor(private state: RandomState) {
        this.prng =
            state.algorithm === 'chacha20-v1'
                ? getChaChaPrng(state.seed, state.invocations)
                : getPrng(state.seed, state.invocations)

        this.nanoid = customRandom(
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            21,
            (size) => {
                return new Uint8Array(size).map(() => 256 * this.random())
            }
        )
    }

    random = (): number => {
        const value = this.prng()
        this.state.invocations += 1
        return value
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
