# NovaDesk — Local AI Customer Support

NovaDesk is a responsive customer-support help center with searchable guides, topic cards, FAQ management, conversation history, and a private browser-based assistant. It is built with plain HTML, CSS, and JavaScript, and needs no AI API key, account, server, or build step.

## Try it

**Live app:** [Open NovaDesk on GitHub Pages](https://surajshukla22051-prog.github.io/ai-customer-support-chatbot/)

To run it locally, download or clone this repository and open `index.html` in a modern browser. You can also open the folder in VS Code and use Live Server.

## Features

- **Browser-based local AI:** scores question words against FAQ questions, answers, and keywords; includes simple greeting/help handling and a clear fallback when it cannot find a reliable answer.
- **FAQ manager:** add, edit, delete, and search support answers; updated FAQs are available to the assistant immediately.
- **Conversation history:** browse, search, inspect, export, or clear locally saved chats.
- **Workspace backup:** download FAQs and conversation history as a JSON file.
- **Help center:** browse topic collections, search curated support guides and your FAQs, and open readable article pages.
- **Local answers:** follow an article by asking the assistant a question matched against the FAQ library.
- **Responsive dashboard:** works on desktop, tablet, and mobile screen sizes.
- **Privacy-first by design:** FAQ data and chat history are stored in this browser's local storage; the app makes no AI API calls.

## What "AI without an API" means

NovaDesk uses local text normalization, related-word matching, and FAQ relevance scoring. It is a small retrieval-based assistant—not a generative large language model. It can only answer from the FAQ content you provide, and it will say when it cannot find a good match. No API key or paid AI service is needed.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Help-center pages, chat, FAQ manager, and article dialogs |
| `styles.css` | Responsive help-center interface and visual effects |
| `app.js` | Article search, local matching, FAQ management, chat history, and export |
| `.github/workflows/pages.yml` | Automatically publishes the static site to GitHub Pages on pushes to `main` |

## Data and privacy

Data is saved in the browser's local storage on the current device and browser profile. It is not automatically shared between devices or browsers. Clearing browser site data removes the saved FAQs and conversations, so use the JSON export to keep a backup. Do not enter real customer secrets or sensitive personal information into a demo workspace.

## Built with

HTML · CSS · Vanilla JavaScript · Browser local storage
