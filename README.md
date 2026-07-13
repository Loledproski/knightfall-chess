<h1 align="center">♞ Knightfall Chess</h1>

<p align="center">
<b>Play the move. Know the story.</b><br>
A modern multiplayer chess platform featuring AI opponents, real-time online matchmaking, multiple time controls, handcrafted board themes, and Stockfish-powered game analysis.
</p>

<p align="center">

<a href="https://knightfall-chess.onrender.com">
<img src="https://img.shields.io/badge/▶%20PLAY%20KNIGHTFALL-CCFF4D?style=for-the-badge&labelColor=10241B&color=CCFF4D">
</a>

<a href="https://github.com/Loledproski/knightfall-chess">
<img src="https://img.shields.io/badge/SOURCE%20CODE-173026?style=for-the-badge&logo=github&logoColor=white">
</a>

<a href="https://github.com/Loledproski/knightfall-chess/releases">
<img src="https://img.shields.io/badge/LATEST%20RELEASE-v1.0-2E7D32?style=for-the-badge">
</a>

</p>

<p align="center">

<img src="https://img.shields.io/badge/License-MIT-2E7D32?style=flat-square">
<img src="https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
<img src="https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white">
<img src="https://img.shields.io/badge/WebSocket-Real--Time-2563EB?style=flat-square">
<img src="https://img.shields.io/badge/Stockfish-18-B45309?style=flat-square">
<img src="https://img.shields.io/badge/Hosted%20on-Render-173026?style=flat-square&logo=render&logoColor=white">

</p>

<p align="center">

<a href="#highlights">Highlights</a> •
<a href="#about">About</a> •
<a href="#features">Features</a> •
<a href="#screenshots">Screenshots</a> •
<a href="#technology-stack">Tech Stack</a> •
<a href="#run-locally">Run Locally</a> •
<a href="#future-roadmap">Roadmap</a>

</p>

---

<p align="center">
<img src="screenshots/demo.gif" width="100%">
</p>

---

# Highlights

- ♟ Real-Time Online Multiplayer
- 🤖 10-Level AI Challenge Ladder
- 👑 Unlock Five Legendary Opponents
- 🧠 Stockfish 18 Browser Analysis
- 🎬 Interactive Replay System
- 📈 Color-Coded Move Classification
- ⏱ Four Time Controls (1, 5, 30 & 60 Minutes)
- 🎨 Six Handcrafted Board Themes
- 🌙 Light & Dark Mode
- ⚡ Fast, Lightweight & Built with Vanilla JavaScript

---

# About
# 📖 About

Knightfall Chess is a modern browser-based chess platform designed to combine competitive gameplay with educational analysis. Inspired by professional online chess platforms while maintaining its own unique identity, Knightfall allows players to enjoy local games, challenge progressively stronger AI opponents, or compete online through real-time WebSocket matchmaking.

Every completed game can be reviewed using the integrated Stockfish 18 engine, providing detailed engine evaluations, interactive replay controls, color-coded move classifications, and clear explanations that help players understand every decision they make.

Built with HTML, CSS, Vanilla JavaScript, Node.js, WebSockets, and WebAssembly, Knightfall delivers a lightweight yet feature-rich chess experience entirely inside the browser.

---

# ✨ Features

## ♟ Gameplay

- Local Pass-and-Play Chess
- Real-Time Online Multiplayer
- Multiple Time Controls
- Live Chess Clocks
- Complete Chess Rules
- Castling
- En Passant
- Pawn Promotion
- Checkmate, Draw & Stalemate Detection

---

## 🤖 AI Challenge

- 10 Progressive AI Difficulty Levels
- Beginner → Master Ladder
- Five Unlockable Legendary Opponents
- Elo-Based Difficulty Progression

---

## 🌍 Online Multiplayer

- WebSocket Matchmaking
- Live Move Synchronization
- Shared Game State
- Automatic Opponent Pairing
- Multiple Time Controls
- Low-Latency Multiplayer Experience

---

## 📊 Stockfish Analysis

- Stockfish 18 WebAssembly Engine
- Engine Evaluation
- Best Move Detection
- Color-Coded Move Quality
- Interactive Replay
- Dark Analysis Interface
- Engine Explanations
- Smooth Replay Controls

### Move Classification

- Brilliant
- Great
- Best
- Excellent
- Good
- Book
- Inaccuracy
- Mistake
- Blunder
- Miss

---

## 🎨 Customization

- Classic Theme
- Medieval Theme
- Sci-Fi Theme
- Nature Theme
- Luxury Theme
- Fun Theme
- Light & Dark Mode
- Responsive Layout
- Modern Animations

---

# 📸 Screenshots

## 🏠 Landing Page

Modern homepage introducing Knightfall.

![Landing Page](screenshots/landing-page.png)

---

## 🌍 Online Matchmaking

Automatically pair with players using WebSocket matchmaking.

![Online Matchmaking](screenshots/online-matchmaking.png)

---

## ⏱ AI Match Setup

Choose your time control, side, AI difficulty and board theme.

![AI Setup](screenshots/ai-settings.png)

---

## ♟ Gameplay

Play with live timers, move coaching and responsive controls.

![Gameplay](screenshots/gameplay.png)

---

## 📊 Stockfish Analysis

Review every move with Stockfish-powered engine evaluations and detailed explanations.

![Analysis](screenshots/analysis.png)

---

## 🎬 Interactive Replay

Replay games with move navigation and color-coded evaluations.

![Replay](screenshots/replay.png)

---

## 🎨 Board Themes

Instantly switch between six handcrafted board themes.

![Themes](screenshots/themes.gif)

---

# 📊 Feature Overview

| Feature | Knightfall |
|---------|:----------:|
| AI Opponents | ✅ |
| Online Multiplayer | ✅ |
| Stockfish Analysis | ✅ |
| Interactive Replay | ✅ |
| Multiple Time Controls | ✅ |
| Board Themes | ✅ |
| Light & Dark Mode | ✅ |
| Responsive UI | ✅ |

---

# 🛠 Technology Stack

<p align="center">

<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white">

<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white">

<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">

<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white">

<img src="https://img.shields.io/badge/WebSocket-2563EB?style=for-the-badge">

<img src="https://img.shields.io/badge/Stockfish-18-B45309?style=for-the-badge">

</p>

---

# 📂 Project Structure

```text
Knightfall Chess
│
├── engine/
│   └── Stockfish 18
│
├── screenshots/
│
├── index.html
├── styles.css
├── app.js
├── server.js
├── package.json
├── Dockerfile
├── LICENSE
└── README.md
```

---

# 🚀 Run Locally

```bash
git clone https://github.com/Loledproski/knightfall-chess.git
cd knightfall-chess
npm install
npm start
```

Open:

```
http://localhost:3000
```

---

# 🚀 Future Roadmap

### Competitive

- Elo Rating System
- Ranked Matchmaking
- Global Leaderboards
- Tournament Mode

### Social

- User Authentication
- Friends System
- Private Rooms
- Spectator Mode

### Analysis

- Opening Explorer
- Endgame Trainer
- Puzzle Mode
- Match History

### Platform

- Cloud Save
- Progressive Web App (PWA)
- Mobile Optimization
- Custom Piece Sets

---

# 📜 License

Licensed under the MIT License.

---

# ❤️ Acknowledgements

- Stockfish Chess Engine
- Node.js
- Render
- GitHub

---

<p align="center">

Made with ❤️ by <b>Harsh Mishra</b>

⭐ If you enjoyed Knightfall Chess, consider giving this repository a star!

</p>
