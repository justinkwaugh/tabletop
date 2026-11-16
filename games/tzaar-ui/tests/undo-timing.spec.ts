import { expect, test, type Page } from '@playwright/test'
import { captureD2, expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// A step without an action (Undo, another player's Undo, a history step, entering or leaving an
// exploration) must finish its motion within 0.2 s. Each AnimationContext the presenter makes
// records when its motion ends.

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
        const presenter = Reflect.get(window.tzaarSession, 'presenter')
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
        window.tzaarSession.addGameStateChangeListener(
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

// Every step without an action ends in time, and at least `moving` of them move something.
async function expectActionlessWithinBudget(page: Page, moving = 1) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.filter((step) => step.end > 0).length).toBeGreaterThanOrEqual(moving)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

// Tall stacks: Alice captures F2 with F1, then stacks D2 onto D3, ending her turn.
async function captureAndStack(page: Page) {
    await press(page, 'move F1')
    await press(page, 'capture F2')
    await settle(page)
    await press(page, 'move D2')
    await press(page, 'stack onto D3')
    await settle(page)
}

test('your own Undo of a stacking and of the capture before it', async ({ page }) => {
    await openScenario(page, 'Tall stacks')
    await captureAndStack(page)
    await timeSteps(page)
    await act(page, () => window.tzaarSession.undo())
    expect(await page.evaluate(() => window.tzaarSession.chosenFrom)).toBeDefined()
    await act(page, () => window.tzaarSession.undo())
    await act(page, () => window.tzaarSession.undo())
    expect(await page.evaluate(() => window.tzaarSession.chosenFrom)).toBeDefined()
    expect(await page.evaluate(() => window.tzaarSession.gameState.actionCount)).toBe(0)
    await expectActionlessWithinBudget(page, 2)
})

test("another player's Undo of a capture", async ({ page }) => {
    await openScenario(page, 'Two tzaars left')
    await captureD2(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.tzaarSession.willUndo = () => {}
    })
    await act(page, () => window.tzaarSession.undo())
    expect(await page.evaluate(() => window.tzaarSession.chosenFrom)).toBeUndefined()
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward, and jumps to either end', async ({ page }) => {
    await openScenario(page, 'Tall stacks')
    await captureAndStack(page)
    await timeSteps(page)
    await act(page, () => window.tzaarSession.history.goToPreviousAction())
    await act(page, () => window.tzaarSession.history.goToPreviousAction())
    await act(page, () => window.tzaarSession.history.goToNextAction())
    await act(page, () => window.tzaarSession.history.goToEnd())
    await act(page, () => window.tzaarSession.history.goToBeginning())
    await act(page, () => window.tzaarSession.history.goToEnd())
    await expectActionlessWithinBudget(page, 6)
})

test('entering an exploration, and leaving it after a capture', async ({ page }) => {
    await openScenario(page, 'Two tzaars left')
    await captureD2(page)
    await timeSteps(page)
    await act(page, () => window.tzaarSession.startExploring())
    await press(page, 'move F1')
    await press(page, 'capture F2')
    await settle(page)
    await act(page, () => window.tzaarSession.explorations.endExploring())
    expect(await page.evaluate(() => window.tzaarSession.isExploring)).toBe(false)
    await expectActionlessWithinBudget(page)
})
