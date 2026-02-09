import puppeteer from 'puppeteer';

(async () => {
  console.log("👻 Ghost Protocol Initiated...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  // REPLACE WITH YOUR REAL VERCEL URL
  const TARGET_URL = 'https://hakoware.vercel.app/?mode=admin'; 
  
  console.log(`Visiting: ${TARGET_URL}`);
  await page.goto(TARGET_URL);

  // --- 🔓 THE LOCKPICKING SECTION ---
  try {
      console.log("🔒 Lock screen detected. Entering PIN...");
      
      // 1. Wait for the password input to appear
      await page.waitForSelector('input[type="password"]', { timeout: 5000 });
      
      // 2. Type the PIN (Must match the one in AdminLock.jsx)
      await page.type('input[type="password"]', '685160');
      
      // 3. Press Enter (or find the button)
      await page.keyboard.press('Enter');
      
      // Short pause to let the Admin Panel load
      await new Promise(r => setTimeout(r, 2000));
      console.log("🔓 Access Granted. Admin Panel Loaded.");
      
  } catch (e) {
      console.log("⚠️ No lock screen found (or already unlocked). Continuing...");
  }
  // ----------------------------------

  // Now the "Wake Up" protocol runs automatically because the panel is open
  console.log("⏳ Waiting 60 seconds for auto-emails to fire...");
  await new Promise(r => setTimeout(r, 60000));

  console.log("👻 Mission Accomplished.");
  await browser.close();
})();
