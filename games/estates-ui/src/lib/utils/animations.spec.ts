import { expect, test, vi } from 'vitest'
import { gsap } from 'gsap'
import { Mesh, MeshBasicMaterial } from 'three'
import { fadeOut, scaleIn } from './animations.js'

test('imperative material and scale tweens request intermediate and final frames', () => {
    const material = new MeshBasicMaterial()
    const mesh = new Mesh(undefined, material)
    mesh.scale.setScalar(0.1)
    const invalidate = vi.fn()
    const onUpdate = vi.fn()
    const onComplete = vi.fn()
    const timeline = gsap.timeline({ paused: true, onUpdate, onComplete })

    fadeOut({ object: mesh, duration: 1, timeline, startAt: 0, onUpdate: invalidate })
    scaleIn({ object: mesh, duration: 1, timeline, startAt: 0, onUpdate: invalidate })
    timeline.progress(0.5)
    expect(material.opacity).toBeGreaterThan(0)
    expect(material.opacity).toBeLessThan(1)
    expect(mesh.scale.x).toBeGreaterThan(0.1)
    expect(mesh.scale.x).toBeLessThan(1)
    expect(invalidate).toHaveBeenCalled()
    invalidate.mockClear()

    timeline.progress(1)
    expect(material.opacity).toBe(0)
    expect(mesh.scale.x).toBe(1)
    expect(invalidate).toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledOnce()
    timeline.kill()
    material.dispose()
    mesh.geometry.dispose()
})
