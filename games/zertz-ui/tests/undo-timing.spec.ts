import { expect, test, type Page } from '@playwright/test'
import type { ZertzGameSession } from '../src/lib/model/session.svelte.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s. Each AnimationContext the presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        zertzSession: ZertzGameSession
        steps: Step[]
    }
}

const ACTIONLESS_BUDGET = 0.2

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function openScenario(page: Page, name: string) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.zertzSession = getContext();')
        })
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.zertzSession)).toBe(true)
    await settle(page)
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.zertzSession, 'presenter')
        const deps = Reflect.get(presenter, 'deps')
        const create = deps.createAnimationContext
        deps.createAnimationContext = () => {
            const context = create()
            const step: Step = { kind: '', action: '', end: 0 }
            window.steps.push(step)
            const play = context.play.bind(context)
            context.play = async () => {
                const children: { startTime(): number; duration(): number }[] =
                    context.actionTimeline.getChildren(false)
                step.end = Math.max(0, ...children.map((c) => c.startTime() + c.duration()))
                return play()
            }
            context.step = step
            return context
        }
        window.zertzSession.addGameStateChangeListener(
            async ({ kind, action, animationContext }) => {
                const step: Step = Reflect.get(animationContext, 'step')
                step.kind = kind
                step.action = action?.type ?? '-'
            }
        )
    })
}

async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.zertzSession.updatingVisibleState))
        .toBe(false)
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

// Places a white marble on a vacant ring away from the corner, then removes B2, cutting the
// corner pair off: they are claimed.
async function placeAndCutOff(page: Page) {
    await act(page, async () => {
        const session = window.zertzSession
        session.chooseColor(session.placeableColors[0])
        const ring = session.placementRings.find((coords) => coords.q === 0 && coords.r === 0)
        if (ring === undefined) throw Error('The centre ring is not vacant')
        await session.chooseRing(ring)
    })
    await page.getByRole('button', { name: 'remove B2' }).press('Enter')
    await settle(page)
}

// As another player's client sees an Undo: no move of this session's is being undone.
async function undoAsOtherPlayer(page: Page) {
    await page.evaluate(() => {
        const session = window.zertzSession
        session.willUndo = () => {
            session.undoingMove = undefined
        }
    })
    await act(page, () => window.zertzSession.undo())
}

// Jumps the white on D4 over the grey to F2, then over the black to F4.
async function captureChain(page: Page) {
    for (const [jumper, landing] of [
        ['jumper D4', 'land F2'],
        [undefined, 'land F4']
    ]) {
        if (jumper) await page.getByRole('button', { name: jumper }).press('Enter')
        await page.getByRole('button', { name: landing }).press('Enter')
        await settle(page)
    }
}

async function expectActionlessWithinBudget(page: Page) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.length).toBeGreaterThan(0)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

test('your own Undo of a placement that cut a group off', async ({ page }) => {
    await openScenario(page, 'Claim by ring removal')
    await placeAndCutOff(page)
    await act(page, () => window.zertzSession.undo())
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a placement that cut a group off", async ({ page }) => {
    await openScenario(page, 'Claim by ring removal')
    await placeAndCutOff(page)
    await undoAsOtherPlayer(page)
    await expectActionlessWithinBudget(page)
})

test('Undo of each jump of a chain', async ({ page }) => {
    await openScenario(page, 'Capture chain')
    await captureChain(page)
    await act(page, () => window.zertzSession.undo())
    await act(page, () => window.zertzSession.undo())
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward', async ({ page }) => {
    await openScenario(page, 'Claim by ring removal')
    await placeAndCutOff(page)
    await act(page, () => window.zertzSession.history.goToPreviousAction())
    await act(page, () => window.zertzSession.history.goToNextAction())
    await expectActionlessWithinBudget(page)
})
