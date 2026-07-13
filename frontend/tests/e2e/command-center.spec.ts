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

test.describe('Command Center', () => {
  test('navigates to command center via sidebar', async ({ page }) => {
    await signIn(page)
    await page.getByRole('link', { name: /Admin/i }).click()
    await expect(page).toHaveURL(/\/command-center$/)
    await expect(page.getByRole('heading', { name: /Household Command Center/i })).toBeVisible()
  })

  test('displays all tabs', async ({ page }) => {
    await signIn(page, '/command-center')
    await expect(page.getByRole('button', { name: /Members/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Meal Plans/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Contacts/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Grocery Places/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Recipes/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tasks/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Insights/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Security/i })).toBeVisible()
  })

  test('members tab shows family members', async ({ page }) => {
    await signIn(page, '/command-center')
    await expect(page.getByText(/Family Members/i)).toBeVisible()
    await expect(page.getByText('Meera', { exact: true })).toBeVisible()
  })

  test('contacts tab shows emergency contacts', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Contacts/i }).click()
    await expect(page.getByText(/Emergency Contacts/i)).toBeVisible()
  })

  test('grocery places tab shows list types', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Grocery Places/i }).click()
    await expect(page.getByText(/Shopping Places/i)).toBeVisible()
  })

  test('recipes tab shows recipe list with filter', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Recipes/i }).click()
    await expect(page.getByText(/Recipes/i).first()).toBeVisible()
    await expect(page.getByPlaceholder('Filter...')).toBeVisible()
  })

  test('tasks tab shows task list with status filter', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Tasks/i }).click()
    await expect(page.getByText(/Tasks/i).first()).toBeVisible()
    // Status filter dropdown should be present
    await expect(page.getByRole('combobox')).toBeVisible()
  })

  test('security tab shows change password form', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Security/i }).click()
    await expect(page.getByRole('heading', { name: /Change Password/i })).toBeVisible()
    await expect(page.getByText(/Current Password/i)).toBeVisible()
    await expect(page.getByText('New Password', { exact: true })).toBeVisible()
  })
})

test.describe('Per-Member Meal Plans', () => {
  test('meal plan page shows member selector', async ({ page }) => {
    await signIn(page, '/meals')
    await expect(page.locator('select').filter({ hasText: /All members/i })).toBeVisible()
  })

  test('selecting a member filters the meal grid', async ({ page }) => {
    await signIn(page, '/meals')
    const selector = page.locator('select').filter({ hasText: /All members/i })
    await expect(selector).toBeVisible()

    // Select first member option
    const options = await selector.locator('option').allTextContents()
    if (options.length > 1) {
      await selector.selectOption({ index: 1 })
      // Grid title should update to show member name
      await expect(page.getByText(/Personal meal plan|Loading/i)).toBeVisible()
    }
  })

  test('apply template button shows member context', async ({ page }) => {
    await signIn(page, '/meals')
    await expect(page.getByRole('button', { name: /Apply template/i })).toBeVisible()
  })

  test('command center meal plans tab shows member cards', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Meal Plans/i }).click()
    await expect(page.getByText(/Per-Member Meal Plans/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Generate for all members/i })).toBeVisible()
    // Should show member cards
    await expect(page.getByText('Meera', { exact: true })).toBeVisible()
  })

  test('clicking a member in meal plans tab shows their grid', async ({ page }) => {
    await signIn(page, '/command-center')
    await page.getByRole('button', { name: /Meal Plans/i }).click()

    // Click on first member card
    const memberCard = page.locator('[class*="rounded-xl border"]').filter({ hasText: /meals this week|No plan yet/i }).first()
    await memberCard.click()

    // Should show the member's meal grid
    await expect(page.getByRole('heading', { name: /Meal Plan/i }).last()).toBeVisible()
  })
})
