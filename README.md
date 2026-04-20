# 🧪 PipeSort — Water Sort Puzzle

A **premium, gamer-friendly** water sort puzzle built with pure HTML, CSS, and JavaScript. Sort the colored liquids into matching tubes to win!

![PipeSort Preview](https://img.shields.io/badge/Status-Playable-22c55e?style=for-the-badge)
![HTML CSS JS](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS-00f7ff?style=for-the-badge)
![Responsive](https://img.shields.io/badge/Responsive-Yes-a855f7?style=for-the-badge)

---

## 🎮 How to Play

1. **Click a tube** to select it (it glows cyan when selected)
2. **Click another tube** to pour the top layer of liquid into it
3. You can only pour onto a **matching color** or an **empty tube**
4. A tube can hold **4 layers** maximum
5. **Win** when every tube contains only one color!

---

## ✨ Features

### 🎨 UI / Design
- Dark neon **glassmorphism** theme with deep space background
- **Floating particle** canvas animation in the background
- **Orbitron** + **Rajdhani** Google Fonts for a premium gamer look
- Smooth animations on tube selection, pouring, and win screen
- **Neon glow** effects with unique color per difficulty

### 🕹️ Gameplay
| Difficulty | Colors | Tubes | Hints |
|---|---|---|---|
| Easy       | 3      | 5     | 3     |
| Medium     | 4      | 6     | 3     |
| Hard       | 5      | 7     | 3     |
| Very Hard  | 6      | 8     | 2     |
| Expert     | 8      | 10    | 2     |
| Legendary  | 10     | 12    | 1     |

### 🛠️ Game Controls
| Action | Button / Key |
|---|---|
| Select / pour tube | Click / tap |
| Undo last move | ↩ button or `Z` |
| Use a hint | 💡 button or `H` |
| Restart level | 🔄 button or `R` |
| Return to menu | 🏠 button or `Esc` |

### 🏆 Progression
- **Live timer** per level
- **Move counter** tracked in real time
- **⭐ Star rating** on win (based on moves vs par)
- **Best score** (moves) saved per difficulty
- **Total wins** and **total moves** tracked globally
- **Confetti burst** on win screen
- **Progress bar** showing % of tubes completed

---

## 📁 Project Structure

```
pipe game/
├── index.html   # Game layout — menu, HUD, win screen, rules modal
├── style.css    # Dark neon glassmorphism theme, animations, responsive grid
├── main.js      # Game engine — 6 levels, pour logic, undo, hints, timer, localStorage
└── README.md
```

---

## 🚀 Getting Started

No build step needed — just open `index.html` in any modern browser:

```bash
# Clone the repo
git clone https://github.com/Vasoyasharan/Pipe-Game.git

# Open the game
cd "Pipe-Game"
open index.html        # macOS
xdg-open index.html   # Linux
start index.html       # Windows
```

---

## 🌐 Browser Support

Works in all modern browsers — Chrome, Firefox, Edge, Safari.

---

## 👤 Author

Made by [@sharan_vasoya_07](https://instagram.com/sharan_vasoya_07)

---

## 📄 License

[MIT](./LICENSE)
