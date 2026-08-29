import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isCancelAlliance } from '@tabletop/lowenherz'
import { allianceWalls, heartPosition } from '$lib/model/allianceGeometry.js'
import { scaled } from '$lib/model/boardMetrics.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * An alliance breaking: every heart along its shared border cracks and throws shards outward, so a
 * long border comes apart along its whole length rather than in one spot.
 *
 * Two things changed in moving this off CSS keyframes and onto the shared timeline.
 *
 * It no longer needs a remembered map of wall positions. The old version kept
 * `lastKnownAllianceWalls`, refreshed after every action, because a cancellation deletes the
 * alliance before the listener runs. But the listener is handed `from` - the state before the action
 * - and the alliance is still in it, so the hearts can simply be read from there.
 *
 * And because the session assigns state only after the timeline finishes, the alliance is still
 * live for the whole burst, hearts and all. `burstingAllianceId` is published so the board can hold
 * those hearts back while their burst plays over them.
 */
type Heart = { id: string; left: number; top: number }

/**
 * Directions the shards fly. Not evenly spaced round the circle - a slightly irregular spray reads
 * as something breaking rather than as a diagram. Lives here rather than in the board because the
 * animator needs each angle to send its shard outward along it.
 */
export const BURST_SHARD_ANGLES = [-72, -28, 14, 58, 104, 152, 196, 250]

const CORE_PEAK = 0.19 // 30% of the old 620ms
const CORE_FADE = 0.43
const SHARD_FLIGHT = 0.62
const SHARD_STAGGER = 0.009

export class AllianceBurstAnimator extends StateAnimator {
    hearts: Heart[] = $state([])
    burstingAllianceId: string | undefined = $state(undefined)

    private cores = new Map<string, HTMLElement>()
    private shards = new Map<string, HTMLElement[]>()

    setCore(heartId: string, element?: HTMLElement) {
        if (element) this.cores.set(heartId, element)
        else this.cores.delete(heartId)
    }

    setShard(heartId: string, index: number, element?: HTMLElement) {
        const list = this.shards.get(heartId) ?? []
        if (element) {
            list[index] = element
            this.shards.set(heartId, list)
        } else {
            this.shards.delete(heartId)
        }
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from) return

        // Cinematic when we are told which alliance ended; otherwise fall back to noticing that one
        // vanished between the two states, which covers plain history navigation at 0.1s. Undo runs
        // the other way (an alliance reappears) and gets no burst, which is correct - nothing broke.
        const allianceId =
            action && isCancelAlliance(action)
                ? (action as unknown as { allianceId: string }).allianceId
                : from.alliances.find((alliance) => !to.alliances.some((a) => a.id === alliance.id))
                      ?.id
        if (!allianceId) return

        const walls = allianceWalls(from, allianceId)
        if (walls.length === 0) return

        const cinematic = !!action
        const scale = cinematic ? 1 : FALLBACK_DURATION / SHARD_FLIGHT

        this.burstingAllianceId = allianceId
        this.hearts = walls.map((wall, i) => ({
            id: `${allianceId}-${wall.col},${wall.row},${wall.edge}-${i}`,
            // The hearts' own maths, so a burst starts exactly where its heart was sitting.
            ...heartPosition(wall)
        }))

        await tick()

        const timeline = animationContext.actionTimeline
        const rise = scaled(30)

        for (const heart of this.hearts) {
            const core = this.cores.get(heart.id)
            if (core) {
                gsap.set(core, { scale: 1, opacity: 1, rotation: 0, transformOrigin: 'center center' })
                timeline.to(
                    core,
                    { scale: 1.55, rotation: -6, duration: CORE_PEAK * scale, ease: 'power2.out' },
                    0
                )
                timeline.to(
                    core,
                    { scale: 0.35, rotation: 8, opacity: 0, duration: CORE_FADE * scale, ease: 'power1.in' },
                    CORE_PEAK * scale
                )
            }

            const shards = this.shards.get(heart.id) ?? []
            shards.forEach((shard, i) => {
                if (!shard) return
                const angle = (BURST_SHARD_ANGLES[i] * Math.PI) / 180
                // Explicit x/y along the angle. The keyframes rotated the shard and then threw it
                // along its own -Y axis, which gsap cannot express: it composes translate before
                // rotate, so a y tween would move every shard the same way.
                gsap.set(shard, { x: 0, y: 0, scale: 0.85, opacity: 0.95, rotation: BURST_SHARD_ANGLES[i] })
                timeline.to(
                    shard,
                    {
                        x: Math.sin(angle) * rise,
                        y: -Math.cos(angle) * rise,
                        scale: 0.3,
                        opacity: 0,
                        duration: SHARD_FLIGHT * scale,
                        ease: 'power2.out'
                    },
                    i * SHARD_STAGGER * scale
                )
            })
        }

        animationContext.afterAnimations(() => {
            this.hearts = []
            this.burstingAllianceId = undefined
        })
    }

    override onDetach() {
        this.hearts = []
        this.burstingAllianceId = undefined
    }
}
