import { expect, test } from '@playwright/test'

const signIn = async (page: import('@playwright/test').Page, path = '/') => {
  await page.goto(path)
  await page.evaluate(() => {
    localStorage.setItem('familyhub-device-id', 'familyhub-e2e-shared-device')
    localStorage.setItem('familyhub-device-name', 'Playwright E2E Browser')
  })
  await page.getByLabel('Username').fill('meera')
  await page.getByLabel('Password').fill('familyhub')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), Meera/i })).toBeVisible()
}

test('routes between major workspaces and persists dark mode', async ({ page }) => {
  await signIn(page)

  await expect(page.getByText('Weekly family health')).toBeVisible()
  await expect(page.getByRole('button', { name: /Open history/i })).toBeVisible()

  await page.getByRole('link', { name: /Tasks/i }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: /Tasks & Reminders/i })).toBeVisible()

  await page.getByRole('link', { name: /History/i }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('heading', { name: /Every important change/i })).toBeVisible()

  await page.getByRole('button', { name: /Use dark mode/i }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('supports task reassignment from the board', async ({ page }) => {
  await signIn(page, '/tasks')

  const lanes = page.locator('[data-testid^="member-lane-"]')
  const laneCount = await lanes.count()
  let sourceLaneIndex = 0

  for (let index = 0; index < laneCount; index += 1) {
    if ((await lanes.nth(index).locator('[data-testid^="task-card-"]').count()) > 0) {
      sourceLaneIndex = index
      break
    }
  }

  const sourceLane = lanes.nth(sourceLaneIndex)
  const targetLane = lanes.nth(sourceLaneIndex === 0 ? 1 : 0)
  const firstTask = sourceLane.locator('[data-testid^="task-card-"]').first()

  await expect(firstTask).toBeVisible()
  await expect(targetLane).toBeVisible()
  const taskTitle = await firstTask.getByRole('heading').innerText()
  const targetMemberName = await targetLane.getByRole('heading').first().innerText()

  await firstTask.getByLabel(`Reassign ${taskTitle}`).selectOption({ label: targetMemberName })

  await expect(targetLane.getByRole('heading', { name: taskTitle })).toBeVisible()
})

test('supports partial grocery shopping updates', async ({ page }) => {
  await signIn(page, '/groceries')

  await page.getByRole('button', { name: /Shopping Lists/i }).click()
  await expect(page.getByRole('heading', { name: /Current Shopping Trip/i })).toBeVisible()
  await page.getByRole('button', { name: /Build now/i }).click()

  const boughtInput = page.getByLabel('Bought').first()
  await expect(boughtInput).toBeVisible()
  await boughtInput.fill('0.5')
  await boughtInput.press('Enter')

  await expect(page.getByText('Partial').first()).toBeVisible()
})

test('assistant answers household gap queries', async ({ page }) => {
  await signIn(page, '/assistant')

  await expect(page.getByRole('heading', { name: /Family Assistant/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Attention Queue/i })).toBeVisible()

  await page.getByLabel('Prompt').fill('What gaps or alerts did we miss today?')
  await page.getByRole('button', { name: /^Send$/i }).click()

  await expect(page.getByTestId('assistant-messages').getByText('What gaps or alerts did we miss today?')).toBeVisible()
  await expect(page.getByText(/attention item|no critical|gaps/i).last()).toBeVisible()
})

test('creates signup invite with QR code', async ({ page }) => {
  await signIn(page, '/command-center')

  await page.getByRole('button', { name: /Security/i }).click()
  await expect(page.getByRole('heading', { name: /Signup Invites/i })).toBeVisible()

  await page.getByLabel('Email').fill(`invite-${Date.now()}@familyhub.local`)
  await page.getByRole('button', { name: /^Create$/i }).click()

  await expect(page.getByText('Invite link ready')).toBeVisible()
  await expect(page.getByAltText('Signup invite QR code')).toBeVisible()
  await expect.poll(async () => page.locator('input[readonly]').inputValue()).toContain('invite=')
})

test('manages and applies a weekly meal template row', async ({ page }) => {
  const suffix = Date.now()
  const templateName = `E2E Template ${suffix}`
  const mealName = `E2E Oats ${suffix}`

  await signIn(page, '/meals')

  await expect(page.getByRole('heading', { name: /Weekly Meal Plan/i })).toBeVisible()
  await page.getByRole('button', { name: /Weekly Templates/i }).click()
  const form = page.getByTestId('meal-template-form')
  await form.getByLabel('Template').fill(templateName)
  await form.getByLabel('Day').selectOption('monday')
  await form.getByLabel('Meal type').selectOption('breakfast')
  await form.getByLabel('Meal name').fill(mealName)
  await form.getByLabel('Calories').fill('410')
  await form.getByLabel('Prep time').fill('12')
  await form.getByRole('button', { name: /^Add$/i }).click()

  await expect(page.getByText('Template row saved')).toBeVisible()
  await expect(page.getByText(mealName).first()).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /^Apply template$/i }).click()

  await page.getByRole('button', { name: /Current Plan/i }).click()
  await expect(page.locator('button').filter({ hasText: mealName }).first()).toBeVisible()
})
