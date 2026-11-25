"""Question bank.

Each spoken question has key points. A key point is covered when the answer
mentions any of its phrases (or when the AI grader says so). Model answers are
shown in the report as the "best answer".
"""

INTERVIEWERS = [
    {"id": "diksha", "name": "Diksha", "title": "Staff Engineer, Payments", "style": "Calm and exact. Asks why before how.", "pitch": 1.05, "rate": 0.98, "voice": "female", "hue": 18},
    {"id": "puneet", "name": "Puneet Tiwari", "title": "Senior Engineer, Infrastructure", "style": "Direct. Pushes on failure cases.", "pitch": 0.85, "rate": 1.0, "voice": "male", "hue": 205},
    {"id": "trishna", "name": "Trishna", "title": "Engineering Manager, Search", "style": "Friendly start, strict follow-ups.", "pitch": 1.15, "rate": 1.02, "voice": "female", "hue": 330},
    {"id": "ayush", "name": "Ayush", "title": "Principal Engineer, Data", "style": "Slow and thorough. Wants dry runs.", "pitch": 0.75, "rate": 0.92, "voice": "male", "hue": 150},
    {"id": "sana", "name": "Sana", "title": "Senior Engineer, Mobile", "style": "Fast paced. Values clear trade-offs.", "pitch": 1.2, "rate": 1.08, "voice": "female", "hue": 265},
    {"id": "arjun", "name": "Arjun", "title": "Tech Lead, Backend", "style": "Complexity first, code second.", "pitch": 0.95, "rate": 1.04, "voice": "male", "hue": 42},
    {"id": "divya", "name": "Divya", "title": "Staff Engineer, Reliability", "style": "Asks what breaks at scale.", "pitch": 1.0, "rate": 0.95, "voice": "female", "hue": 185},
    {"id": "vikram", "name": "Vikram", "title": "Senior Engineer, Platform", "style": "Quiet. Lets silence do the work.", "pitch": 0.8, "rate": 0.96, "voice": "male", "hue": 95},
    {"id": "nisha", "name": "Nisha", "title": "Engineering Manager, Growth", "style": "Checks every resume claim.", "pitch": 1.1, "rate": 1.0, "voice": "female", "hue": 350},
    {"id": "farhan", "name": "Farhan", "title": "Principal Engineer, Systems", "style": "Old-school fundamentals.", "pitch": 0.9, "rate": 0.94, "voice": "male", "hue": 235},
]
INTERVIEWER_IDS = {i["id"] for i in INTERVIEWERS}

LANGUAGES = {
    "python": {"label": "Python 3", "judge0": 71, "monaco": "python"},
    "javascript": {"label": "JavaScript (Node)", "judge0": 63, "monaco": "javascript"},
    "cpp": {"label": "C++17", "judge0": 54, "monaco": "cpp"},
    "java": {"label": "Java", "judge0": 62, "monaco": "java"},
}

_STARTER_TAIL = {
    "python": "import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    # write your solution here\n\nsolve()\n",
    "javascript": "const data = require('fs').readFileSync(0, 'utf8').split(/\\s+/).filter(Boolean);\n// write your solution here\n",
    "cpp": "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution here\n    return 0;\n}\n",
    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // write your solution here\n    }\n}\n",
}


def starter(language: str) -> str:
    return _STARTER_TAIL[language]


def kp(label: str, *phrases: str) -> dict:
    return {"label": label, "phrases": [p.lower() for p in phrases]}


# ---------------------------------------------------------------- DSA (easy)
# Programs read standard input and print to standard output, so the same hidden
# tests work for every language. The first `samples` tests are visible.
DSA = [
    {
        "id": "two-sum",
        "title": "Pair with target sum",
        "statement": "You are given n integers and a target. Print the indices (0-based, smaller index first) of the two numbers that add up to the target. Exactly one such pair exists.",
        "input": "Line 1: n and target. Line 2: n integers.",
        "output": "Two indices separated by a space.",
        "constraints": "2 ≤ n ≤ 100000, values fit in 32-bit integers.",
        "samples": 2,
        "tests": [
            ("4 9\n2 7 11 15\n", "0 1"), ("3 6\n3 2 4\n", "1 2"), ("2 6\n3 3\n", "0 1"),
            ("5 -3\n-1 -2 4 0 9\n", "0 1"), ("6 100\n1 2 3 50 4 50\n", "3 5"), ("4 0\n-5 1 5 9\n", "0 2"),
            ("5 1000000000\n500000000 5 7 500000000 3\n", "0 3"),
            ("LARGE_TWO_SUM", "49998 49999"),
        ],
        "approach_points": [
            kp("Uses a hash map of value to index", "hash", "map", "dictionary", "dict", "set", "lookup table"),
            kp("Looks up the complement (target minus current)", "complement", "target minus", "target -", "difference", "remaining"),
            kp("States O(n) time", "o(n)", "o of n", "order n", "order of n", "linear", "single pass", "one pass"),
            kp("States the extra space cost", "space", "memory", "extra"),
        ],
        "followups": [
            {"q": "What is the time and space complexity of what you wrote, and why?", "points": [kp("Time O(n)", "o(n)", "o of n", "linear", "order n"), kp("Space O(n) for the map", "space", "memory", "o(n)")]},
            {"q": "What happens if the same value appears twice, say 3 and 3 with target 6?", "points": [kp("Checks the map before inserting, so an element is not paired with itself", "before insert", "before add", "before stor", "check first", "itself", "same index", "same element", "different ind", "two different")]},
        ],
        "hints": ["A brute force checks every pair. Think about what you would need to remember to avoid the inner loop.",
                  "For each number x, you need to know whether target minus x was seen earlier, and where.",
                  "Store value to index in a hash map as you scan; check the map before inserting the current value."],
        "model": "Scan once, keeping a hash map from value to index. For each number x at index i, check whether target − x is already in the map; if so, print that index and i. Otherwise store x → i. Checking before inserting means an element is never paired with itself. Time O(n), space O(n). Brute force would be O(n²).",
    },
    {
        "id": "valid-brackets",
        "title": "Balanced brackets",
        "statement": "Given a string made only of the characters ( ) [ ] { }, print YES if every bracket is closed by the same type in the correct order, otherwise print NO. An empty line counts as balanced.",
        "input": "One line containing the string (possibly empty).",
        "output": "YES or NO.",
        "constraints": "Length ≤ 100000.",
        "samples": 2,
        "tests": [
            ("()[]{}\n", "YES"), ("(]\n", "NO"), ("\n", "YES"), ("([{}])\n", "YES"), ("((\n", "NO"),
            ("))\n", "NO"), ("([)]\n", "NO"), ("{[]}()\n", "YES"), ("(\n", "NO"), ("LARGE_BRACKETS", "YES"),
        ],
        "approach_points": [
            kp("Uses a stack", "stack", "push", "pop", "lifo"),
            kp("Matches each closer with the top of the stack", "top", "match", "last open", "most recent", "pair"),
            kp("Handles a closer with an empty stack and leftovers at the end", "empty", "left over", "leftover", "remaining", "at the end"),
            kp("States O(n) time", "o(n)", "o of n", "linear", "order n", "single pass"),
        ],
        "followups": [
            {"q": "Walk me through your code on the input: open round, open square, close round, close square.", "points": [kp("Shows the mismatch: top is the square bracket when the round closer arrives", "mismatch", "top is", "does not match", "doesn't match", "not match", "square", "returns no", "print no", "false", "invalid")]},
            {"q": "What is the worst-case space usage and which input causes it?", "points": [kp("O(n) when all characters are openers", "o(n)", "linear", "all open", "only open", "all opening", "n open")]},
        ],
        "hints": ["Think about which opening bracket a closing bracket must match: the earliest one or the most recent one?",
                  "The most recent unmatched opener must close first. Which data structure gives you the most recent item?",
                  "Push openers on a stack. On a closer, the stack must be non-empty and its top must be the matching opener. At the end the stack must be empty."],
        "model": "Use a stack. Push every opening bracket. For a closing bracket, if the stack is empty or its top is not the matching opener, the string is invalid; otherwise pop. After the scan the stack must be empty. Time O(n), space O(n) in the worst case (all openers).",
    },
    {
        "id": "max-profit",
        "title": "Best day to buy and sell",
        "statement": "You are given the price of a stock on n consecutive days. You may buy once and sell once on a later day. Print the maximum profit, or 0 if no profit is possible.",
        "input": "Line 1: n. Line 2: n integers (prices).",
        "output": "One integer.",
        "constraints": "1 ≤ n ≤ 100000, 0 ≤ price ≤ 10^9.",
        "samples": 2,
        "tests": [
            ("6\n7 1 5 3 6 4\n", "5"), ("5\n7 6 4 3 1\n", "0"), ("1\n5\n", "0"), ("2\n1 2\n", "1"),
            ("5\n3 3 3 3 3\n", "0"), ("6\n2 4 1 7 0 5\n", "6"), ("4\n0 1000000000 0 999999999\n", "1000000000"),
            ("LARGE_PROFIT", "99999"),
        ],
        "approach_points": [
            kp("Tracks the minimum price seen so far", "minimum", "min price", "lowest", "smallest", "cheapest"),
            kp("Compares today's price minus the minimum against the best profit", "difference", "price minus", "current minus", "profit", "subtract"),
            kp("States O(n) time", "o(n)", "o of n", "linear", "order n", "single pass", "one pass"),
            kp("States O(1) extra space", "o(1)", "constant", "no extra"),
        ],
        "followups": [
            {"q": "Why is one pass enough? Convince me you do not miss a better pair.", "points": [kp("For each sell day, the best buy day is the minimum before it", "minimum before", "min so far", "lowest so far", "best buy", "every sell", "each day", "each sell", "before it", "earlier")]},
            {"q": "What does your code print when prices only fall?", "points": [kp("Prints 0 because profit never goes above the initial 0", "zero", "0")]},
        ],
        "hints": ["Brute force tries every buy and sell pair. For a fixed selling day, which buying day is best?",
                  "The best buying day for any selling day is the cheapest day before it.",
                  "Keep the minimum price so far and the best profit so far; update both in one scan."],
        "model": "Scan the prices once, keeping the lowest price seen so far and the best profit so far. For each day, the best profit if you sell today is today's price minus the lowest earlier price; update the best profit, then update the minimum. Start the best profit at 0 so falling prices print 0. Time O(n), space O(1).",
    },
    {
        "id": "first-unique",
        "title": "First non-repeating character",
        "statement": "Given a string of lowercase letters, print the index (0-based) of the first character that appears exactly once. Print -1 if there is none.",
        "input": "One line containing the string.",
        "output": "One integer.",
        "constraints": "1 ≤ length ≤ 100000.",
        "samples": 2,
        "tests": [
            ("leetcode\n", "0"), ("aabb\n", "-1"), ("loveleetcode\n", "2"), ("z\n", "0"), ("aabbc\n", "4"),
            ("abcabc\n", "-1"), ("abacabad\n", "3"), ("LARGE_UNIQUE", "99999"),
        ],
        "approach_points": [
            kp("Counts the frequency of each character", "count", "frequency", "freq", "occurrence", "how many times"),
            kp("Uses a hash map or a 26-size array", "hash", "map", "dictionary", "dict", "array of 26", "26", "counter"),
            kp("Scans the string again in order to find the first with count one", "second pass", "again", "two pass", "in order", "second loop", "another loop", "first one with"),
            kp("States O(n) time", "o(n)", "o of n", "linear", "order n"),
        ],
        "followups": [
            {"q": "How much extra space do you use, and does it grow with the input?", "points": [kp("Constant: at most 26 counters", "26", "constant", "o(1)", "fixed", "does not grow", "doesn't grow")]},
            {"q": "Why scan the string the second time rather than the map?", "points": [kp("The string keeps the original order; the map does not give the first position", "order", "first position", "original", "position", "index")]},
        ],
        "hints": ["You need to know how many times each character occurs before you can decide anything.",
                  "Count every character first. Then which order should you look through them?",
                  "Two passes: count frequencies, then scan the string from the left and return the first index whose count is 1."],
        "model": "Make two passes. First count how often each character occurs, using an array of 26 counters. Then scan the string from the left and print the first index whose count is 1; print −1 if none. Scanning the string (not the counter) keeps the original order. Time O(n), space O(1) since there are only 26 letters.",
    },
    {
        "id": "max-subarray",
        "title": "Largest sum of a contiguous run",
        "statement": "Given n integers, print the largest possible sum of a contiguous, non-empty subarray.",
        "input": "Line 1: n. Line 2: n integers.",
        "output": "One integer.",
        "constraints": "1 ≤ n ≤ 100000, |value| ≤ 10^4.",
        "samples": 2,
        "tests": [
            ("9\n-2 1 -3 4 -1 2 1 -5 4\n", "6"), ("1\n-7\n", "-7"), ("5\n5 4 -1 7 8\n", "23"), ("3\n-3 -1 -2\n", "-1"),
            ("4\n0 0 0 0\n", "0"), ("6\n1 -2 3 -1 2 -5\n", "4"), ("2\n-1 10\n", "10"), ("LARGE_SUBARRAY", "100000"),
        ],
        "approach_points": [
            kp("Keeps a running sum ending at the current element (Kadane)", "kadane", "running sum", "current sum", "ending at", "ends at", "so far"),
            kp("Restarts when the running sum would hurt: max(x, running + x)", "restart", "reset", "start fresh", "start new", "negative", "max of", "drop"),
            kp("States O(n) time", "o(n)", "o of n", "linear", "order n", "single pass", "one pass"),
            kp("Handles an all-negative array", "all negative", "negative numbers", "initialise with the first", "initialize with the first", "first element"),
        ],
        "followups": [
            {"q": "What does your code print when every number is negative?", "points": [kp("The largest single element, because the answer is initialised from the first element and not from zero", "largest", "maximum element", "least negative", "first element", "not zero", "biggest", "single element")]},
            {"q": "What would the brute-force complexity be, and why is yours better?", "points": [kp("Brute force is O(n²) or O(n³)", "n square", "n^2", "n squared", "o(n2)", "n cube", "n^3", "quadratic", "every subarray", "all subarrays")]},
        ],
        "hints": ["Brute force tries every start and end. Think about the best sum that ends exactly at position i.",
                  "The best run ending at i either extends the best run ending at i−1 or starts fresh at i.",
                  "current = max(x, current + x); best = max(best, current). Initialise both with the first element."],
        "model": "Use Kadane's algorithm. Keep the best sum of a run ending at the current element: current = max(x, current + x), and the best overall. Initialise both with the first element so an all-negative array returns its largest element. Time O(n), space O(1). Brute force over all subarrays is O(n²).",
    },
]


def expand_tests(problem: dict) -> list[tuple[str, str]]:
    """Large tests are generated here so the bank stays readable."""
    out = []
    for inp, exp in problem["tests"]:
        if inp == "LARGE_TWO_SUM":
            n = 50000
            inp = f"{n} {2 * n - 3}\n" + " ".join(str(i) for i in range(n)) + "\n"
            exp = f"{n - 2} {n - 1}"
        elif inp == "LARGE_BRACKETS":
            inp = "(" * 30000 + "[" * 20000 + "]" * 20000 + ")" * 30000 + "\n"
        elif inp == "LARGE_PROFIT":
            inp = "100000\n" + " ".join(str(i) for i in range(1, 100001)) + "\n"
        elif inp == "LARGE_UNIQUE":
            inp = "ab" * 49999 + "c" + "\n"
            exp = "99998"
        elif inp == "LARGE_SUBARRAY":
            inp = "100000\n" + " ".join(["1"] * 100000) + "\n"
        out.append((inp, exp))
    return out


DSA_BY_ID = {p["id"]: p for p in DSA}

# ------------------------------------------------- Development: by resume skill
# Asked only when the skill appears on the student's resume.
SKILL_QUESTIONS = {
    "react": {"q": "Your resume lists React. When does a component re-render, and how did you stop unnecessary re-renders in your project?",
              "points": [kp("Re-renders on state or props change, or when the parent renders", "state", "props", "parent"), kp("Names a technique: memo, useMemo, useCallback, keys or splitting components", "memo", "usememo", "usecallback", "key", "split", "pure")],
              "follow": "What is the virtual DOM actually saving you from?", "fpoints": [kp("Avoids direct, repeated updates to the real DOM by diffing and batching", "diff", "real dom", "actual dom", "batch", "reconcil", "minimal", "only the chang")],
              "model": "A component re-renders when its state changes, its props change, or its parent re-renders. To avoid wasted renders use React.memo for pure children, useMemo and useCallback to keep references stable, correct keys in lists, and keep state as low in the tree as possible. The virtual DOM lets React diff two trees in memory and apply the smallest set of real DOM updates in one batch."},
    "node.js": {"q": "You have used Node.js. It runs JavaScript on one thread, so how does it serve many requests at once?",
                "points": [kp("Event loop", "event loop"), kp("Non-blocking or asynchronous I/O handed to the OS or a thread pool", "non-blocking", "non blocking", "async", "callback", "libuv", "thread pool", "i/o")],
                "follow": "What kind of work would freeze a Node server, and what would you do about it?", "fpoints": [kp("CPU-heavy synchronous work blocks the loop; move it to worker threads, a queue or another service", "cpu", "block", "worker", "queue", "synchronous", "heavy comput", "child process")],
                "model": "Node runs your JavaScript on a single thread with an event loop. I/O such as network and disk is non-blocking: it is handed to the operating system or libuv's thread pool, and the callback runs when the result is ready, so one thread can juggle thousands of connections. CPU-heavy synchronous work blocks the loop for everyone; move it to worker threads, a job queue or a separate service."},
    "express": {"q": "In your Express project, what is middleware and in what order did you arrange yours?",
                "points": [kp("A function with request, response and next that runs in the request pipeline", "next", "request", "pipeline", "chain", "before the route"), kp("Order matters: parsing and auth before routes, error handler last", "order", "auth", "error handler", "last", "before")],
                "follow": "Where does an error thrown inside an async route handler go?", "fpoints": [kp("It must be passed to next(err) or caught, then handled by the error-handling middleware", "next(", "next (", "catch", "error middleware", "error handler", "four argument", "unhandled")],
                "model": "Middleware is a function (req, res, next) that runs in order for each request and can read or change the request, end the response or call next. Order matters: body parsing, logging and authentication come before the routes, and the error-handling middleware (four arguments) comes last. Errors in async handlers must be caught and passed to next(err), otherwise they never reach the error handler."},
    "mongodb": {"q": "You chose MongoDB. Why a document database for that project instead of a relational one?",
                "points": [kp("Flexible or nested schema fits the data", "flexible", "schema", "nested", "document", "json"), kp("Names a trade-off: joins, transactions or consistency are weaker or harder", "join", "transaction", "consisten", "relation", "trade")],
                "follow": "How did you make your most frequent query fast?", "fpoints": [kp("An index on the queried field, and checking it with explain", "index", "explain")],
                "model": "MongoDB fits when records are self-contained documents with varying or nested fields and you mostly read a whole document at once. The trade-off is that joins across collections and multi-document transactions are weaker than in a relational database, so highly related data fits SQL better. Frequent queries need an index on the filtered fields; verify with explain() that the index is used."},
    "mysql": {"q": "Your project uses MySQL. What indexes did you create, and how does an index speed up a query?",
              "points": [kp("Names the column(s) indexed or the primary key", "primary", "column", "on the", "foreign", "index on"), kp("B-tree lets the database find rows without scanning the table", "b-tree", "btree", "b tree", "tree", "full scan", "full table", "scan", "sorted")],
              "follow": "What is the cost of adding an index to every column?", "fpoints": [kp("Slower writes and more storage", "write", "insert", "update", "storage", "space", "slow")],
              "model": "An index is a sorted B-tree on one or more columns, so the database can jump to matching rows in O(log n) instead of scanning the whole table. Index the columns used in WHERE, JOIN and ORDER BY. Every index must be updated on insert, update and delete and takes storage, so indexing everything slows writes."},
    "postgresql": {"q": "You used PostgreSQL. What does a transaction guarantee, and where did your project need one?",
                   "points": [kp("Atomicity: all statements succeed or none", "atomic", "all or nothing", "all or none", "rollback", "roll back"), kp("A real use: money, inventory, multi-table updates", "payment", "order", "balance", "two table", "multiple table", "inventory", "transfer", "together")],
                   "follow": "Two requests update the same row at the same moment. What happens?", "fpoints": [kp("Row lock or MVCC: one waits or fails, depending on isolation level", "lock", "isolation", "mvcc", "wait", "serializ", "version")],
                   "model": "A transaction makes a group of statements atomic, consistent, isolated and durable: either all of them commit or none do. Use one whenever several rows or tables must change together, such as moving money or creating an order with its items. When two transactions update the same row, PostgreSQL locks the row so the second waits; under stricter isolation levels it may fail and must be retried."},
    "redis": {"q": "You used Redis. What exactly did it cache, and what happens to your app when Redis goes down?",
              "points": [kp("States what was cached or stored (sessions, query results, counters, pub/sub)", "session", "cache", "result", "counter", "pub", "token", "queue", "rate"), kp("On failure the app should fall back to the database, only slower", "fall back", "fallback", "database", "db", "slower", "miss", "still work", "degrade")],
              "follow": "How do you stop the cache from serving stale data?", "fpoints": [kp("TTL or expiry, or invalidating on write", "ttl", "expir", "invalidat", "delete on", "evict", "on write", "on update")],
              "model": "Redis is an in-memory store, typically used to cache expensive query results, sessions, rate-limit counters or pub/sub messages. A cache must be optional: if Redis is down, every read is a cache miss and goes to the database, so the app is slower but correct. Keep data fresh with a TTL on each key and by deleting or updating the key whenever the underlying data changes."},
    "docker": {"q": "Your resume mentions Docker. What is the difference between an image and a container, and how is a container different from a virtual machine?",
               "points": [kp("Image is the read-only template; container is a running instance", "template", "running instance", "instance", "read-only", "read only", "blueprint", "snapshot"), kp("Containers share the host kernel; VMs run a full guest OS", "kernel", "guest", "hypervisor", "lightweight", "share")],
               "follow": "How would you make your image smaller?", "fpoints": [kp("Smaller base image, multi-stage build, fewer layers, .dockerignore", "alpine", "slim", "multi-stage", "multi stage", "layer", "dockerignore", "base image")],
               "model": "An image is a read-only, layered template; a container is a running, isolated instance of an image. Containers share the host's kernel and isolate processes with namespaces and cgroups, so they start in seconds and are light; a virtual machine runs a full guest operating system on a hypervisor. To shrink an image use a slim base, a multi-stage build so build tools are left behind, and a .dockerignore file."},
    "aws": {"q": "You deployed on AWS. Which services did you use, and what happens to your app if that one server dies?",
            "points": [kp("Names concrete services (EC2, S3, RDS, Lambda…)", "ec2", "s3", "rds", "lambda", "elastic", "cloudfront", "dynamo", "amplify"), kp("Honest about single point of failure or describes load balancer, auto scaling, multiple zones", "single point", "down", "load balanc", "auto scal", "autoscal", "availability zone", "multiple", "restart", "backup")],
            "follow": "Where did you keep the database password and API keys?", "fpoints": [kp("Environment variables or a secrets manager, not in the code or repository", "environment", "env", "secret", "parameter store", "not in the code", "not in git", ".env")],
            "model": "Name the services and why: for example EC2 for the server, RDS for the database and S3 for files. With a single instance, the app is down if it dies; resilience needs at least two instances in different availability zones behind a load balancer, with an auto-scaling group to replace failed ones and database backups. Secrets belong in environment variables or a secrets manager, never in the repository."},
    "django": {"q": "You built with Django. What does the ORM do for you, and what is the N+1 query problem?",
               "points": [kp("Maps Python classes to tables and builds SQL", "model", "class", "table", "sql", "object"), kp("N+1: one query for a list, then one more per item", "n+1", "n + 1", "per item", "each item", "for each", "loop", "extra quer", "one query for")],
               "follow": "How do you fix it in Django?", "fpoints": [kp("select_related or prefetch_related", "select_related", "prefetch", "select related", "join")],
               "model": "The ORM maps model classes to tables and turns Python expressions into SQL, with migrations to manage schema changes. The N+1 problem is fetching a list in one query and then triggering one more query per row when you touch a related object in a loop. Fix it with select_related (a SQL join, for foreign keys) or prefetch_related (a second batched query, for many-to-many)."},
    "flask": {"q": "You used Flask. How did you structure the app as it grew, and how are requests kept separate from each other?",
              "points": [kp("Blueprints or modules, application factory", "blueprint", "factory", "module", "package", "separate file"), kp("Request context: each request has its own request and g objects", "context", "request object", "thread", " g ", "per request", "each request")],
              "follow": "Flask's built-in server is not for production. What did you run it with, and why?", "fpoints": [kp("A WSGI server such as Gunicorn or uWSGI with several workers", "gunicorn", "uwsgi", "wsgi", "worker", "waitress")],
              "model": "As a Flask app grows, split it into blueprints registered by an application factory. Flask keeps requests separate with a request context: request and g are bound to the current request, so concurrent requests do not see each other's data. The built-in server is single-process and for development only; production uses a WSGI server such as Gunicorn with several workers behind a reverse proxy."},
    "fastapi": {"q": "You used FastAPI. What do you get from declaring request models with Pydantic, and when should a route be async?",
                "points": [kp("Validation and type conversion, automatic docs", "validat", "type", "docs", "swagger", "openapi", "schema"), kp("Async for I/O-bound work that awaits; blocking calls in async routes stall the loop", "i/o", "await", "block", "event loop", "database call", "network", "io bound", "io-bound")],
                "follow": "What happens if you call a slow blocking library inside an async route?", "fpoints": [kp("It blocks the event loop and every other request waits", "block", "wait", "event loop", "all request", "other request", "stall", "freez")],
                "model": "Pydantic models validate and convert incoming data and give automatic OpenAPI docs, so bad input is rejected with a clear 422 before your code runs. Use async routes for I/O-bound work with libraries you can await. A blocking call inside an async route blocks the single event loop, so every other request waits; use a normal def route (run in a thread pool) or an async library instead."},
    "spring boot": {"q": "You used Spring Boot. What is dependency injection, and what did it buy you in that project?",
                    "points": [kp("The framework creates objects and supplies their dependencies", "container", "framework creates", "inject", "autowired", "bean", "inversion of control", "ioc"), kp("Looser coupling and easier testing", "loose", "decoupl", "test", "mock", "swap")],
                    "follow": "What is the default scope of a Spring bean, and why does that matter for instance variables?", "fpoints": [kp("Singleton, so shared mutable state is not thread-safe", "singleton", "thread", "shared", "one instance")],
                    "model": "Dependency injection means the Spring container creates objects (beans) and passes each one the collaborators it needs, instead of classes constructing their own. Classes depend on interfaces, so they are loosely coupled and easy to test with mocks. Beans are singletons by default, shared by all request threads, so they must not keep per-request data in instance variables."},
    "java": {"q": "You list Java. What is the difference between an interface and an abstract class, and when did you last pick one over the other?",
             "points": [kp("Interface is a contract a class can implement many of; abstract class shares state and code but single inheritance", "contract", "multiple", "state", "single inherit", "fields", "constructor", "partial implement", "only one"), kp("Gives a concrete example of choosing", "example", "used", "because", "when", "in my project")],
             "follow": "How does HashMap handle two keys with the same hash code?", "fpoints": [kp("Collision: same bucket, stored in a list or tree and compared with equals", "bucket", "collision", "linked list", "equals", "chain", "tree")],
             "model": "An interface is a contract; a class can implement many. An abstract class can hold fields, constructors and shared code, but a class can extend only one. Choose an interface for a capability shared by unrelated classes and an abstract class for closely related classes sharing state. HashMap puts keys with the same hash in the same bucket, as a linked list that becomes a tree when long, and uses equals() to find the right key."},
    "python": {"q": "You list Python. What is the difference between a list and a tuple, and why can a tuple be a dictionary key when a list cannot?",
               "points": [kp("List is mutable, tuple is immutable", "mutable", "immutable", "cannot change", "can't change", "can not be changed"), kp("Dictionary keys must be hashable, which needs immutability", "hash", "hashable")],
               "follow": "What is the GIL, and what does it mean for a CPU-heavy multithreaded program?", "fpoints": [kp("Only one thread runs Python bytecode at a time, so threads do not speed up CPU work; use multiprocessing", "one thread", "single thread", "global interpreter", "multiprocess", "not parallel", "no speed", "one at a time")],
               "model": "A list is mutable; a tuple is immutable. Dictionary keys must be hashable, and the hash must never change, so immutable tuples qualify and lists do not. The GIL (global interpreter lock) lets only one thread execute Python bytecode at a time, so threads help with I/O waiting but not CPU-heavy work, which needs multiprocessing or native code."},
    "javascript": {"q": "You list JavaScript. What is a closure, and where did you rely on one?",
                   "points": [kp("A function that remembers variables from the scope where it was created", "remember", "outer", "scope", "lexical", "enclos", "access to"), kp("A real use: callbacks, event handlers, private state, hooks", "callback", "handler", "private", "counter", "hook", "debounce", "settimeout")],
                   "follow": "What is the difference between a promise's then callback and setTimeout with zero delay in terms of when they run?", "fpoints": [kp("Promise callbacks are microtasks and run before timers (macrotasks)", "microtask", "micro task", "before", "first", "macrotask", "priority")],
                   "model": "A closure is a function together with the variables of the scope where it was defined; it can still read and change them after that scope has returned. Closures power callbacks, event handlers, private state and React hooks. Promise callbacks are microtasks and run as soon as the current code finishes, before timer callbacks, which are macrotasks."},
    "c++": {"q": "You list C++. What is the difference between a pointer and a reference, and how do you avoid memory leaks in modern C++?",
            "points": [kp("A reference must be bound, cannot be null or reseated; a pointer can", "null", "reseat", "reassign", "must be initial", "alias", "address"), kp("RAII and smart pointers", "smart pointer", "unique_ptr", "shared_ptr", "raii", "unique pointer", "shared pointer", "destructor")],
            "follow": "When would you choose unique_ptr over shared_ptr?", "fpoints": [kp("Single owner, no reference-count overhead; shared only when ownership is really shared", "single owner", "one owner", "sole", "overhead", "reference count", "exclusive", "only one")],
            "model": "A pointer holds an address, can be null and can be changed to point elsewhere; a reference is an alias that must be bound when created and cannot be null or reseated. Avoid leaks with RAII: let objects own resources and free them in destructors, using unique_ptr for a single owner and shared_ptr only when ownership is truly shared, since it adds reference-counting overhead."},
    "git": {"q": "You use Git. What is the difference between merge and rebase, and which did your team use?",
            "points": [kp("Merge keeps both histories with a merge commit; rebase replays commits for a linear history", "merge commit", "linear", "replay", "rewrit", "history", "on top"), kp("States a team practice or the rule about not rebasing shared branches", "team", "we used", "shared", "public", "pull request", "never rebase", "force push")],
            "follow": "You committed a secret key and pushed it. What do you do?", "fpoints": [kp("Rotate or revoke the key first; removing it from history is not enough", "rotate", "revoke", "regenerate", "new key", "invalidate", "change the key")],
            "model": "Merge joins two branches with a merge commit and keeps the true history. Rebase replays your commits on top of the target for a linear history, but rewrites commits, so never rebase a branch others have pulled. If a secret is pushed, revoke and rotate it immediately; cleaning the history alone is not enough because it may already have been copied."},
    "rest api": {"q": "You built REST APIs. Which HTTP methods and status codes did your main endpoints use, and what does idempotent mean?",
                 "points": [kp("Maps methods correctly: GET reads, POST creates, PUT/PATCH updates, DELETE removes", "get", "post", "put", "patch", "delete"), kp("Idempotent: repeating the request gives the same result", "same result", "same effect", "repeat", "multiple times", "more than once", "no additional")],
                 "follow": "A user double-clicks Pay and two POST requests arrive. How do you avoid charging twice?", "fpoints": [kp("Idempotency key or unique constraint checked on the server", "idempotency key", "unique", "request id", "token", "dedup", "constraint", "check if exist")],
                 "model": "GET reads, POST creates, PUT replaces, PATCH updates partly and DELETE removes, with codes such as 200, 201, 400, 401, 403, 404 and 500. An idempotent method has the same effect whether sent once or many times: GET, PUT and DELETE are; POST is not. To make a payment POST safe, the client sends an idempotency key and the server stores it under a unique constraint, returning the first result for any repeat."},
    "jwt": {"q": "You used JWT for login. What is inside the token, where did you store it in the browser, and how do you log a user out?",
            "points": [kp("Header, payload and signature; payload is readable, signature prevents tampering", "signature", "payload", "header", "signed", "base64"), kp("Storage trade-off: HttpOnly cookie against XSS versus localStorage", "httponly", "http only", "cookie", "localstorage", "local storage", "xss")],
            "follow": "A token is stolen and is valid for seven days. What can you do?", "fpoints": [kp("Short expiry with refresh tokens, or a server-side revocation list", "short", "refresh", "revok", "blacklist", "blocklist", "denylist", "expire")],
            "model": "A JWT has a header, a payload of claims and a signature. The payload is only encoded, not encrypted, so never put secrets in it; the signature proves it was not altered. Storing it in an HttpOnly cookie protects it from XSS; localStorage does not. Because a JWT stays valid until it expires, use short-lived access tokens with refresh tokens, and keep a revocation list for logout and stolen tokens."},
    "machine learning": {"q": "Your resume has a machine learning project. How did you split your data, and how do you know the model is not overfitting?",
                         "points": [kp("Train, validation and test split or cross-validation", "train", "validation", "test", "cross-valid", "cross valid", "split"), kp("Compares training and validation performance", "gap", "training accuracy", "validation accuracy", "compare", "validation loss", "difference between")],
                         "follow": "Your accuracy was high. Why might accuracy be the wrong metric?", "fpoints": [kp("Class imbalance; use precision, recall or F1", "imbalance", "precision", "recall", "f1", "skew", "unbalanced")],
                         "model": "Split the data into training, validation and test sets (or use cross-validation), tune on validation and report on the untouched test set. Overfitting shows as training performance far better than validation; fight it with more data, regularisation, simpler models or early stopping. Accuracy misleads on imbalanced classes, where precision, recall and F1 say more."},
    "websockets": {"q": "You used WebSockets. Why not plain HTTP polling, and what happens to your connections when you run two server instances?",
                   "points": [kp("Persistent two-way connection, server can push without repeated requests", "persistent", "two-way", "two way", "bidirectional", "push", "real-time", "real time", "full duplex"), kp("Clients on different instances need a shared broker such as Redis pub/sub", "pub", "broker", "redis", "sticky", "shared", "other instance", "different server")],
                   "follow": "How does the server notice a client that lost its network without closing the socket?", "fpoints": [kp("Heartbeat or ping/pong with a timeout", "heartbeat", "ping", "pong", "timeout", "keepalive", "keep alive")],
                   "model": "A WebSocket is one persistent, two-way connection, so the server can push messages instantly without the overhead and delay of polling. With several server instances, two users may be connected to different ones, so messages must pass through a shared broker such as Redis pub/sub. Dead connections are found with ping/pong heartbeats and a timeout."},
}

GENERIC_DEV = [
    {"id": "dev-arch", "q": "Pick the project on your resume you know best. Walk me through its architecture: what talks to what when a user performs the main action?",
     "points": [kp("Names the client, server and data store", "frontend", "front end", "client", "backend", "back end", "server", "database", "api"), kp("Follows a request end to end", "request", "then", "response", "calls", "sends", "returns", "flow")],
     "follow": "Which part of that would break first with a hundred times more users, and why?", "fpoints": [kp("Identifies a bottleneck with a reason", "database", "bottleneck", "single server", "memory", "connection", "cpu", "query", "slow")],
     "model": "Describe the path of one request: the client sends an API call, the server authenticates it, runs the business logic, reads or writes the database and returns a response the client renders. Then name the first bottleneck, usually the database or a single server, and what you would add: indexes, caching, a load balancer with more instances, or a queue for slow work."},
    {"id": "dev-choice", "q": "Why did you choose that tech stack for your main project? What was the alternative, and what would have been worse about it?",
     "points": [kp("Gives a reason tied to the project's needs", "because", "needed", "requirement", "fit", "suited", "since"), kp("Names an alternative and a trade-off", "instead", "alternative", "compared", "trade", "could have", "rather than", "versus", "other option")],
     "follow": "What is one technical decision in that project you would reverse today?", "fpoints": [kp("Names a specific decision and what they would do instead", "would", "instead", "should have", "change", "differently", "mistake", "refactor")],
     "model": "A strong answer ties each choice to a need of the project, names the realistic alternative and states the trade-off, for example choosing PostgreSQL over MongoDB because the data was relational and needed transactions. It also admits one decision you would change, showing you can judge your own work."},
    {"id": "dev-debug", "q": "Tell me about the hardest bug you hit in a project. How did you find the cause?",
     "points": [kp("Describes the symptom specifically", "error", "crash", "wrong", "fail", "slow", "not working", "bug", "issue"), kp("Describes a method: logs, debugger, reproducing, bisecting", "log", "debug", "reproduc", "print", "breakpoint", "bisect", "isolat", "step by step", "narrow")],
     "follow": "What did you change so that kind of bug cannot come back?", "fpoints": [kp("Test, validation, check or monitoring added", "test", "validat", "check", "monitor", "lint", "type", "assert", "review")],
     "model": "State the symptom, how you reproduced it, how you narrowed it down (logs, a debugger, removing parts until it disappeared), the root cause and the fix. Then say what stops it returning: a regression test, input validation or monitoring."},
]

BUGS = [
    {"id": "bug-binary-search", "language": "python",
     "code": "def binary_search(nums, target):\n    lo, hi = 0, len(nums)\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        elif nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n",
     "q": "I have put a short binary search in your editor. It crashes for some inputs. Read it and tell me what is wrong and when it fails.",
     "points": [kp("hi should start at len(nums) − 1", "len(nums) - 1", "length minus 1", "len minus 1", "minus one", "- 1", "last index", "n - 1", "n minus 1"), kp("Fails with index out of range when the target is larger than every element (or the list is empty)", "out of range", "out of bound", "index error", "indexerror", "larger than", "greater than", "not present", "empty")],
     "model": "hi starts at len(nums), one past the last index. When the target is larger than every element, or the list is empty, mid reaches len(nums) and nums[mid] raises an index error. Start hi at len(nums) − 1 (or keep hi exclusive and loop while lo < hi)."},
    {"id": "bug-async-loop", "language": "javascript",
     "code": "async function loadUsers(ids) {\n  const users = [];\n  ids.forEach(async (id) => {\n    const res = await fetch('/api/users/' + id);\n    users.push(await res.json());\n  });\n  return users;\n}\n",
     "q": "I have put a short JavaScript function in your editor. It always returns an empty array. Tell me why and how you would fix it.",
     "points": [kp("forEach does not wait for async callbacks, so the function returns before any fetch finishes", "foreach", "does not wait", "doesn't wait", "not wait", "before", "returns immediately", "not awaited", "doesn't await", "does not await"), kp("Fix with Promise.all and map, or a for…of loop with await", "promise.all", "promise all", "for of", "for...of", "for…of", "map")],
     "model": "forEach ignores the promises returned by its async callback, so loadUsers returns the empty array before any fetch completes. Use await Promise.all(ids.map(async id => …)) to run them in parallel, or a for…of loop with await to run them one by one."},
    {"id": "bug-sql-injection", "language": "python",
     "code": "def find_user(db, email):\n    query = \"SELECT id, name FROM users WHERE email = '\" + email + \"'\"\n    return db.execute(query).fetchone()\n",
     "q": "I have put a short database function in your editor. It works, but I would not let it into production. What is the problem and what is the fix?",
     "points": [kp("SQL injection through string concatenation", "sql injection", "injection", "concatenat", "inject"), kp("Use parameterised queries or prepared statements", "parameter", "prepared", "placeholder", "bind", "orm", "?")],
     "model": "The email is concatenated straight into the SQL, so input such as ' OR '1'='1 changes the query: classic SQL injection. Use a parameterised query, for example db.execute(\"SELECT id, name FROM users WHERE email = ?\", (email,)), so the value is never parsed as SQL."},
]

# ----------------------------------------------------------------- Core CS
CORE = [
    {"id": "os-process-thread", "topic": "Operating systems", "q": "What is the difference between a process and a thread?",
     "points": [kp("A process has its own address space; threads share the process's memory", "address space", "own memory", "share memory", "shared memory", "separate memory", "same memory", "shares"), kp("Threads are lighter to create and switch; each has its own stack", "lighter", "lightweight", "own stack", "context switch", "faster", "cheaper")],
     "follow": "Two threads increment the same counter a million times each and the total is wrong. Why, and how do you fix it?", "fpoints": [kp("Race condition: increment is not atomic; use a lock, mutex or atomic", "race", "atomic", "lock", "mutex", "synchron", "critical section")],
     "model": "A process is a running program with its own address space and resources. Threads live inside a process and share its memory and files, while each has its own stack and registers, so they are cheaper to create and switch. Sharing causes race conditions: counter++ is read, add, write, so two threads can overwrite each other. Protect it with a mutex or use an atomic operation."},
    {"id": "os-deadlock", "topic": "Operating systems", "q": "What is a deadlock, and what conditions must hold for one to happen?",
     "points": [kp("Processes wait on each other forever", "wait", "forever", "each other", "stuck", "circular", "indefinite"), kp("Names the conditions: mutual exclusion, hold and wait, no preemption, circular wait", "mutual exclusion", "hold and wait", "preemption", "circular wait")],
     "follow": "How would you prevent it in code that takes two locks?", "fpoints": [kp("Always acquire locks in the same order, or use a timeout", "same order", "order", "timeout", "try lock", "trylock", "hierarchy")],
     "model": "A deadlock is a set of processes each waiting for a resource another holds, so none can proceed. It needs four conditions together: mutual exclusion, hold and wait, no preemption and circular wait. Break any one to prevent it; in practice, always take locks in the same global order, or use try-lock with a timeout."},
    {"id": "os-virtual-memory", "topic": "Operating systems", "q": "What is virtual memory, and what happens on a page fault?",
     "points": [kp("Each process gets its own virtual address space mapped to physical memory through page tables", "virtual address", "page table", "map", "illusion", "abstraction", "more memory than"), kp("On a page fault the OS loads the page from disk into a frame, possibly evicting another", "disk", "load", "swap", "bring", "evict", "frame", "trap")],
     "follow": "What is thrashing?", "fpoints": [kp("The system spends more time swapping pages than doing work", "swap", "more time", "paging", "constantly", "too many page fault")],
     "model": "Virtual memory gives each process its own address space, mapped page by page to physical frames by page tables, so processes are isolated and can use more memory than is physically present. A page fault happens when a page is not in RAM: the OS traps, loads the page from disk into a free frame (evicting another if needed) and resumes. Thrashing is when memory is so overcommitted that the system spends most of its time paging."},
    {"id": "db-acid", "topic": "DBMS", "q": "What do the ACID properties of a transaction mean?",
     "points": [kp("Atomicity: all or nothing", "atomic", "all or nothing", "all or none"), kp("Consistency and isolation", "consisten", "isolat"), kp("Durability: committed data survives a crash", "durab", "survive", "crash", "permanent", "persist")],
     "follow": "Which of those does a bank transfer need most, and what goes wrong without it?", "fpoints": [kp("Atomicity (money debited but not credited) or isolation (double spending)", "atomic", "debit", "credit", "deduct", "lost", "half", "isolation", "double", "partial")],
     "model": "Atomicity: a transaction's changes all happen or none do. Consistency: it moves the database from one valid state to another. Isolation: concurrent transactions do not see each other's partial work. Durability: once committed, changes survive a crash. A bank transfer without atomicity can debit one account and never credit the other."},
    {"id": "db-normalisation", "topic": "DBMS", "q": "What is normalisation, and why would you ever denormalise?",
     "points": [kp("Organising tables to remove redundancy and update anomalies", "redundan", "duplicate", "anomal", "repeat"), kp("Denormalise for read speed, fewer joins", "join", "read", "performance", "faster", "speed")],
     "follow": "What does it mean for a table to be in third normal form?", "fpoints": [kp("No transitive dependency: non-key columns depend only on the key", "transitive", "only on the key", "depend on the primary", "non-key", "non key", "nothing but the key")],
     "model": "Normalisation splits data into tables so each fact is stored once, removing redundancy and the insert, update and delete anomalies it causes. A table is in third normal form when every non-key column depends on the key, the whole key and nothing but the key (no transitive dependencies). Denormalising deliberately duplicates data to avoid joins and speed up reads, at the cost of harder writes."},
    {"id": "db-joins", "topic": "DBMS", "q": "What is the difference between an inner join and a left join?",
     "points": [kp("Inner returns only matching rows from both tables", "only match", "matching rows", "both table", "common", "intersection"), kp("Left returns all rows from the left table, with NULLs where there is no match", "all rows from the left", "all the rows", "null", "even if", "no match", "every row")],
     "follow": "How would you find customers who have never placed an order?", "fpoints": [kp("Left join orders and filter where the order is NULL, or NOT EXISTS", "is null", "null", "not exists", "not in", "left join")],
     "model": "An inner join returns only rows that match in both tables. A left join returns every row of the left table, with NULLs for the right table's columns where there is no match. To find customers with no orders: left join orders on customer id and keep rows where the order id is NULL, or use NOT EXISTS."},
    {"id": "cn-url", "topic": "Computer networks", "q": "What happens, step by step, when you type a URL into the browser and press Enter?",
     "points": [kp("DNS resolves the name to an IP address", "dns"), kp("TCP connection (and TLS handshake for HTTPS)", "tcp", "handshake", "tls", "ssl"), kp("HTTP request, server response, browser renders", "http", "request", "response", "render")],
     "follow": "Why does HTTPS need a certificate?", "fpoints": [kp("To prove the server's identity and set up encryption; signed by a trusted authority", "identity", "trust", "certificate authority", "ca", "authentic", "public key", "verify", "man in the middle")],
     "model": "The browser resolves the domain to an IP address with DNS, opens a TCP connection with a three-way handshake and, for HTTPS, performs a TLS handshake. It then sends an HTTP request; the server responds, and the browser parses the HTML, fetches other resources and renders the page. The certificate, signed by a trusted authority, proves the server is who it claims to be and carries the public key used to set up encryption."},
    {"id": "cn-tcp-udp", "topic": "Computer networks", "q": "What is the difference between TCP and UDP, and give one application for each.",
     "points": [kp("TCP is connection-oriented and reliable: ordering, retransmission", "reliable", "connection-oriented", "connection oriented", "order", "retransmi", "acknowledg", "handshake"), kp("UDP is connectionless, faster, no delivery guarantee", "connectionless", "no guarantee", "faster", "unreliable", "lightweight", "not guarantee"), kp("Gives fitting examples", "video", "stream", "gaming", "game", "dns", "voip", "call", "web", "http", "email", "file")],
     "follow": "Why would a video call prefer UDP even though packets can be lost?", "fpoints": [kp("A late packet is useless; retransmission adds delay", "late", "delay", "latency", "real-time", "real time", "retransmi", "lag")],
     "model": "TCP sets up a connection and guarantees ordered, reliable delivery with acknowledgements, retransmission and congestion control; it suits web pages, email and file transfer. UDP just sends datagrams with no guarantees and little overhead; it suits video calls, games and DNS. In a call, a retransmitted packet arrives too late to be useful, so low delay matters more than completeness."},
    {"id": "cn-http-status", "topic": "Computer networks", "q": "HTTP is called stateless. What does that mean, and how does a site still keep you logged in?",
     "points": [kp("Each request is independent; the server keeps no memory of earlier requests", "independent", "no memory", "does not remember", "doesn't remember", "each request", "not store"), kp("Sessions with cookies, or tokens sent on every request", "cookie", "session", "token", "jwt")],
     "follow": "What is the difference between a 401 and a 403 response?", "fpoints": [kp("401: not authenticated; 403: authenticated but not allowed", "not authenticated", "unauthenticated", "not logged", "not allowed", "forbidden", "permission", "unauthori", "who you are")],
     "model": "Stateless means each HTTP request stands alone; the server does not remember earlier ones. Login state is carried by the client on every request, as a session id in a cookie that the server looks up, or as a signed token. 401 means you have not proved who you are; 403 means the server knows who you are and you are not allowed."},
    {"id": "oop-pillars", "topic": "OOP", "q": "Explain polymorphism with a real example from code you have written.",
     "points": [kp("Same interface or method call, different behaviour by object type", "same method", "same interface", "different behav", "different implement", "many forms", "depending on the object", "depending on the type"), kp("Mentions overriding or overloading (run-time or compile-time)", "overrid", "overload", "runtime", "run-time", "run time", "compile", "virtual", "dynamic")],
     "follow": "What is the difference between overloading and overriding?", "fpoints": [kp("Overloading: same name, different parameters, same class, compile time. Overriding: subclass redefines, run time", "parameter", "signature", "subclass", "child class", "compile", "run time", "runtime", "same class", "inherit")],
     "model": "Polymorphism lets one call behave differently depending on the object's actual type: for example, calling area() on a list of Shape objects runs Circle's or Rectangle's version. Overriding is a subclass redefining a parent's method, chosen at run time. Overloading is several methods with the same name but different parameters in one class, chosen at compile time."},
    {"id": "oop-encapsulation", "topic": "OOP", "q": "What is encapsulation, and how is it different from abstraction?",
     "points": [kp("Encapsulation: bundling data with methods and restricting direct access", "private", "bundl", "hide data", "hiding data", "access modifier", "getter", "restrict", "data hiding"), kp("Abstraction: exposing what an object does while hiding how", "what", "how", "interface", "implementation detail", "essential", "hide complex", "hiding complex")],
     "follow": "Why is making every field public a problem in a large codebase?", "fpoints": [kp("Anyone can put the object in an invalid state; changing internals breaks callers", "invalid", "break", "depend", "coupl", "any code can", "anyone can", "control", "validation")],
     "model": "Encapsulation keeps an object's data private and exposes methods that guard it, so the object controls its own state. Abstraction is about design: showing what something does through an interface while hiding how. With public fields any code can set invalid values, and every caller depends on the internal layout, so changing it breaks them."},
    {"id": "oop-solid", "topic": "OOP", "q": "What is the single responsibility principle? Give an example of a class that breaks it.",
     "points": [kp("A class should have one reason to change", "one reason", "single reason", "one responsibility", "one job", "only one", "one thing"), kp("Example of mixed concerns", "and also", "also", "both", "database", "email", "print", "validation", "saves", "sends")],
     "follow": "What do you gain by splitting it?", "fpoints": [kp("Easier testing, reuse and safer changes", "test", "reuse", "maintain", "change", "readable", "decoupl")],
     "model": "The single responsibility principle says a class should have only one reason to change. A User class that validates input, saves itself to the database and sends a welcome email breaks it: a change to email, storage or validation all touch the same class. Splitting it into a validator, a repository and a mailer makes each part easier to test, reuse and change safely."},
]

BEHAVIOURAL = [
    {"id": "beh-conflict", "q": "Tell me about a time you disagreed with a teammate on a project. What did you do?",
     "points": [kp("Describes a specific situation", "project", "team", "when", "we", "teammate", "member"), kp("Describes their own action and the outcome", "i ", "discuss", "decided", "result", "finally", "agreed", "compromise", "data", "tried both")],
     "model": "Use situation, task, action, result. Name the disagreement, what you did to resolve it (listened, compared options with evidence, agreed on a test) and the outcome, including what you learned."},
    {"id": "beh-deadline", "q": "Tell me about a deadline you were about to miss. What did you do?",
     "points": [kp("Describes a specific situation", "deadline", "project", "submission", "exam", "hackathon", "time"), kp("Describes prioritising, cutting scope or asking for help, and the result", "priorit", "scope", "help", "divide", "split", "cut", "focus", "plan", "result", "delivered", "submitted")],
     "model": "Describe the deadline, how you decided what mattered most, what you cut or asked help with, how you kept others informed, and the result. Owning a partial miss honestly is better than a perfect story."},
    {"id": "beh-learn", "q": "Tell me about something technical you had to learn quickly. How did you go about it?",
     "points": [kp("Names what and why", "learn", "needed", "had to", "new"), kp("Describes a method: docs, small project, asking, practice", "document", "docs", "tutorial", "built", "small project", "practice", "asked", "course", "read")],
     "model": "Name the technology and the reason, then your method: official docs first, a small working example, then applying it to the real task, and how you checked your understanding."},
    {"id": "beh-failure", "q": "Tell me about a project or decision that did not go well. What would you do differently?",
     "points": [kp("Admits a real failure", "fail", "wrong", "mistake", "did not", "didn't", "problem", "bug"), kp("States a concrete lesson", "learn", "next time", "now i", "since then", "differently", "would")],
     "model": "Pick a real failure, take responsibility for your part, and state the specific change you have made since. Interviewers look for honesty and learning, not a flawless record."},
]


def public_problem(problem: dict) -> dict:
    tests = expand_tests(problem)[: problem["samples"]]
    return {
        "id": problem["id"], "title": problem["title"], "statement": problem["statement"],
        "input": problem["input"], "output": problem["output"], "constraints": problem["constraints"],
        "samples": [{"input": i, "output": o} for i, o in tests],
    }
