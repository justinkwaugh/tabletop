import { getContext, setContext } from 'svelte'
import type { StartCompanyAnimator } from '$lib/animators/startCompanyAnimator.js'

const START_COMPANY_ANIMATOR_CONTEXT = Symbol('indonesia-start-company-animator')

export function setStartCompanyAnimatorContext(animator: StartCompanyAnimator): StartCompanyAnimator {
    setContext(START_COMPANY_ANIMATOR_CONTEXT, animator)
    return animator
}

export function getStartCompanyAnimatorContext(): StartCompanyAnimator {
    const animator = getContext<StartCompanyAnimator>(START_COMPANY_ANIMATOR_CONTEXT)
    if (!animator) {
        throw new Error('StartCompanyAnimator context not found')
    }
    return animator
}
