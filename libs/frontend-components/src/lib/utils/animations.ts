import { gsap } from 'gsap'

export class AnimationContext {
    private masterTimeline: gsap.core.Timeline
    readonly actionTimeline: gsap.core.Timeline
    readonly finalTimeline: gsap.core.Timeline

    private afterAnimationCallbacks: (() => void)[] = []

    constructor() {
        this.masterTimeline = gsap.timeline({ autoRemoveChildren: true })
        this.actionTimeline = gsap.timeline({ autoRemoveChildren: true })
        this.finalTimeline = gsap.timeline({ autoRemoveChildren: true })
    }

    afterAnimations(callback: () => void) {
        this.afterAnimationCallbacks.push(callback)
    }

    ensureDuration(duration: number) {
        ensureDuration(this.masterTimeline, duration)
    }

    async play() {
        if (
            this.actionTimeline.getChildren().length === 0 &&
            this.finalTimeline.getChildren().length === 0
        ) {
            return
        }

        this.masterTimeline.add(this.actionTimeline, 0)
        this.masterTimeline.add(this.finalTimeline, this.actionTimeline.duration())

        const animations = this.masterTimeline.getChildren()
        console.log(`Playing ${animations.length} animations for action state change: `, animations)
        await this.masterTimeline.play()
    }

    runAfterAnimations() {
        for (const callback of this.afterAnimationCallbacks) {
            callback()
        }
    }
}

export function ensureDuration(timeline: gsap.core.Timeline, duration: number) {
    timeline.set({}, {}, duration)
}
