# https://priyanshu92012.github.io/

Personal portfolio — Priyanshu, DHBW Stuttgart / Nokia Stuttgart (Optics).

🔗 **Live:** https://priyanshu92012.github.io/ *(replace with custom domain if used)*

## Stack

Static HTML + Tailwind CSS via CDN. No build step. GitHub Pages auto-deploys from the `main` branch root.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

That's it. No `npm install`, no watcher, no transpiler.

## Adding a new project page

1. `cp projects/_template.html projects/<slug>.html`
2. Edit hero, problem, architecture, results sections
3. Add a tile to `index.html` linking to the new page
4. Update `HANDOFF.md` with what changed
5. `git add . && git commit -m "add <slug> project page" && git push`

GitHub Pages will redeploy in ~30 seconds.

## File structure

```
.
├── CLAUDE.md          AI assistant context (auto-read by Claude Code)
├── HANDOFF.md         Cross-session continuity log
├── DECISIONS.md       Locked design / content decisions
├── README.md          This file
├── index.html         Landing page
├── about.html         Bio, skills, contact
├── cv.pdf             Downloadable CV
├── projects/          Case study pages
└── assets/            Images, downloadable files
```

## AI workflow

This repo uses a deliberate context-sharing pattern between claude.ai chats and Claude Code in VS Code. See `CLAUDE.md` for the canonical project context, and `HANDOFF.md` for what's currently in flight. Both files are read at the start of every session, both are updated at the end.

## License

Code: MIT. Content (project writeups, bio, CV): all rights reserved.
