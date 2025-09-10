---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Education
======
<!-- * Ph.D in Version Control Theory, GitHub University, 2018 (expected) -->
* M.S. in Applied Data Science, University of Chicago, 2025(expected)
* B.S. in Financial Mathematics, Beijing-Normal-Hong Kong Baptist University(BNBU), 2024
* Summer School: University of Oxford, 2022

Research experience
======
* 4/2025 – Present: Accelerating Adaptive Algorithms At Scale through Reparameterization
  * Supervisor: Prof. Rebecca Willett (The University of Chicago)
  * Role: Research Assistant
  * **Implemented scalable approximations of EGOP**: built low-rank estimation and periodic reparameterization modules based on auxiliary EGOP and randomized SVD, enabling faster convergence of Adam/Adagrad in large-scale model training without significant computational overhead.
  * **Conducted hyperparameter search and ablation studies on Fashion-MNIST, TinyMNIST, and EMNIST (Letters/Digits)**, comparing models with/without reparameterization, different optimizers, and learning-rate schedules; reported convergence speed, validation accuracy, memory footprint, and runtime to ensure reproducibility of results.
  * Related work: [Faster Adaptive Optimization via Expected Gradient Outer Product Reparameterization](https://arxiv.org/abs/2502.01594) 


* 4/2025 – Present: Pathology Multi-Agent RAG with ARPO-Based Policy Optimization  
  * Supervisor: Prof. Utku Pamuksuz (The University of Chicago)
  * Role: Data Scientist
  * Initiated and led the overall design of a “**Multi-Agent RAG + ARPO**” framework in the pathology domain: applied ARPO to focus on branching exploration and step-level credit assignment at high-uncertainty tool steps, strengthening strategy learning for which agent acts, when to act, and which retrieval method to use.

* 4/2025 – Present: Deep Assortment Optimization  
  * Supervisor: Prof. Rui Gao (The University of Texas at Austin)
  * Role: Research Intern
  * Transformed discrete assortment selection into subset distribution learning, applying continuous relaxations (STGS/SIMPLE/NCPSS/SFESS) and permutation-invariant autoregressive modeling with RNN, enabling differentiable optimization under k-subset constraints.


<!-- * Summer 2015: Research Assistant
  * GitHub University
  * Duties included: Tagging issues
  * Supervisor: Professor Git -->

Work experience
======
* Summer 2023: Assistant for Marketing and Sales Analysis
  * Exion Asia (HuiZhou) Co.,Ltd
  * Duties includes: analyze large datasets, derive key insights and patterns
  <!-- * Supervisor: The Users -->

* Summer 2022: Customer Service Manager  
  * Bank of Communications Huizhou Branch
  * Duties included: Guided customers in their banking services
  <!-- * Supervisor: Professor Hub -->

<!-- * Summer 2015: Research Assistant
  * GitHub University
  * Duties included: Tagging issues
  * Supervisor: Professor Git -->
  
Skills
======
* Python, R, Matlab, C++, Github
* Machine Learning
  * NLP
  * Recommendation System
  <!-- * Sub-skill 2.3 -->
* Financial Modeling

Publications
======
  <ul>{% for post in site.publications reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
<!-- Talks
======
  <ul>{% for post in site.talks reversed %}
    {% include archive-single-talk-cv.html  %}
  {% endfor %}</ul>
  
Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul> -->
  
<!-- Service and leadership
======
* Currently signed in to 43 different slack teams -->
