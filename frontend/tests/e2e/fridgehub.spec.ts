import { expect, test } from '@playwright/test'

const signIn = async (page: import('@playwright/test').Page, path = '/') => {
  const deviceId = `fridgehub-e2e-device-${test.info().parallelIndex}`
  await page.goto(path)
  await page.evaluate((id) => {
    localStorage.setItem('fridgehub-device-id', id)
    localStorage.setItem('fridgehub-device-name', 'Playwright E2E Browser')
  }, deviceId)
  await page.getByLabel('Username').fill('meera')
  await page.getByLabel('Password').fill('fridgehub')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), Meera/i })).toBeVisible()
}

const addDaysIso = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return value.toISOString().slice(0, 10)
}

test('routes between major workspaces and persists dark mode', async ({ page }) => {
  await signIn(page)

  await expect(page.getByRole('heading', { name: /Home Dashboard/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tasks Open today task board/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Shop Now Open today shopping list/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Plan Meals Open today meal plan/i })).toBeVisible()

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

test('supports multi-select task filters', async ({ page }) => {
  await signIn(page, '/tasks')

  const allDates = page.getByTestId('task-filter-date-all')
  const today = page.getByTestId('task-filter-date-today')
  const week = page.getByTestId('task-filter-date-week')
  await expect(allDates).toHaveAttribute('aria-pressed', 'true')
  await today.click()
  await week.click()
  await expect(today).toHaveAttribute('aria-pressed', 'true')
  await expect(week).toHaveAttribute('aria-pressed', 'true')
  await expect(allDates).toHaveAttribute('aria-pressed', 'false')
  await today.click()
  await week.click()
  await expect(allDates).toHaveAttribute('aria-pressed', 'true')

  const allStatuses = page.getByTestId('task-filter-status-all')
  const pending = page.getByTestId('task-filter-status-pending')
  const inProgress = page.getByTestId('task-filter-status-in_progress')
  await expect(allStatuses).toHaveAttribute('aria-pressed', 'true')
  await pending.click()
  await inProgress.click()
  await expect(pending).toHaveAttribute('aria-pressed', 'true')
  await expect(inProgress).toHaveAttribute('aria-pressed', 'true')
  await expect(allStatuses).toHaveAttribute('aria-pressed', 'false')
  await pending.click()
  await inProgress.click()
  await expect(allStatuses).toHaveAttribute('aria-pressed', 'true')

  const allCategories = page.getByTestId('task-filter-category-all')
  const health = page.getByTestId('task-filter-category-health')
  const school = page.getByTestId('task-filter-category-school')
  await expect(allCategories).toHaveText('All Catagories')
  await health.click()
  await school.click()
  await expect(health).toHaveAttribute('aria-pressed', 'true')
  await expect(school).toHaveAttribute('aria-pressed', 'true')
  await health.click()
  await school.click()
  await expect(allCategories).toHaveAttribute('aria-pressed', 'true')

  const everyone = page.getByTestId('task-filter-assignee-all')
  const meera = page.getByTestId('task-filter-assignee-1')
  const dad = page.getByTestId('task-filter-assignee-2')
  await meera.click()
  await dad.click()
  await expect(meera).toHaveAttribute('aria-pressed', 'true')
  await expect(dad).toHaveAttribute('aria-pressed', 'true')
  await expect(everyone).toHaveAttribute('aria-pressed', 'false')
  await meera.click()
  await dad.click()
  await expect(everyone).toHaveAttribute('aria-pressed', 'true')
})

test('edits task details and recurrence from the dialog', async ({ page }) => {
  const taskTitle = `E2E Edited Task ${Date.now()}`

  await signIn(page, '/tasks')

  const firstTask = page.locator('[data-testid^="task-card-"]').first()
  await expect(firstTask).toBeVisible()
  await firstTask.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Edit task rule')).toBeVisible()
  await dialog.getByLabel('Title').fill(taskTitle)
  await dialog.getByLabel('Status').selectOption('in_progress')
  await dialog.getByTestId('task-edit-repeat').selectOption('weekly')
  await dialog.getByTestId('task-edit-interval').fill('2')
  await dialog.getByRole('button', { name: /^Save task$/i }).click()

  await expect(page.getByText('Task updated')).toBeVisible()
  await expect(page.getByRole('heading', { name: taskTitle })).toBeVisible()
  await expect(page.getByText('Every 2 weeks').first()).toBeVisible()
})

test('supports partial grocery shopping updates', async ({ page }) => {
  await signIn(page, '/groceries')

  await page.getByRole('button', { name: /Shopping Lists/i }).click()
  await expect(page.getByRole('heading', { name: /Shopping List Planner/i })).toBeVisible()
  const statusDropdown = page.locator('details').filter({ hasText: /Open only/ }).first()
  await expect(statusDropdown.locator('summary')).toBeVisible()
  await statusDropdown.locator('summary').click()
  await statusDropdown.getByRole('checkbox', { name: 'Done only', exact: true }).check()
  await page.getByLabel('Budget target').fill('125')
  await page.getByRole('button', { name: /Build now/i }).click()

  const boughtInput = page.getByLabel('Bought').first()
  await expect(boughtInput).toBeVisible()
  await expect(page.getByLabel(/Unit budget/i).first()).toBeVisible()
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

  await page.getByLabel('Email').fill(`invite-${Date.now()}@fridgehub.local`)
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

test('edits a meal from the dialog with an effective scope', async ({ page }) => {
  const mealName = `Scoped Dialog Meal ${Date.now()}`

  await signIn(page, '/meals')

  await expect(page.getByRole('heading', { name: /Weekly Meal Plan/i })).toBeVisible()
  await page.getByRole('button', { name: /^Open .* details$/i }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Change scope')).toBeVisible()
  await dialog.getByLabel('Meal name').fill(mealName)
  await dialog.getByLabel('Meal audience').selectOption('group')
  const memberPicker = dialog.locator('[aria-label="Selected meal members"]')
  await expect(memberPicker).toBeVisible()
  await expect(memberPicker.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await memberPicker.getByRole('button').nth(1).click()
  await expect(memberPicker.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByLabel('Change scope').selectOption('weekly')
  const effectiveUntil = dialog.getByLabel('Effective until')
  const selectedDate = await effectiveUntil.getAttribute('min')
  expect(selectedDate).toBeTruthy()
  await effectiveUntil.fill(addDaysIso(selectedDate!, 7))
  await dialog.getByRole('button', { name: /^Save change$/i }).click()

  await expect(page.getByText('Meal updated')).toBeVisible()
  await page.getByRole('button', { name: /^Open .* details$/i }).first().click()
  const updatedDialog = page.getByRole('dialog')
  await expect(updatedDialog.getByText(mealName)).toBeVisible()
  await expect(updatedDialog.getByText(/Group:/)).toBeVisible()
})
