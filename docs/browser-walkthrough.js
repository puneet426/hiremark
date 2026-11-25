const { chromium } = require('playwright');
const B = 'http://localhost:3000', S = __dirname + '/shots/';
const SOL = {
  'two-sum': "import sys\nd=sys.stdin.read().split()\nt=int(d[1]);a=list(map(int,d[2:]));s={}\nprint(*next((s[t-x],i) for i,x in enumerate(a) if t-x in s or s.update({x:i})))\n",
  'valid-brackets': "import sys\ns=sys.stdin.readline().strip();st=[];m={')':'(',']':'[','}':'{'}\nok=all((st.append(c) or True) if c in '([{' else (bool(st) and st.pop()==m[c]) for c in s)\nprint('YES' if ok and not st else 'NO')\n",
  'max-profit': "import sys\nfrom itertools import accumulate\na=list(map(int,sys.stdin.read().split()[1:]))\nprint(max(x-m for x,m in zip(a,accumulate(a,min))))\n",
  'first-unique': "import sys\nfrom collections import Counter\ns=sys.stdin.readline().strip();c=Counter(s)\nprint(next((i for i,ch in enumerate(s) if c[ch]==1),-1))\n",
  'max-subarray': "import sys\nfrom itertools import accumulate\na=list(map(int,sys.stdin.read().split()[1:]))\nprint(max(accumulate(a,lambda c,x:max(x,c+x))))\n",
};
const CPP = {
  'two-sum': "#include <bits/stdc++.h>\nusing namespace std;\nint main(){long long n,t;cin>>n>>t;unordered_map<long long,int> s;for(int i=0;i<n;i++){long long x;cin>>x;if(s.count(t-x)){cout<<s[t-x]<<' '<<i;return 0;}s[x]=i;}}\n",
  'valid-brackets': "#include <bits/stdc++.h>\nusing namespace std;\nint main(){string s;getline(cin,s);string st;for(char c:s){if(c=='('||c=='['||c=='{')st+=c;else{char o=c==')'?'(':c==']'?'[':'{';if(st.empty()||st.back()!=o){cout<<\"NO\";return 0;}st.pop_back();}}cout<<(st.empty()?\"YES\":\"NO\");}\n",
  'max-profit': "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;cin>>n;long long lo=LLONG_MAX,b=0,x;while(cin>>x){b=max(b,x-lo);lo=min(lo,x);}cout<<max(b,0LL);}\n",
  'first-unique': "#include <bits/stdc++.h>\nusing namespace std;\nint main(){string s;cin>>s;int c[26]={0};for(char ch:s)c[ch-'a']++;for(int i=0;i<(int)s.size();i++)if(c[s[i]-'a']==1){cout<<i;return 0;}cout<<-1;}\n",
  'max-subarray': "#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;cin>>n;long long x,cur,best;cin>>x;cur=best=x;while(cin>>x){cur=max(x,cur+x);best=max(best,cur);}cout<<best;}\n",
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(); global.__page = page; global.__errors = [];
  const errors = global.__errors;
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().replace(B, '').replace(/[0-9a-f]{32}/, ':id').split('?')[0]); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 300)));
  const shot = (n, full = false) => page.screenshot({ path: S + n + '.png', fullPage: full });
  const log = (...a) => console.log(...a);

  await page.goto(B); await page.waitForTimeout(800); await shot('01-landing', true);
  await page.goto(B + '/signup');
  await page.getByLabel('Full name').fill('Aarav Sharma');
  await page.getByLabel('Email', { exact: true }).fill('aarav' + Date.now() + '@example.com');
  await page.getByLabel('Password').fill('correct horse battery');
  await shot('02-signup');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/app'); await page.getByText('Your path').waitFor(); await shot('03-dashboard-new');
  // dev verify link
  const link = await page.getByRole('link', { name: 'open your confirmation link' }).getAttribute('href');
  await page.goto(link); await page.getByText('Your email is confirmed').waitFor();
  await page.goto(B + '/app/profile');
  await page.getByLabel('College').fill('Example Institute of Technology');
  await page.getByLabel('Branch').fill('Computer Science');
  await page.getByLabel('Graduation year').selectOption('2027');
  await page.getByLabel('Preferred city').fill('Pune');
  await page.getByRole('textbox', { name: 'Phone' }).fill('9876543210');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save profile' }).click(); await page.getByText('Profile saved').waitFor();
  await page.goto(B + '/app/resume'); await page.getByText('What is checked').waitFor();
  await page.setInputFiles('input[type=file]', '/home/user/hiremark/backend/tests/fixtures/weak.pdf');
  await page.getByText('Fix these first').waitFor(); await shot('04-resume-weak', true);
  await page.setInputFiles('input[type=file]', '/home/user/hiremark/backend/tests/fixtures/good.pdf');
  await page.getByText('Interview unlocked').waitFor(); await shot('05-resume-good', true);
  await page.goto(B + '/app/book'); await page.getByText('1 · Interviewer').waitFor();
  await page.getByRole('radio', { name: /Puneet Tiwari/ }).click();
  await page.getByRole('button', { name: 'Start now' }).click(); await shot('06-book', true);
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await page.getByText('Your interview is booked').waitFor(); await shot('07-booked');
  await page.getByRole('button', { name: 'Enter the interview room' }).click();
  await page.getByText('The rules', { exact: true }).waitFor(); await page.waitForTimeout(2500);
  await page.getByRole('checkbox').check(); await shot('08-precheck');
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await page.waitForURL(/\/interview\/[0-9a-f]{32}/);
  await page.getByLabel('Your answer').waitFor(); await page.waitForTimeout(2500);
  log('fullscreen:', await page.evaluate(() => !!document.fullscreenElement));
  await shot('09-room-intro');
  const answer = async (t) => { await page.getByLabel('Your answer').fill(t); await page.getByRole('button', { name: 'Send' }).click(); await page.waitForTimeout(1300); };
  await answer('I am a final year B.Tech student at Example Institute. I built ChatWave, a chat project, and my interest is backend with Python.');
  await answer('I wrote the backend API and the Redis pub/sub layer myself.');
  await page.getByText('Coding problem').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500); await shot('10-room-dsa');
  const title = await page.locator('h2').first().innerText();
  const pid = { 'Pair with target sum': 'two-sum', 'Balanced brackets': 'valid-brackets', 'Best day to buy and sell': 'max-profit', 'First non-repeating character': 'first-unique', 'Largest sum of a contiguous run': 'max-subarray' }[title];
  log('problem:', title, pid);
  await answer('I would use a hash map and a stack as needed, tracking the minimum and running sum, counting frequency, complement lookup, in O(n) time with constant extra space.');
  await page.waitForTimeout(800);
  if (await page.getByText('What time complexity do you expect').count()) await answer('It is O(n) linear time, single pass.');
  // Editor: typing works
  await page.locator('.monaco-editor').first().click();
  await page.keyboard.press('Control+End'); await page.keyboard.type('# typed by hand', { delay: 15 });
  // Outside paste must be blocked
  await page.evaluate(() => navigator.clipboard.writeText('print("pasted from outside")'));
  await page.keyboard.press('Control+V'); await page.waitForTimeout(700);
  let code = await page.evaluate(() => window.monaco.editor.getModels()[0].getValue());
  log('outside paste blocked:', !code.includes('pasted from outside'), '| toast:', await page.getByText('Blocked: you can only paste').count());
  await shot('11-paste-blocked');
  // Copy inside the editor, paste back: allowed
  await page.keyboard.press('Control+A'); await page.keyboard.press('Control+C'); await page.keyboard.press('Control+End'); await page.keyboard.press('Control+V'); await page.waitForTimeout(500);
  const code2 = await page.evaluate(() => window.monaco.editor.getModels()[0].getValue());
  log('inside paste allowed:', code2.length > code.length * 1.8);
  await page.waitForTimeout(5500); // let the 4s warning window and autosave pass
  await page.getByLabel('Language').selectOption('cpp');
  await page.getByText('Switch to C++17?').waitFor(); await shot('11b-language-dialog');
  await page.getByRole('button', { name: 'Switch language' }).click(); await page.waitForTimeout(1500);
  log('switched to C++:', (await page.evaluate(() => window.monaco.editor.getModels()[0].getValue())).includes('#include'));
  await page.waitForTimeout(4000);
  await page.evaluate((c) => window.monaco.editor.getModels()[0].setValue(c), CPP[pid]);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Run samples' }).click();
  await page.getByText('sample tests pass').waitFor({ timeout: 20000 }); await shot('12-run');
  log('run:', await page.getByText('sample tests pass').innerText());
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByText('hidden tests pass').first().waitFor({ timeout: 30000 }); await page.waitForTimeout(1200); await shot('13-submit');
  log('submit:', await page.locator('text=/\\d+\\/\\d+ hidden tests pass/').innerText());
  // the rest by voice-substitute typing until finished
  const generic = 'In my project I used the event loop with non-blocking async calls, a cache with ttl and fallback to the database, an index on the column using a b-tree, state and props with memo, each request is independent using a cookie session, atomic all or nothing with isolation and durability, a process has its own address space while threads share memory, dns then tcp handshake then http request and response, private fields with getters, the same method with different behaviour by overriding at runtime. Because we needed it instead of the alternative, I would change it and add a test. It is o(n) linear with constant space, zero, minimum before it, top is square so it does not match.';
  for (let i = 0; i < 30; i++) {
    if (await page.getByRole('button', { name: 'See your result' }).count()) break;
    if (i === 3) await shot('14-room-spoken');
    if (await page.getByText('I have put a short').count() && i < 28) await shot('15-room-bug');
    const box = page.getByLabel('Your answer');
    if (await box.count()) { await box.fill(i % 2 ? generic.slice(0, 600) : generic.slice(300)); const b = page.getByRole('button', { name: 'Send' }); if (await b.isEnabled()) await b.click(); }
    await page.waitForTimeout(1600);
  }
  await page.getByRole('button', { name: 'See your result' }).waitFor({ timeout: 60000 }); await shot('16-room-done');
  await page.getByRole('button', { name: 'See your result' }).click();
  await page.getByText('Score by segment').waitFor(); await page.waitForTimeout(900); await shot('17-result', true);
  log('score:', (await page.locator('p.num').first().innerText()).replace(/\s+/g, ' '), '| integrity:', await page.getByText(/warning/).first().innerText());
  const pub = page.getByRole('button', { name: 'Publish this result' });
  if (await pub.count()) { await pub.click(); await page.getByText('Published.').waitFor(); log('published'); } else log('not publishable:', await page.getByText(/cannot be published/).count());
  await page.goto(B + '/leaderboard'); await page.waitForTimeout(1200); await shot('18-leaderboard', true);
  await page.goto(B + '/app/billing'); await page.getByText('Payment history').waitFor();
  await page.getByRole('button', { name: /Pay ₹399/ }).click(); await page.getByText('Test checkout').waitFor(); await shot('19-checkout');
  await page.getByRole('button', { name: 'Simulate successful payment' }).click(); await page.getByText('Payment received').waitFor(); await shot('20-billing', true);
  await page.goto(B + '/app'); await page.getByText('Your path').waitFor(); await shot('21-dashboard-done', true);
  await page.goto(B + '/pricing'); await shot('22-pricing', true);
  // phone width check of landing
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(B); await page.waitForTimeout(500); await shot('23-landing-phone', true);
  log('console errors:', errors.length, [...new Set(errors)].slice(0, 8));
  await browser.close();
})().catch(async e => { try { await global.__page.screenshot({ path: __dirname + '/shots/fail.png' }); console.log('errors', [...new Set(global.__errors)].slice(0,8)); } catch {} console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
