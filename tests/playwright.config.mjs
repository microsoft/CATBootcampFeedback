import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:8765',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npx --yes http-server .. -p 8765 -c-1 --silent',
        port: 8765,
        timeout: 15_000,
        reuseExistingServer: !process.env.CI
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } }
    ]
});
