import type { Effects } from '$lib/model/Effects.svelte'
import type { Object3D } from 'three'

export class Outliner {
    unHighlightTimers = new Map<unknown, ReturnType<typeof setTimeout>>()

    constructor(private readonly effects: Effects) {}

    findAndOutline(object: Object3D, parentName?: string) {
        const obj = parentName ? this.findParentByName(object, parentName) : object
        const mesh = obj?.getObjectByName('outlineMesh')
        if (mesh) {
            if (this.unHighlightTimers.has(obj)) {
                clearTimeout(this.unHighlightTimers.get(obj))
                this.unHighlightTimers.delete(obj)
            }
            this.effects.outline?.selection.add(mesh)
        }
    }

    removeOutline(object: Object3D, parentName?: string) {
        const obj = parentName ? this.findParentByName(object, parentName) : object
        const mesh = obj?.getObjectByName('outlineMesh')
        if (mesh) {
            this.unHighlightTimers.set(
                obj,
                setTimeout(() => {
                    try {
                        this.effects.outline?.selection.delete(mesh)
                    } finally {
                        this.unHighlightTimers.delete(obj)
                    }
                }, 50)
            )
        }
    }

    private findParentByName(obj: Object3D, name: string) {
        if (obj.name === name) {
            return obj
        }
        while (obj.parent) {
            if (obj.parent.name === name) {
                return obj.parent
            }
            obj = obj.parent
        }
        return undefined
    }
}
