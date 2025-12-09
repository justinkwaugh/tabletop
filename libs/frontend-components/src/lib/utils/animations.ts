import { gsap } from 'gsap'

export class AnimationContext {
    private masterTimeline: gsap.core.Timeline
    readonly actionTimeline: gsap.core.Timeline
    readonly finalTimeline: gsap.core.Timeline

    constructor() {
        this.masterTimeline = gsap.timeline({ autoRemoveChildren: true })
        this.actionTimeline = gsap.timeline({ autoRemoveChildren: true })
        this.finalTimeline = gsap.timeline({ autoRemoveChildren: true })
    }

    ensureDuration(duration: number) {
        ensureDuration(this.masterTimeline, duration)
    }

    async play() {
        this.masterTimeline.add(this.actionTimeline, 0)
        this.masterTimeline.add(this.finalTimeline)

        const animations = this.masterTimeline.getChildren()
        if (animations.length === 0) {
            return
        }

        console.log(`Playing ${animations.length} animations for action state change: `, animations)
        await this.masterTimeline.play()
    }
}

export function ensureDuration(timeline: gsap.core.Timeline, duration: number) {
    timeline.set({}, {}, duration)
}
