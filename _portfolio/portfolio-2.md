---
title: "RLStudio — Reinforcement Learning from Scratch, in the Browser"
excerpt: "An interactive course that builds reinforcement learning from the ground up. Every algorithm is paired with the same grid-world example, visualized and runnable directly in the browser — no install required."
collection: portfolio
link: https://rickliang-jy.github.io/RLStudio/
thumb_label: "RL"
---

**RLStudio** takes you from zero to reinforcement learning. Every algorithm is paired with the same grid-world example, visualized and runnable directly in the browser.

[Live Site](https://rickliang-jy.github.io/RLStudio/)

## Contents

- **Foundations · Mathematical Principles of RL** — implementations of Chapters 1–10 of Shiyu Zhao's *Mathematical Foundation of Reinforcement Learning* (Bellman equations, value/policy iteration, Monte Carlo, temporal-difference learning, value-function approximation / DQN, policy gradient, Actor-Critic).
- **Worked examples from the book** — the classic figures reproduced as interactive demos.
- **Playground** — a custom grid world where you can tweak the map and parameters on the fly.
- **Advanced (planned)** — PPO / GRPO / DPO.
- **Notes** — PDF write-ups on design and theory.

## How it runs

Notebooks are written with [marimo](https://marimo.io). The site renders each chapter with marimo's WebAssembly so it runs entirely in the browser; chapters that use PyTorch (Chapter 8, DQN) run on a real kernel via [molab](https://molab.marimo.io).
