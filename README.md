# Ta5mena (Top 10)

A real-time online multiplayer party game built with Vanilla JavaScript, HTML5, CSS3, and Firebase Realtime Database.

## Live Demo
Play online: [https://omarreldeeb.github.io/Ta5mena/](https://omarreldeeb.github.io/Ta5mena/)

## Overview
Ta5mena is a turn-based guessing game where players rank their Top 10 favorites in a chosen category (Singers, Footballers, or Actors) from #1 (1 point) to #10 (10 points). Opponents take turns guessing entries on each other's lists to score points.

## Features
- **Real-Time Multiplayer**: Instant synchronization via Firebase Realtime Database with zero Node.js server required.
- **3-Layer Verification Engine**:
  1. Exact Normalized Matching (strips prefixes, punctuation, and normalizes Arabic diacritics).
  2. Fuzzy Levenshtein Matching for typos.
  3. Live Target Confirmation Popup fallback when spellings differ.
- **Hybrid Autocomplete**: Preloaded database of Egyptian, Arab, and International stars with dual-script English and Arabic search plus full free-text fallback.
- **Strict Anti-Vibe UI**: Flat, high-contrast Swiss-grid dark theme with sharp 4px corners and zero emojis.
- **Mobile-First**: Optimized for mobile browsers (`100dvh`, no auto-zoom on inputs).

## Local Development
Run a local static server inside this directory:
```bash
python3 -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.
