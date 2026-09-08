import { afterEach, expect, test, vi } from 'vitest'
import { Selection } from 'postprocessing'
import { Group, Mesh } from 'three'
import { EffectHighlighter } from './effectHighlighter.js'

afterEach(() => vi.useRealTimers())

test('hover entry and delayed exit each request a frame, and reentry cancels exit', () => {
    vi.useFakeTimers()
    const selection = new Selection()
    const invalidate = vi.fn()
    const highlighter = new EffectHighlighter(() => selection, invalidate)
    const group = new Group()
    group.name = 'piece'
    const mesh = new Mesh()
    mesh.name = 'outlineMesh'
    group.add(mesh)

    highlighter.highlight(mesh, 'piece')
    expect(selection.has(mesh)).toBe(true)
    expect(invalidate).toHaveBeenCalledTimes(1)

    highlighter.remove(mesh, 'piece')
    vi.advanceTimersByTime(50)
    highlighter.highlight(mesh, 'piece')
    vi.advanceTimersByTime(100)
    expect(selection.has(mesh)).toBe(true)
    expect(invalidate).toHaveBeenCalledTimes(2)

    highlighter.remove(mesh, 'piece')
    vi.advanceTimersByTime(100)
    expect(selection.has(mesh)).toBe(false)
    expect(invalidate).toHaveBeenCalledTimes(3)
})

test('unmount clears owned highlights and cancels pending work', () => {
    vi.useFakeTimers()
    const selection = new Selection()
    const invalidate = vi.fn()
    const highlighter = new EffectHighlighter(() => selection, invalidate)
    const mesh = new Mesh()
    mesh.name = 'outlineMesh'
    const otherMesh = new Mesh()
    selection.add(otherMesh)

    highlighter.highlight(mesh)
    highlighter.remove(mesh)
    highlighter.dispose()
    expect(selection.has(mesh)).toBe(false)
    expect(selection.has(otherMesh)).toBe(true)
    expect(invalidate).toHaveBeenCalledTimes(2)
    vi.runAllTimers()
    expect(invalidate).toHaveBeenCalledTimes(2)
})
