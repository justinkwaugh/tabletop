import { Group, Object3D } from 'three'
import { gsap } from 'gsap'
import { fade, fadeOut, hideInstant } from './animations.js'

export class AuctionPreviewGroup extends Group {
    private hiddenValue = false
    private piece?: Object3D
    private visibilityTimeline?: gsap.core.Timeline
    private entranceTween?: gsap.core.Tween

    constructor(private readonly invalidate: () => void) {
        super()
    }

    get concealed(): boolean {
        return this.hiddenValue
    }

    set concealed(value: boolean) {
        if (value === this.hiddenValue) return
        this.hiddenValue = value
        this.updateVisibility()
    }

    reveal(piece: Object3D): void {
        let parent = piece.parent
        while (parent && parent !== this) parent = parent.parent
        if (parent !== this) return
        this.piece = piece
        hideInstant(piece)
        this.updateVisibility()
        this.entranceTween?.kill()
        this.entranceTween = gsap.fromTo(
            this.position,
            { y: -2.4 },
            { y: 0, duration: 0.2, onUpdate: this.invalidate }
        )
    }

    leave(timeline: gsap.core.Timeline): void {
        this.visibilityTimeline?.kill()
        fadeOut({
            object: this,
            duration: 0.2,
            timeline,
            startAt: 0,
            onUpdate: this.invalidate
        })
    }

    dispose(): void {
        this.visibilityTimeline?.kill()
        this.entranceTween?.kill()
        this.piece = undefined
    }

    private updateVisibility(): void {
        if (!this.piece) return
        this.visibilityTimeline?.kill()
        this.visibilityTimeline = fade({
            object: this.piece,
            opacity: this.hiddenValue ? 0 : 1,
            duration: 0.2,
            onUpdate: this.invalidate
        })
    }
}
