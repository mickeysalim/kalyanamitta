# Kalyanamitta Session Planner

A simple web app that helps Kalyanamitta facilitators plan a Dhamma discussion.

## Steps
1. **Topic**: topic ideas, then the topic, why, main question, opening questions (15–20 min), main points (40–45 min) and takeaway (10 min).
2. **Reading**: reading materials, personal notes, and 1–2 pre-reading sources for attendees.
3. **Summary**: generated from the answers. Copy or download it.

**AI helpers**
- *Copy AI prompt* / *Paste AI plan* on the Topic page.
- *Copy research prompt* / *Paste AI research* on the Reading page. The research prompt includes the Topic page answers.

The AI is asked to answer in the same format as the summary, so pasting its answer fills in the boxes.

Plans are saved automatically in the facilitator's own browser (localStorage). They are not shared between devices or people.

## Files
Plain HTML, CSS and JavaScript with no build step: `index.html`, `styles.css`, `app.js`.

## Run locally
Open `index.html` in a browser, or run `npx http-server . -p 8080`.

## Deploy
Any static host works. On Vercel, import this repo with no framework preset and no build command. On GitHub Pages, publish the `main` branch from the root folder.
