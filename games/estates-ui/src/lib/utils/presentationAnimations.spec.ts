import { afterEach, expect, test, vi } from 'vitest'
import { gsap } from 'gsap'
import { Mesh, MeshBasicMaterial } from 'three'
import { AuctionPreviewGroup } from './auctionPreviewGroup.js'
import { PulsingMaterial } from './pulsingMaterial.js'

function advance(seconds: number) {
    gsap.globalTimeline.time(gsap.globalTimeline.time() + seconds)
}

afterEach(() => {
    gsap.globalTimeline.clear()
    gsap.ticker.sleep()
})

test('placement pulses survive interrupted exit, then stop requesting frames after hiding', () => {
    const invalidate = vi.fn()
    const material = new PulsingMaterial(invalidate, 0.4)
    advance(1)
    expect(material.opacity).toBe(0)
    expect(invalidate).not.toHaveBeenCalled()

    material.active = true
    advance(0.6)
    expect(material.opacity).toBeCloseTo(1)
    material.active = false
    advance(0.1)
    expect(material.opacity).toBeGreaterThan(0)
    expect(material.opacity).toBeLessThan(1)
    material.active = true
    advance(0.6)
    expect(material.opacity).toBeCloseTo(1)
    material.active = false
    advance(0.2)
    expect(material.opacity).toBe(0)
    invalidate.mockClear()
    advance(2)
    expect(invalidate).not.toHaveBeenCalled()

    material.active = true
    advance(0.3)
    material.dispose()
    invalidate.mockClear()
    advance(2)
    expect(invalidate).not.toHaveBeenCalled()
})

test('camera visibility changes preserve preview entrance and disposal cancels remaining work', () => {
    const invalidate = vi.fn()
    const preview = new AuctionPreviewGroup(invalidate)
    const material = new MeshBasicMaterial()
    const piece = new Mesh(undefined, material)
    preview.add(piece)
    preview.reveal(piece)
    advance(0.05)
    expect(preview.position.y).toBeGreaterThan(-2.4)
    expect(preview.position.y).toBeLessThan(0)
    preview.concealed = true
    advance(0.2)
    expect(preview.position.y).toBe(0)
    expect(material.opacity).toBe(0)
    preview.concealed = false
    advance(0.2)
    expect(material.opacity).toBe(1)
    expect(invalidate).toHaveBeenCalled()

    preview.reveal(piece)
    preview.dispose()
    invalidate.mockClear()
    advance(1)
    expect(invalidate).not.toHaveBeenCalled()
    material.dispose()
    piece.geometry.dispose()
})

test('late model loads cannot restart a preview that no longer contains their piece', () => {
    const invalidate = vi.fn()
    const preview = new AuctionPreviewGroup(invalidate)
    const material = new MeshBasicMaterial()
    const piece = new Mesh(undefined, material)
    preview.add(piece)
    preview.remove(piece)
    preview.reveal(piece)
    advance(1)
    expect(preview.position.y).toBe(0)
    expect(invalidate).not.toHaveBeenCalled()
    preview.dispose()
    material.dispose()
    piece.geometry.dispose()
})
