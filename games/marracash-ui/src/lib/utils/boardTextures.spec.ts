import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BoardTextures, textureFingerprint } from './boardTextures.js'
import fingerprints from '../textures/fingerprints.json'

// A WebP's canvas size, from its extended (VP8X) or simple lossy (VP8) header.
function webpSize(bytes: Buffer): { width: number; height: number } {
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
    const chunk = bytes.toString('ascii', 12, 16)
    if (chunk === 'VP8X') {
        return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 }
    }
    expect(chunk).toBe('VP8 ')
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }
}

describe('board textures', () => {
    it.each(Object.values(BoardTextures))(
        'renders $file at its tile size and resolution',
        ({ file, size, resolution }) => {
            const bytes = readFileSync(new URL(`../textures/${file}.webp`, import.meta.url))
            const side = size * resolution
            expect(webpSize(bytes)).toEqual({ width: side, height: side })
        }
    )

    it.each(Object.values(BoardTextures))('draws $file from its current settings', (texture) => {
        expect(fingerprints).toHaveProperty(texture.file, textureFingerprint(texture))
    })
})
