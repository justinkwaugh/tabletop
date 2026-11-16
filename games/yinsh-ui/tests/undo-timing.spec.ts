import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s. Each AnimationContext the presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        steps: Step[]
    }
}

const ACTIONLESS_BUDGET = 0.2

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

async function timeSteps(page: Page) {
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.yinshSession, 'presenter')
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
        window.yinshSession.addGameStateChangeListener(
            async ({ kind, action, animationContext }) => {
                const step: Step = Reflect.get(animationContext, 'step')
                step.kind = kind
                step.action = action?.type ?? '-'
            }
        )
    })
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

// Alice's F3 to D1 makes a row; she takes it and the ring on E9.
async function moveTakeAndRemove(page: Page) {
    await press(page, 'ring F3')
    for (const name of ['move to D1', 'row B3', 'remove ring E9']) {
        await press(page, name)
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

test('your own Undo of a ring removal, a row and a move', async ({ page }) => {
    await openScenario(page, 'Form a row')
    await moveTakeAndRemove(page)
    await timeSteps(page)
    for (let i = 0; i < 3; i++) await act(page, () => window.yinshSession.undo())
    expect(await page.evaluate(() => window.yinshSession.restaged)).toBe(true)
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a move", async ({ page }) => {
    await openScenario(page, 'Form a row')
    await press(page, 'ring F3')
    await press(page, 'move to G3')
    await settle(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.yinshSession.willUndo = () => {}
    })
    await act(page, () => window.yinshSession.undo())
    expect(await page.evaluate(() => window.yinshSession.restaged)).toBe(false)
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward, and jumps to either end', async ({ page }) => {
    await openScenario(page, 'Form a row')
    await moveTakeAndRemove(page)
    await timeSteps(page)
    await act(page, () => window.yinshSession.history.goToPreviousAction())
    await act(page, () => window.yinshSession.history.goToNextAction())
    await act(page, () => window.yinshSession.history.goToBeginning())
    await act(page, () => window.yinshSession.history.goToEnd())
    await expectActionlessWithinBudget(page)
})
