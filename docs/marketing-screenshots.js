const { chromium } = require('playwright');
const B = 'http://localhost:3000', OUT = '/home/user/hiremark/frontend/public/shots/';
const SOL = {
  'two-sum': "import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    n, target = int(data[0]), int(data[1])\n    seen = {}\n    for i, x in enumerate(map(int, data[2:2 + n])):\n        if target - x in seen:\n            print(seen[target - x], i)\n            return\n        seen[x] = i\n\nsolve()\n",
  'valid-brackets': "import sys\n\ndef solve():\n    s = sys.stdin.readline().strip()\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in s:\n        if ch in '([{':\n            stack.append(ch)\n        elif not stack or stack.pop() != pairs[ch]:\n            print('NO')\n            return\n    print('YES' if not stack else 'NO')\n\nsolve()\n",
  'max-profit': "import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    prices = list(map(int, data[1:]))\n    lowest, best = prices[0], 0\n    for p in prices:\n        best = max(best, p - lowest)\n        lowest = min(lowest, p)\n    print(best)\n\nsolve()\n",
  'first-unique': "import sys\n\ndef solve():\n    s = sys.stdin.readline().strip()\n    count = [0] * 26\n    for ch in s:\n        count[ord(ch) - 97] += 1\n    for i, ch in enumerate(s):\n        if count[ord(ch) - 97] == 1:\n            print(i)\n            return\n    print(-1)\n\nsolve()\n",
  'max-subarray': "import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    nums = list(map(int, data[1:]))\n    current = best = nums[0]\n    for x in nums[1:]:\n        current = max(x, current + x)\n        best = max(best, current)\n    print(best)\n\nsolve()\n",
};
const APPROACH = {
  'two-sum': 'I will scan once and keep a hash map from value to index. For each number I look up the complement, target minus the number. That is O(n) time and O(n) extra space.',
  'valid-brackets': 'I will use a stack. Push every opener, and for a closer the top of the stack must match, otherwise it is invalid. If the stack is empty on a closer or has leftovers at the end, the answer is no. O(n) time.',
  'max-profit': 'I keep the minimum price so far, and for each day compare the price minus that minimum against the best profit. One pass, O(n) time and O(1) constant space.',
  'first-unique': 'I count the frequency of each character with an array of 26, then do a second pass in order and return the first index with count one. O(n) time.',
  'max-subarray': 'Kadane: keep a running sum ending at the current element and restart when it would hurt, taking max of x and running plus x. Initialise with the first element so all negative works. O(n) time.',
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();
  const hideCam = () => page.addStyleTag({ content: 'video{visibility:hidden}' });
  await page.goto(B + '/signup');
  await page.getByLabel('Full name').fill('Riya Verma');
  await page.getByLabel('Email', { exact: true }).fill('riya' + Date.now() + '@example.com');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/app'); await page.getByText('Your path').waitFor();
  await page.goto(await page.getByRole('link', { name: 'open your confirmation link' }).getAttribute('href')); await page.getByText('Your email is confirmed').waitFor();
  await page.goto(B + '/app/profile');
  await page.getByLabel('College').fill('Example Institute of Technology'); await page.getByLabel('Branch').fill('Computer Science');
  await page.getByLabel('Graduation year').selectOption('2027'); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save profile' }).click(); await page.getByText('Profile saved').waitFor();
  await page.goto(B + '/app/resume'); await page.getByText('What is checked').waitFor();
  await page.setInputFiles('input[type=file]', '/home/user/hiremark/backend/tests/fixtures/good.pdf');
  await page.getByText('Interview unlocked').waitFor(); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + 'resume.png' });
  await page.goto(B + '/app/book'); await page.getByText('1 · Interviewer').waitFor();
  await page.getByRole('radio', { name: /Diksha/ }).click(); await page.getByRole('button', { name: 'Start now' }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click(); await page.getByText('Your interview is booked').waitFor();
  await page.getByRole('button', { name: 'Enter the interview room' }).click();
  await page.getByText('The rules', { exact: true }).waitFor(); await page.waitForTimeout(2500);
  console.log('mic heard:', await page.getByText('We can hear you').count());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await page.waitForURL(/\/interview\/[0-9a-f]{32}/); await page.getByLabel('Your answer').waitFor(); await hideCam(); await page.waitForTimeout(1500);
  const answer = async (t) => { await page.getByLabel('Your answer').fill(t); await page.getByRole('button', { name: 'Send' }).click(); await page.waitForTimeout(1400); };
  await answer('I am a final year B.Tech student in computer science. I built ChatWave, a real-time chat project, and my interest is backend engineering.');
  await answer('I wrote the WebSocket server and the Redis pub/sub layer myself; my teammate built the frontend.');
  await page.getByText('Coding problem').first().waitFor({ timeout: 30000 });
  const title = await page.locator('h2').first().innerText();
  const pid = { 'Pair with target sum': 'two-sum', 'Balanced brackets': 'valid-brackets', 'Best day to buy and sell': 'max-profit', 'First non-repeating character': 'first-unique', 'Largest sum of a contiguous run': 'max-subarray' }[title];
  await answer('Can the input be empty or have negative numbers?');
  await answer(APPROACH[pid]);
  if (await page.getByText('What time complexity do you expect').count()) await answer('O(n) linear time.');
  await page.waitForTimeout(3500);
  await page.evaluate((c) => window.monaco.editor.getModels()[0].setValue(c), SOL[pid]);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Run samples' }).click();
  await page.getByText('sample tests pass').waitFor({ timeout: 20000 }); await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + 'room.png' });
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByText('hidden tests pass').first().waitFor({ timeout: 30000 });
  const generic = 'In my project the event loop handles non-blocking async calls. I cached results with a ttl and fall back to the database. An index on the column uses a b-tree. Each request is independent, using a cookie session. Atomic means all or nothing, with isolation and durability so it survives a crash. A process has its own address space while threads share memory and are lighter. DNS, then the tcp handshake, then the http request and response. It is o(n) linear, with space for the map, checked before inserting so not the same index.';
  for (let i = 0; i < 30; i++) {
    if (await page.getByRole('button', { name: 'See your result' }).count()) break;
    const box = page.getByLabel('Your answer');
    if (await box.count()) { await box.fill(i % 2 ? generic.slice(0, 420) : generic.slice(200)); const b = page.getByRole('button', { name: 'Send' }); if (await b.isEnabled()) await b.click(); }
    await page.waitForTimeout(1500);
  }
  await page.getByRole('button', { name: 'See your result' }).click();
  await page.getByText('Score by segment').waitFor(); await page.waitForTimeout(1200);
  console.log('score', await page.locator('p.num').first().innerText());
  await page.screenshot({ path: OUT + 'result.png' });
  const pub = page.getByRole('button', { name: 'Publish this result' });
  if (await pub.count()) { await pub.click(); await page.getByText('Published.').waitFor(); }
  await page.goto(B + '/leaderboard'); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + 'leaderboard.png' });
  await browser.close();
})().catch(e => { console.error('FAILED', e.message.split('\n').slice(0, 5).join('\n')); process.exit(1); });
