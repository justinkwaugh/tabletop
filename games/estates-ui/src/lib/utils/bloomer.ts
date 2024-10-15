import type { Effects } from '$lib/model/Effects.svelte'
import type { Object3D } from 'three'

export class Bloomer {
    removeTimers = new Map<unknown, ReturnType<typeof setTimeout>>()

    constructor(private readonly effects: Effects) {}

    addBloom(object: Object3D, parentName?: string) {
        const obj = parentName ? this.findParentByName(object, parentName) : object
        const mesh = obj?.getObjectByName('outlineMesh')
        if (mesh) {
            if (this.removeTimers.has(obj)) {
                clearTimeout(this.removeTimers.get(obj))
                this.removeTimers.delete(obj)
            }
            this.effects.bloom?.selection.add(mesh)
        }
    }

    removeBloom(object: Object3D, parentName?: string) {
        const obj = parentName ? this.findParentByName(object, parentName) : object
        const mesh = obj?.getObjectByName('outlineMesh')
        if (mesh) {
            this.removeTimers.set(
                obj,
                setTimeout(() => {
                    try {
                        this.effects.bloom?.selection.delete(mesh)
                    } finally {
                        this.removeTimers.delete(obj)
                    }
                }, 100)
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
