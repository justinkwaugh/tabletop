import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { isMergeCompanies, type HydratedIndonesiaGameState } from '@tabletop/indonesia'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import { playerCompanyCardsForState } from '$lib/utils/playerCompanyCards.js'

const CARD_FLIGHT_DURATION = 0.5
const TARGET_POP_DURATION = 0.2
const TARGET_SETTLE_DURATION = 0.14
const TARGET_INITIAL_SCALE = 0.72
const TARGET_OVERSHOOT_SCALE = 1.08

type FixedClone = {
    wrapper: HTMLElement
    element: HTMLElement
    rect: DOMRect
    restoreSourceVisibility: () => void
}

function intersectRects(left: DOMRect, right: DOMRect): DOMRect | null {
    const x = Math.max(left.left, right.left)
    const y = Math.max(left.top, right.top)
    const maxX = Math.min(left.right, right.right)
    const maxY = Math.min(left.bottom, right.bottom)
    const width = maxX - x
    const height = maxY - y
    if (width <= 0 || height <= 0) {
        return null
    }
    return new DOMRect(x, y, width, height)
}

function clipsDescendants(element: HTMLElement): boolean {
    const style = getComputedStyle(element)
    const overflowValues = [style.overflow, style.overflowX, style.overflowY]
    return overflowValues.some((value) => value === 'hidden' || value === 'scroll' || value === 'auto' || value === 'clip')
}

function clipRectForElement(sourceElement: HTMLElement): DOMRect | null {
    let clipRect: DOMRect | null = new DOMRect(0, 0, window.innerWidth, window.innerHeight)
    if (clipRect.width <= 0 || clipRect.height <= 0) {
        return null
    }

    let ancestor = sourceElement.parentElement
    while (ancestor && clipRect) {
        if (clipsDescendants(ancestor)) {
            clipRect = intersectRects(clipRect, ancestor.getBoundingClientRect())
        }
        ancestor = ancestor.parentElement
    }

    return clipRect
}

function createFixedClone(sourceElement: HTMLElement): FixedClone | null {
    const sourceRect = sourceElement.getBoundingClientRect()
    const clipRect = clipRectForElement(sourceElement)
    if (!clipRect) {
        return null
    }

    const wrapper = document.createElement('div')
    wrapper.style.position = 'fixed'
    wrapper.style.left = `${clipRect.left}px`
    wrapper.style.top = `${clipRect.top}px`
    wrapper.style.width = `${clipRect.width}px`
    wrapper.style.height = `${clipRect.height}px`
    wrapper.style.pointerEvents = 'none'
    wrapper.style.overflow = 'hidden'
    wrapper.style.zIndex = '9999'

    const clone = sourceElement.cloneNode(true) as HTMLElement
    clone.style.position = 'absolute'
    clone.style.left = `${sourceRect.left - clipRect.left}px`
    clone.style.top = `${sourceRect.top - clipRect.top}px`
    clone.style.width = `${sourceRect.width}px`
    clone.style.height = `${sourceRect.height}px`
    clone.style.margin = '0'
    clone.style.pointerEvents = 'none'
    clone.style.transformOrigin = 'center center'
    clone.style.willChange = 'transform, opacity'
    wrapper.appendChild(clone)
    document.body.appendChild(wrapper)

    const previousVisibility = sourceElement.style.visibility
    sourceElement.style.visibility = 'hidden'

    return {
        wrapper,
        element: clone,
        rect: sourceRect,
        restoreSourceVisibility: () => {
            sourceElement.style.visibility = previousVisibility
        }
    }
}

function removeFixedClones(clones: readonly FixedClone[]): void {
    for (const clone of clones) {
        clone.restoreSourceVisibility()
        clone.wrapper.remove()
    }
}

export class CompanyMergerAnimator {
    private cardElements = new Map<string, HTMLElement>()
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

    setCardElement(companyId: string, element: HTMLElement): void {
        this.cardElements.set(companyId, element)
    }

    clearCardElement(companyId: string, element: HTMLElement): void {
        if (this.cardElements.get(companyId) !== element) {
            return
        }
        this.cardElements.delete(companyId)
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
        if (!from || !action || typeof document === 'undefined' || !isMergeCompanies(action)) {
            return
        }

        const proposal = action.metadata?.proposal
        if (!proposal) {
            return
        }

        const sourceCompanyIds = [proposal.companyAId, proposal.companyBId]
        const sourceElements = sourceCompanyIds
            .map((companyId) => this.cardElements.get(companyId))
            .filter((element): element is HTMLElement => !!element)
        if (sourceElements.length === 0) {
            return
        }

        const fromCompanyIds = new Set(from.companies.map((company) => company.id))
        const mergedCompany = to.companies.find((company) => !fromCompanyIds.has(company.id))
        if (!mergedCompany) {
            return
        }

        const companyA = from.companies.find((company) => company.id === proposal.companyAId)
        const companyB = from.companies.find((company) => company.id === proposal.companyBId)
        if (!companyA || !companyB) {
            return
        }

        const clones = sourceElements
            .map((element) => createFixedClone(element))
            .filter((clone): clone is FixedClone => !!clone)
        if (clones.length === 0) {
            return
        }
        const affectedPlayerIds = [...new Set([companyA.owner, companyB.owner, mergedCompany.owner])]
        this.gameSession.rememberCompanyMergeAnimation(
            action.id,
            affectedPlayerIds.map((playerId) => ({
                playerId,
                cards: playerCompanyCardsForState(to, playerId)
            }))
        )

        await tick()

        const targetElement = this.cardElements.get(mergedCompany.id)
        if (!targetElement) {
            removeFixedClones(clones)
            this.gameSession.clearCompanyMergeAnimation(action.id)
            return
        }

        const targetRect = targetElement.getBoundingClientRect()
        const targetCenterX = targetRect.left + targetRect.width / 2
        const targetCenterY = targetRect.top + targetRect.height / 2

        gsap.set(targetElement, {
            transformOrigin: 'center center',
            opacity: 0,
            scale: TARGET_INITIAL_SCALE
        })

        clones.forEach((clone) => {
            const sourceCenterX = clone.rect.left + clone.rect.width / 2
            const sourceCenterY = clone.rect.top + clone.rect.height / 2
            gsap.set(clone.element, {
                x: 0,
                y: 0,
                scale: 1,
                opacity: 1
            })

            animationContext.actionTimeline.to(
                clone.element,
                {
                    x: targetCenterX - sourceCenterX,
                    y: targetCenterY - sourceCenterY,
                    scale: TARGET_INITIAL_SCALE,
                    opacity: 0,
                    duration: CARD_FLIGHT_DURATION,
                    ease: 'power2.inOut'
                },
                0
            )
        })

        animationContext.actionTimeline.to(
            targetElement,
            {
                opacity: 1,
                scale: TARGET_OVERSHOOT_SCALE,
                duration: TARGET_POP_DURATION,
                ease: 'back.out(2.2)'
            },
            CARD_FLIGHT_DURATION * 0.78
        )

        animationContext.actionTimeline.to(
            targetElement,
            {
                scale: 1,
                duration: TARGET_SETTLE_DURATION,
                ease: 'power2.out'
            },
            CARD_FLIGHT_DURATION * 0.78 + TARGET_POP_DURATION
        )

        animationContext.ensureDuration(0.75)
        animationContext.afterAnimations(() => {
            removeFixedClones(clones)
        })
    }
}

export function attachCompanyMergerAnimator(
    animator: CompanyMergerAnimator
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

export function animateMergedCompanyCard(
    node: HTMLElement,
    params: { animator: CompanyMergerAnimator; companyId: string }
): {
    update: (next: { animator: CompanyMergerAnimator; companyId: string }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentCompanyId = params.companyId
    currentAnimator.setCardElement(currentCompanyId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.companyId === currentCompanyId) {
                return
            }

            currentAnimator.clearCardElement(currentCompanyId, node)
            currentAnimator = next.animator
            currentCompanyId = next.companyId
            currentAnimator.setCardElement(currentCompanyId, node)
        },
        destroy() {
            currentAnimator.clearCardElement(currentCompanyId, node)
        }
    }
}
