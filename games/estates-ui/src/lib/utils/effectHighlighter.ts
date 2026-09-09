import type { Selection } from 'postprocessing'
import type { Object3D } from 'three'

export class EffectHighlighter {
    private readonly meshes = new Set<Object3D>()
    private readonly timers = new Map<Object3D, ReturnType<typeof setTimeout>>()

    constructor(
        private readonly selection: () => Selection | undefined,
        private readonly invalidate: () => void
    ) {}

    highlight(object: Object3D, parentName?: string) {
        const mesh = this.findMesh(object, parentName)
        if (!mesh) return

        clearTimeout(this.timers.get(mesh))
        this.timers.delete(mesh)
        this.meshes.add(mesh)
        this.selection()?.add(mesh)
        this.invalidate()
    }

    remove(object: Object3D, parentName?: string) {
        const mesh = this.findMesh(object, parentName)
        if (!mesh) return

        clearTimeout(this.timers.get(mesh))
        this.timers.set(
            mesh,
            setTimeout(() => {
                this.selection()?.delete(mesh)
                this.meshes.delete(mesh)
                this.timers.delete(mesh)
                this.invalidate()
            }, 100)
        )
    }

    dispose() {
        for (const timer of this.timers.values()) clearTimeout(timer)
        for (const mesh of this.meshes) this.selection()?.delete(mesh)
        this.timers.clear()
        this.meshes.clear()
        this.invalidate()
    }

    private findMesh(object: Object3D, parentName?: string): Object3D | undefined {
        let parent: Object3D | null = object
        if (parentName) {
            while (parent && parent.name !== parentName) parent = parent.parent
        }
        return parent?.getObjectByName('outlineMesh')
    }
}
