import base from './playwright.config.js';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export default { ...base, reporter: 'list', projects: [{ name: 'chromium', use: { ...base.projects[0].use, channel: undefined, launchOptions: { executablePath: CHROME } } }] };
