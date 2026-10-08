import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    isExpelRaider,
    isMoveGuildMaster,
    isSail,
    type HydratedKoggeGameState
} from '@tabletop/kogge'
import { gsap } from 'gsap'
import type { Attachment } from 'svelte/attachments'
import { cogPosition, guildMasterPosition } from '$lib/utils/fleet.js'
import { laneBetween, pointAlong } from '$lib/utils/lanes.js'

const SAIL_SECONDS = 1.1
const GUILD_MASTER_STEP_SECONDS = 0.45
const FAST_SECONDS = 0.2
const GUILD_MASTER_KEY = 'guild-master'

interface Voyage {
    from: number
    to: number
}

// Cogs sail their lane and the guild master walks from city to city. Each piece's world
// position comes from the session's fleet state; this animator only moves an inner offset
// node, then hands over to the new state once the motion is done.
export class FleetAnimator {
    private elements = new Map<string, SVGGElement>()

    constructor(private settle: (state: HydratedKoggeGameState) => void) {}

    attachCog(playerId: string): Attachment<SVGGElement> {
        return this.attach(playerId)
    }

    attachGuildMaster(): Attachment<SVGGElement> {
        return this.attach(GUILD_MASTER_KEY)
    }

    private attach(key: string): Attachment<SVGGElement> {
        return (node) => {
            this.elements.set(key, node)
            return () => {
                if (this.elements.get(key) === node) {
                    this.elements.delete(key)
                }
            }
        }
    }

    onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedKoggeGameState
        to: HydratedKoggeGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        animationContext.afterAnimations(() => {
            for (const element of this.elements.values()) {
                gsap.set(element, { x: 0, y: 0, rotation: 0 })
            }
            this.settle(to)
        })
        if (!from) {
            return
        }
        for (const player of to.players) {
            this.moveCog(player.playerId, from, to, action, animationContext)
        }
        this.moveGuildMaster(from, to, action, animationContext)
    }

    private moveCog(
        playerId: string,
        from: HydratedKoggeGameState,
        to: HydratedKoggeGameState,
        action: GameAction | undefined,
        animationContext: AnimationContext
    ) {
        const element = this.elements.get(playerId)
        const start = cogPosition(from, playerId)
        const end = cogPosition(to, playerId)
        if (!element || !start || !end || (start.x === end.x && start.y === end.y)) {
            return
        }
        const voyage = action ? voyageOf(action, playerId) : undefined
        const timeline = animationContext.actionTimeline
        if (!voyage) {
            timeline.to(
                element,
                {
                    x: end.x - start.x,
                    y: end.y - start.y,
                    duration: FAST_SECONDS,
                    ease: 'power1.out'
                },
                0
            )
            return
        }
        const lane = laneBetween(voyage.from, voyage.to)
        const control = {
            x: lane.control.x + (start.x - lane.start.x + end.x - lane.end.x) / 2,
            y: lane.control.y + (start.y - lane.start.y + end.y - lane.end.y) / 2
        }
        const clock = { t: 0 }
        timeline.to(
            clock,
            {
                t: 1,
                duration: SAIL_SECONDS,
                ease: 'sine.inOut',
                onUpdate: () => {
                    const point = pointAlong({ start, control, end }, clock.t)
                    gsap.set(element, {
                        x: point.x - start.x,
                        y: point.y - start.y,
                        rotation: Math.sin(clock.t * Math.PI * 4) * 3
                    })
                }
            },
            0
        )
    }

    private moveGuildMaster(
        from: HydratedKoggeGameState,
        to: HydratedKoggeGameState,
        action: GameAction | undefined,
        animationContext: AnimationContext
    ) {
        const element = this.elements.get(GUILD_MASTER_KEY)
        if (!element || from.guildMaster.city === to.guildMaster.city) {
            return
        }
        const start = guildMasterPosition(from.guildMaster.city)
        const stops = action && isMoveGuildMaster(action) ? (action.metadata?.stops ?? []) : []
        const path = stops.length > 0 ? stops : [to.guildMaster.city]
        const duration = action ? GUILD_MASTER_STEP_SECONDS : FAST_SECONDS / path.length
        path.forEach((city, index) => {
            const point = guildMasterPosition(city)
            animationContext.actionTimeline.to(
                element,
                { x: point.x - start.x, y: point.y - start.y, duration, ease: 'power2.inOut' },
                index * duration
            )
        })
    }
}

function voyageOf(action: GameAction, playerId: string): Voyage | undefined {
    if (
        isSail(action) &&
        action.playerId === playerId &&
        action.metadata &&
        !action.metadata.blocked
    ) {
        return { from: action.metadata.from, to: action.metadata.destination }
    }
    if (
        isExpelRaider(action) &&
        action.metadata?.raiderId === playerId &&
        action.metadata.destination !== undefined &&
        !action.metadata.blocked
    ) {
        return { from: action.metadata.from, to: action.metadata.destination }
    }
    return undefined
}
