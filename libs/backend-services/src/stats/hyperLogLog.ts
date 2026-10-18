import { createHash } from 'node:crypto'
import { assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'

const PRECISION = 12
const REGISTERS = 1 << PRECISION
const REMAINDER_BITS = 32 - PRECISION
const DENSE_AFTER = 512

export const DistinctSketch = Type.Union([
    Type.Object(
        { hashes: Type.Array(Type.Integer({ minimum: 0 })) },
        { additionalProperties: false }
    ),
    Type.Object({ registers: Type.String() }, { additionalProperties: false })
])
export type DistinctSketch = Static<typeof DistinctSketch>

export function sketchOf(values: Iterable<string>): DistinctSketch {
    const hashes = [...new Set([...values].map(hashOf))].sort((a, b) => a - b)
    if (hashes.length <= DENSE_AFTER) return { hashes }
    return { registers: Buffer.from(registersOf(hashes)).toString('base64') }
}

export function countDistinct(sketches: readonly DistinctSketch[]): number {
    const hashes = new Set<number>()
    const registers = new Uint8Array(REGISTERS)
    let dense = false
    for (const sketch of sketches) {
        if ('hashes' in sketch) for (const hash of sketch.hashes) hashes.add(hash)
        else {
            dense = true
            const stored = new Uint8Array(Buffer.from(sketch.registers, 'base64'))
            assert(stored.length === REGISTERS, `A sketch holds ${REGISTERS} registers`)
            mergeInto(registers, stored)
        }
    }
    if (!dense) return hashes.size
    mergeInto(registers, registersOf(hashes))
    return estimate(registers)
}

function hashOf(value: string): number {
    return createHash('sha256').update(value).digest().readUInt32BE(0)
}

function registersOf(hashes: Iterable<number>): Uint8Array {
    const registers = new Uint8Array(REGISTERS)
    for (const hash of hashes) {
        const register = hash >>> REMAINDER_BITS
        const remainder = hash & ((1 << REMAINDER_BITS) - 1)
        const rank = remainder === 0 ? REMAINDER_BITS + 1 : Math.clz32(remainder) - PRECISION + 1
        registers[register] = Math.max(registers[register], rank)
    }
    return registers
}

function mergeInto(target: Uint8Array, source: Uint8Array) {
    source.forEach((rank, register) => {
        target[register] = Math.max(target[register], rank)
    })
}

function estimate(registers: Uint8Array): number {
    let harmonic = 0
    let empty = 0
    for (const rank of registers) {
        harmonic += 2 ** -rank
        if (rank === 0) empty += 1
    }
    const alpha = 0.7213 / (1 + 1.079 / REGISTERS)
    const raw = (alpha * REGISTERS * REGISTERS) / harmonic
    if (raw <= 2.5 * REGISTERS && empty > 0)
        return Math.round(REGISTERS * Math.log(REGISTERS / empty))
    return Math.round(raw)
}
