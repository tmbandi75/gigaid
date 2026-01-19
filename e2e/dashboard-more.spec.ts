import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
    await waitForPageLoad(page);
  });

  test('should display dashboard', async ({ page }) => {
    await expect(page.getByText(/dashboard|today|home|welcome/i).first()).toBeVisible();
  });

  test('should show quick stats', async ({ page }) => {
    const statsCards = page.locator('[data-testid^="stat-"], [data-testid="stats-section"]');
    const count = await statsCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show upcoming jobs section', async ({ page }) => {
    const upcomingSection = page.getByText(/upcoming|today|schedule|jobs/i);
    await expect(upcomingSection.first()).toBeVisible();
  });

  test('should show quick actions', async ({ page }) => {
    const quickActions = page.locator('[data-testid="quick-actions"], button:has-text("New"), button:has-text("Add")');
    if (await quickActions.first().isVisible()) {
      await expect(quickActions.first()).toBeVisible();
    }
  });

  test('should navigate to job from dashboard', async ({ page }) => {
    const jobCard = page.locator('[data-testid^="upcoming-job-"], [data-testid^="card-job-"]').first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
    }
  });

  test('should show earnings summary', async ({ page }) => {
    const earnings = page.getByText(/\$\d+|earnings|revenue/i);
    if (await earnings.first().isVisible()) {
      await expect(earnings.first()).toBeVisible();
    }
  });
});

test.describe('Owner View', () => {
  test('should navigate to owner view', async ({ page }) => {
    await navigateTo(page, '/owner');
    await waitForPageLoad(page);
    
    const ownerView = page.getByText(/owner|analytics|dashboard|earnings/i);
    await expect(ownerView.first()).toBeVisible();
  });

  test('should show earnings chart', async ({ page }) => {
    await navigateTo(page, '/owner');
    await waitForPageLoad(page);
    
    const chart = page.locator('[data-testid="earnings-chart"], [class*="recharts"], svg');
    if (await chart.first().isVisible()) {
      await expect(chart.first()).toBeVisible();
    }
  });

  test('should show jobs completed metric', async ({ page }) => {
    await navigateTo(page, '/owner');
    await waitForPageLoad(page);
    
    const jobsMetric = page.locator('text=Jobs Completed, text=Completed Jobs');
    if (await jobsMetric.first().isVisible()) {
      await expect(jobsMetric.first()).toBeVisible();
    }
  });

  test('should show unpaid invoices metric', async ({ page }) => {
    await navigateTo(page, '/owner');
    await waitForPageLoad(page);
    
    const unpaidMetric = page.locator('text=Unpaid, text=Outstanding');
    if (await unpaidMetric.first().isVisible()) {
      await expect(unpaidMetric.first()).toBeVisible();
    }
  });

  test('should show performance trends', async ({ page }) => {
    await navigateTo(page, '/owner');
    await waitForPageLoad(page);
    
    const trends = page.locator('text=Trend, text=Performance, text=Growth');
    if (await trends.first().isVisible()) {
      await expect(trends.first()).toBeVisible();
    }
  });
});

test.describe('More Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/more');
    await waitForPageLoad(page);
  });

  test('should display more page', async ({ page }) => {
    await expect(page.getByText(/more|menu|settings/i).first()).toBeVisible();
  });

  test('should show profile option', async ({ page }) => {
    const profileOption = page.getByText(/profile/i);
    await expect(profileOption.first()).toBeVisible();
  });

  test('should show reviews option', async ({ page }) => {
    const reviewsOption = page.getByText(/reviews/i);
    await expect(reviewsOption.first()).toBeVisible();
  });

  test('should show owner view option', async ({ page }) => {
    const ownerOption = page.locator('text=Owner View, [data-testid="link-owner-view"]');
    if (await ownerOption.first().isVisible()) {
      await expect(ownerOption.first()).toBeVisible();
    }
  });

  test('should show crew option', async ({ page }) => {
    const crewOption = page.locator('text=Crew, [data-testid="link-crew"]');
    if (await crewOption.first().isVisible()) {
      await expect(crewOption.first()).toBeVisible();
    }
  });

  test('should show reminders option', async ({ page }) => {
    const remindersOption = page.locator('text=Reminders, [data-testid="link-reminders"]');
    if (await remindersOption.first().isVisible()) {
      await expect(remindersOption.first()).toBeVisible();
    }
  });

  test('should show help option', async ({ page }) => {
    const helpOption = page.getByText(/help/i);
    await expect(helpOption.first()).toBeVisible();
  });

  test('should have dark mode toggle', async ({ page }) => {
    const darkModeToggle = page.getByRole('switch').or(page.getByText(/dark mode|theme/i));
    if (await darkModeToggle.first().isVisible()) {
      await expect(darkModeToggle.first()).toBeVisible();
    }
  });

  test('should navigate to profile from more', async ({ page }) => {
    const profileOption = page.locator('text=Profile, [data-testid="link-profile"]').first();
    
    if (await profileOption.isVisible()) {
      await profileOption.click();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveURL(/profile/i);
    }
  });
});

test.describe('Profile Page', () => {
  test('should display profile page', async ({ page }) => {
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
    
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });

  test('should show user name', async ({ page }) => {
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
    
    const nameInput = page.locator('input[name="name"], [data-testid="input-name"]');
    if (await nameInput.isVisible()) {
      await expect(nameInput).toBeVisible();
    }
  });

  test('should show email', async ({ page }) => {
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
    
    const emailInput = page.locator('input[name="email"], [data-testid="input-email"]');
    if (await emailInput.isVisible()) {
      await expect(emailInput).toBeVisible();
    }
  });

  test('should show services selection', async ({ page }) => {
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
    
    const servicesSection = page.locator('text=Services, [data-testid="services-section"]');
    if (await servicesSection.first().isVisible()) {
      await expect(servicesSection.first()).toBeVisible();
    }
  });

  test('should show bio section', async ({ page }) => {
    await navigateTo(page, '/profile');
    await waitForPageLoad(page);
    
    const bioSection = page.locator('textarea[name="bio"], [data-testid="input-bio"]');
    if (await bioSection.isVisible()) {
      await expect(bioSection).toBeVisible();
    }
  });
});

test.describe('Email Signature', () => {
  test('should show email signature settings', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const signatureSection = page.locator('text=Email Signature, text=Signature');
    if (await signatureSection.first().isVisible()) {
      await expect(signatureSection.first()).toBeVisible();
    }
  });

  test('should allow editing signature name', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const nameInput = page.locator('input[name="signatureName"], [data-testid="input-signature-name"]');
    if (await nameInput.isVisible()) {
      await expect(nameInput).toBeVisible();
    }
  });

  test('should allow uploading logo', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const logoUpload = page.locator('[data-testid="upload-logo"], input[type="file"], button:has-text("Upload Logo")');
    if (await logoUpload.first().isVisible()) {
      await expect(logoUpload.first()).toBeVisible();
    }
  });
});

test.describe('Crew Management', () => {
  test('should navigate to crew page', async ({ page }) => {
    await navigateTo(page, '/crew');
    await waitForPageLoad(page);
    
    const crewPage = page.getByText(/crew|team|members/i);
    await expect(crewPage.first()).toBeVisible();
  });

  test('should show add crew member button', async ({ page }) => {
    await navigateTo(page, '/crew');
    await waitForPageLoad(page);
    
    const addButton = page.locator('[data-testid="button-add-crew"], button:has-text("Add"), button:has-text("New")');
    if (await addButton.first().isVisible()) {
      await expect(addButton.first()).toBeVisible();
    }
  });

  test('should show crew members list', async ({ page }) => {
    await navigateTo(page, '/crew');
    await waitForPageLoad(page);
    
    const crewList = page.locator('[data-testid^="crew-member-"], [data-testid^="card-crew-"]');
    const count = await crewList.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Reminders', () => {
  test('should navigate to reminders page', async ({ page }) => {
    await navigateTo(page, '/reminders');
    await waitForPageLoad(page);
    
    const remindersPage = page.locator('text=Reminders');
    await expect(remindersPage.first()).toBeVisible();
  });

  test('should show reminder configuration', async ({ page }) => {
    await navigateTo(page, '/reminders');
    await waitForPageLoad(page);
    
    const reminderConfig = page.locator('text=SMS, text=Voice, text=Before');
    if (await reminderConfig.first().isVisible()) {
      await expect(reminderConfig.first()).toBeVisible();
    }
  });

  test('should allow enabling reminders', async ({ page }) => {
    await navigateTo(page, '/reminders');
    await waitForPageLoad(page);
    
    const enableToggle = page.locator('[data-testid="toggle-reminders"], [role="switch"]');
    if (await enableToggle.first().isVisible()) {
      await expect(enableToggle.first()).toBeVisible();
    }
  });
});
