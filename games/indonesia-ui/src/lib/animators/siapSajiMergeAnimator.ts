import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { CompanyType, isMergeCompanies, type HydratedIndonesiaGameState } from '@tabletop/indonesia'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import { mergedCultivatedAreaEntriesForAction } from '$lib/utils/mergedCultivatedAreaEntries.js'

const CULTIVATED_AREA_POP_DURATION = 0.18
const CULTIVATED_AREA_SETTLE_DURATION = 0.12
const INITIAL_CULTIVATED_AREA_SCALE = 0.82
const CULTIVATED_AREA_OVERSHOOT_SCALE = 1.04

export class SiapSajiMergeAnimator {
    private cultivatedAreaElements = new Map<string, HTMLElement | SVGElement>()
    private registered = false
    private readonly onGameStateChangeHandler: ({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) => Promise<void>

    constructor(private gameSession: IndonesiaGameSession) {
        this.onGameStateChangeHandler = this.onGameStateChange.bind(this)
    }

    register(): void {
        if (this.registered) {
            return
        }

        this.gameSession.addGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = true
    }

    unregister(): void {
        if (!this.registered) {
            return
        }

        this.gameSession.removeGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = false
    }

    setCultivatedAreaElement(areaId: string, element: HTMLElement | SVGElement): void {
        this.cultivatedAreaElements.set(areaId, element)
    }

    clearCultivatedAreaElement(areaId: string, element: HTMLElement | SVGElement): void {
        if (this.cultivatedAreaElements.get(areaId) !== element) {
            return
        }
        this.cultivatedAreaElements.delete(areaId)
    }

    private async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from || !action) {
            return
        }
        if (
            !isMergeCompanies(action) ||
            action.metadata?.proposal.companyType !== CompanyType.Production ||
            !action.metadata.proposal.isSiapSaji
        ) {
            return
        }

        const areaEntries = mergedCultivatedAreaEntriesForAction({ from, to, action })
        if (areaEntries.length === 0) {
            return
        }

        this.gameSession.rememberSiapSajiMergeAnimation(action.id, to.actionCount, areaEntries)
        animationContext.ensureDuration(0.75)

        await tick()

        for (const entry of areaEntries) {
            const cultivatedAreaElement = this.cultivatedAreaElements.get(entry.areaId)
            if (!cultivatedAreaElement) {
                continue
            }

            gsap.set(cultivatedAreaElement, {
                transformOrigin: '0px 0px',
                opacity: 0,
                scale: INITIAL_CULTIVATED_AREA_SCALE
            })

            animationContext.actionTimeline.to(
                cultivatedAreaElement,
                {
                    opacity: 1,
                    scale: CULTIVATED_AREA_OVERSHOOT_SCALE,
                    duration: CULTIVATED_AREA_POP_DURATION,
                    ease: 'power2.out'
                },
                0
            )

            animationContext.actionTimeline.to(
                cultivatedAreaElement,
                {
                    scale: 1,
                    duration: CULTIVATED_AREA_SETTLE_DURATION,
                    ease: 'power2.out'
                },
                CULTIVATED_AREA_POP_DURATION
            )
        }
    }
}

export function attachSiapSajiMergeAnimator(
    animator: SiapSajiMergeAnimator
): (element: HTMLElement | SVGElement) => () => void {
    return (_element: HTMLElement | SVGElement) => {
        untrack(() => {
            animator.register()
        })

        return () => {
            animator.unregister()
        }
    }
}

export function animateMergedCultivatedArea(
    node: HTMLElement | SVGElement,
    params: { animator: SiapSajiMergeAnimator; areaId: string }
): {
    update: (next: { animator: SiapSajiMergeAnimator; areaId: string }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentAreaId = params.areaId
    currentAnimator.setCultivatedAreaElement(currentAreaId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.areaId === currentAreaId) {
                return
            }

            currentAnimator.clearCultivatedAreaElement(currentAreaId, node)
            currentAnimator = next.animator
            currentAreaId = next.areaId
            currentAnimator.setCultivatedAreaElement(currentAreaId, node)
        },
        destroy() {
            currentAnimator.clearCultivatedAreaElement(currentAreaId, node)
        }
    }
}
