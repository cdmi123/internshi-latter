const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve('Internship Completion Certificate - Prachi Jugalkishoreji Jhawar.pdf').replace(/\\/g, '/');
    console.log('Opening:', filePath);
    await page.goto(filePath);
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    console.log('--- PDF TEXT START ---');
    console.log(text);
    console.log('--- PDF TEXT END ---');
    await browser.close();
})();
