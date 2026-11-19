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
        const presenter = Reflect.get(window.ySession, 'presenter')
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
        window.ySession.addGameStateChangeListener(async ({ kind, action, animationContext }) => {
            const step: Step = Reflect.get(animationContext, 'step')
            step.kind = kind
            step.action = action?.type ?? '-'
        })
    })
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

async function expectActionlessWithinBudget(page: Page) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.length).toBeGreaterThan(0)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

test('your own Undo of a placement', async ({ page }) => {
    await openScenario(page, 'Swap or place')
    await press(page, 'place on F5')
    await settle(page)
    await timeSteps(page)
    await act(page, () => window.ySession.undo())
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a placement", async ({ page }) => {
    await openScenario(page, 'Swap or place')
    await press(page, 'place on F5')
    await settle(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.ySession.willUndo = () => {}
    })
    await act(page, () => window.ySession.undo())
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward, and jumps to either end, ringing the winning chain', async ({
    page
}) => {
    await openScenario(page, 'One from a y')
    await act(page, () => window.ySession.placeStone('C1'))
    expect(await page.evaluate(() => window.ySession.gameState.winningPlayerIds)).toHaveLength(1)
    await timeSteps(page)
    await act(page, () => window.ySession.history.goToPreviousAction())
    await act(page, () => window.ySession.history.goToNextAction())
    await act(page, () => window.ySession.history.goToBeginning())
    await act(page, () => window.ySession.history.goToEnd())
    await expectActionlessWithinBudget(page)
})
