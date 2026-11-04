# Buzzyfly Ventures

An AI company for [Paperclip](https://github.com/paperclipai/paperclip) that
**finds what people already pay for, builds it as a web app on buzzyfly.com,
and sells it through free channels.** The goal is $100,000 a month across a
portfolio of small businesses, built one tested launch at a time.

## How it works (hub-and-spoke)

The CEO sets priorities and delegates. Each specialist reports back.

```
Owner
└── CEO ─ picks ideas, writes briefs, weekly review, shuts down losers
    ├── Market Researcher ─ proof of demand, scored opportunity reports
    ├── Builder ─ ships each business on a *.buzzyfly.com subdomain
    └── Growth Marketer ─ free search pages, communities, partners, 1:1 email
```

| Agent | Reports to | Skills |
| --- | --- | --- |
| CEO | Owner | paperclip, find-what-sells |
| Market Researcher | CEO | paperclip, find-what-sells |
| Builder | CEO | paperclip, build-buzzyfly-app |
| Growth Marketer | CEO | paperclip, free-growth-outreach |

**Projects:** Study Plan (first 100 sales for paperclip.buzzyfly.com) and
Venture Pipeline (find → score → build → launch).
**Routines:** weekly portfolio review (Mon), daily free outreach (Mon–Fri).

## Hard rules

$0 ad spend. No copying other companies. No fake reviews or income promises.
No spam, robocalls or unsolicited texts. Full list in `COMPANY.md`.

## Getting started

1. Install Node.js 24.11+ and run `npx paperclipai@latest onboard --yes`.
2. Import this company:
   `npx paperclipai company import --from ./buzzyfly-ventures`
3. Pick an AI provider for the agents (Claude Code, Codex, etc.) when asked.
   Agents use AI credits on your account while they work. Set a budget in Paperclip.
4. Give the Builder a `GH_TOKEN` so it can open pull requests.
5. Connect an email tool if you want the Growth Marketer to send emails
   itself. Otherwise it drafts them for you.

References: [Agent Companies spec](https://agentcompanies.io/specification) ·
[Paperclip](https://github.com/paperclipai/paperclip)

Generated with the company-creator skill from [Paperclip](https://github.com/paperclipai/paperclip).
