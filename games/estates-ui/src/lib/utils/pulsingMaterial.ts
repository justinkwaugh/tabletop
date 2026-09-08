import { MeshBasicMaterial } from 'three'
import { gsap } from 'gsap'

export class PulsingMaterial extends MeshBasicMaterial {
    private enabled = false
    private readonly pulse: gsap.core.Timeline
    private exitTween?: gsap.core.Tween

    constructor(
        private readonly invalidate: () => void,
        minimumOpacity: number
    ) {
        super({ color: 'white', transparent: true, opacity: 0, depthWrite: false, visible: false })
        this.pulse = gsap.timeline({ paused: true, onUpdate: invalidate })
        this.pulse.to(this, { opacity: 1, duration: 0.6, ease: 'power1.in' }, 0)
        this.pulse.to(
            this,
            {
                opacity: minimumOpacity,
                duration: 1.2,
                ease: 'power1.inOut',
                repeat: -1,
                yoyo: true
            },
            0.6
        )
    }

    get active(): boolean {
        return this.enabled
    }

    set active(value: boolean) {
        if (value === this.enabled) return
        this.enabled = value
        this.exitTween?.kill()
        if (value) {
            this.visible = true
            this.pulse.restart()
        } else {
            this.pulse.pause()
            this.exitTween = gsap.to(this, {
                opacity: 0,
                duration: 0.2,
                onUpdate: this.invalidate,
                onComplete: () => {
                    this.visible = false
                    this.invalidate()
                }
            })
        }
    }

    override dispose(): void {
        this.pulse.kill()
        this.exitTween?.kill()
        super.dispose()
    }
}
