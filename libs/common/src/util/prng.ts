const SPLITMIX32_INCREMENT = 0x9e3779b9

function splitmix32(a: number) {
    return function () {
        a |= 0
        a = (a + SPLITMIX32_INCREMENT) | 0
        let t = a ^ (a >>> 16)
        t = Math.imul(t, 0x21f0aaad)
        t = t ^ (t >>> 15)
        t = Math.imul(t, 0x735a2d97)
        return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
    }
}

export type RandomFunction = () => number

export function generateSeed(): number {
    return (Math.random() * 2 ** 32) >>> 0
}

export function getPrng(seed?: number, invocations = 0): RandomFunction {
    if (seed === undefined) {
        seed = generateSeed()
    }
    return splitmix32(((seed | 0) + Math.imul(invocations, SPLITMIX32_INCREMENT)) | 0)
}

export function pickRandom<T>(array: T[], prng: RandomFunction = getPrng()): T {
    const randInt = Math.floor(prng() * array.length)
    return array[randInt]
}
