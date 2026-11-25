from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

GOOD = """Aarav Sharma
aarav.sharma@example.com | +91 98765 43210 | github.com/aaravsharma | linkedin.com/in/aaravsharma

EDUCATION
B.Tech in Computer Science, Example Institute of Technology          Aug 2023 - May 2027
CGPA 8.4 / 10

SKILLS
Languages: Python, Java, JavaScript, SQL
Backend: Node.js, Express, FastAPI, REST API
Databases: PostgreSQL, MongoDB, Redis
Tools: Git, Docker, AWS, Linux
CS fundamentals: Data Structures, Algorithms, Operating Systems, DBMS, Computer Networks, OOP

PROJECTS
ChatWave - real-time chat app | Node.js, Express, Redis, WebSockets, MongoDB
- Built a chat server handling 500 concurrent users with WebSockets and Redis pub/sub
- Reduced message latency by 40% by caching recent conversations in Redis
- Implemented JWT login with refresh tokens and rate limiting
ShopLite - e-commerce API | FastAPI, PostgreSQL, Docker
- Designed 14 REST API endpoints with transactions for order placement
- Deployed on AWS EC2 with Docker and cut build time by 60%
- Wrote 85 unit tests covering payment and inventory logic

EXPERIENCE
Software Engineering Intern, Example Labs          Jun 2026 - Aug 2026
- Developed an internal dashboard used by 30 engineers with React and Node.js
- Optimized a slow SQL query from 4 seconds to 300 ms by adding an index

ACHIEVEMENTS
- Solved 450 problems on LeetCode; rated 1650 on Codeforces
"""
WEAK = """My Resume
I am a student looking for a job. I know computers and coding.
I did a project in college about a website. It was a group project and we made pages.
Responsible for doing work in the team and helping others with tasks whenever needed in the project.
"""

def make(path, text):
    c = canvas.Canvas(path, pagesize=A4)
    y = 800
    for line in text.splitlines():
        c.setFont("Helvetica", 10)
        c.drawString(40, y, ("• " + line[2:]) if line.startswith("- ") else line)
        y -= 14
    c.save()

if __name__ == "__main__":
    import sys
    make(sys.argv[1] + "/good.pdf", GOOD)
    make(sys.argv[1] + "/weak.pdf", WEAK)
