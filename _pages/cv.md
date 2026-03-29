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
* M.S. in Applied Data Science, University of Chicago, GPA: 4.0/4.0, 2025
* B.S. in Financial Mathematics, First Class Honours, Beijing Normal University-Hong Kong Baptist University United International College, GPA: 3.77/4.0, 2024
* Summer Course: Artificial Intelligence and Machine Learning (Grade: A), University of Oxford, 2022

Research Experience
======
* 4/2025 – Present: Accelerating Adaptive Algorithms At Scale through Reparameterization
  * Supervisor: [Prof. Rebecca Willett](https://willett.psd.uchicago.edu/) (The University of Chicago)
  * Role: Research Assistant
  * Implemented scalable approximations of EGOP: built low-rank estimation and periodic reparameterization modules based on auxiliary EGOP and randomized SVD, enabling faster convergence of Adam/Adagrad in large-scale model training without significant computational overhead.
  * Conducted hyperparameter search and ablation studies on Fashion-MNIST, TinyMNIST, EMNIST (Letters/Digits) and CIFAR10, comparing models with/without reparameterization, different optimizers.
  * Related work: [Faster Adaptive Optimization via Expected Gradient Outer Product Reparameterization](https://arxiv.org/abs/2502.01594)

* 4/2025 – Present: Neural Assortment Optimization
  * Supervisor: [Prof. Rui Gao](https://rgao32.github.io/) (The University of Texas at Austin)
  * Role: Research Intern
  * Developed a complete implementation of the Deep Assortment Optimization (DAO) framework, supporting both capacity-constrained and unconstrained formulations across three discrete choice model families—basic attraction model (BAM), nested logit (NL), and mixed logit (ML). The implementation incorporates Lovász extension-based continuous relaxation, stochastic subgradient estimation, and chain-based rounding procedures.

* 4/2025 – Present: Foundation Model Fine-tuning for Breast Cancer Biomarker Prediction \| **Honorable Mention**
  * Supervisor: [Prof. Utku Pamuksuz](https://datascience.uchicago.edu/people/utku-pamuksuz-phd/), Dr. Samir Atiya (The University of Chicago Capstone Project)
  * Role: Data Scientist
  * Adapting Direct Preference Optimization from natural language processing to computational pathology through self-supervised preference construction, enabling parameter-efficient fine-tuning of the TITAN foundation model for improved breast cancer biomarker prediction from whole slide images.

* 06/2023 – 12/2023: Examining the Impact of Macroeconomic Variables on the Correlations Between Carbon, Clean Energy, and CRB Markets
  * Supervisor: [Prof. Zhefang ZHOU](https://staff.uic.edu.cn/sherryzhou/en) (Beijing Normal University-Hong Kong Baptist University United International College)
  * Role: Data Scientist
  * Investigated how the macroeconomic factors have affected the long-term correlation between the carbon-clean, carbon industrial spot price and their volatility using GARCH-MIDAS and DCC-MIDAS models.

Publications
======
* Liu, Rui, **Jiayou Liang**, Haolong Chen, and Yujia Hu. 2025. "Analyst Reports and Stock Performance: Evidence from the Chinese Market." *Asia-Pacific Financial Markets*. [https://doi.org/10.1007/s10690-025-09522-w](https://doi.org/10.1007/s10690-025-09522-w)

Papers In Preparation
======
* Adela DePavia, Jose Cruzado, **Jiayou Liang**, Vasileios Charisopoulos, Rebecca Willett. *Faster Adaptive Optimization via Expected Gradient Outer Product Reparameterization.* (Submitted to SIMODS)
* Zhen Yang, **Jiayou Liang**, Yang An, Zhi Wang, Rui Gao, Shuang Li. *Neural Assortment Optimization.* (In prep)
* Samir Atiya, **Jiayou Liang**, Kwaku Ofori-Atta, Michelle Peng, Huili Wang, Yifei Zhou, Utku Pamuksuz, Ankush Patel, Junhun Zhao, Mary Edgertion. *Validating two pathological foundation models for breast biomarker detection.* (In prep)

Project Experience
======
* AI-Assisted Clinical Data Navigation Platform \| St. Jude Children's Research Hospital
  * Role: Data Scientist
  * Built an LLM agentic chat interface that lets researchers explore the Childhood Cancer Survivor Study (CCSS) via natural-language questions, automatically translating them to SQL and returning instant summary stats and visualizations across 15k+ de-identified variables and two cohorts (survivors, siblings). Deployed a secure PostgreSQL backend with controlled access, and wired it to LangChain agents and Azure Cognitive Search to accelerate pre-proposal exploration and variable discovery.

* [Cross Impact Analysis of Order Flow Imbalance OFI](https://github.com/rickliang-JY/Work-Trial-Task-Cross-Impact-Analysis-of-Order-Flow-Imbalance-OFI-) \| Programmer
  * Investigated Order Flow Imbalance (OFI) cross-impact in equity markets using high-frequency data from 5 Nasdaq 100 stocks across different sectors (AAPL, AMGN, TSLA, JPM, XOM). Computing multi-level OFI metrics up to 5 levels of the limit order book, using PCA to integrate multi-level OFIs into a unified metric, analyzing contemporaneous and lagged cross-asset impacts on price changes, and evaluating predictive power at 1-minute and 5-minute horizons.

Hackathon Project
======
* 10/2025: [AI-Assisted Clinical Data Navigation Platform](https://github.com/stjude-biohackathon/KIDS25-Team5)
  * Host: St. Jude Children's Research Hospital

Internship Experience
======
* 06/2023 – 08/2023: Assistant for Marketing and Sales Analysis
  * Exion Asia (HuiZhou) Co., Ltd
  * Decomposed sales and revenue trends by region, industry, and product line, identifying seasonal patterns and promotional effects; created weekly/monthly reports and executive summaries to pinpoint growth and decline drivers.
  * Built multi-dimensional dashboards (KPI, funnel, geographic distribution) in Tableau.

* 06/2022 – 07/2022: Customer Service Manager
  * Bank of Communications Huizhou Branch
  * Managed customer banking inquiries, ensuring a satisfactory service experience with prompt resolution.

Awards & Honors
======
* Honorable Mention, University of Chicago Applied Data Science Capstone Showcase, 2025
* First Class Award, Beijing Normal University–Hong Kong Baptist University United International College, 2021 & 2022
* President's Honor Roll, Beijing Normal University–Hong Kong Baptist University United International College
* Third Prize in Guangdong Division, China Undergraduate Mathematical Contest in Modeling, 2022

Skills
======
* **Programming:** Python (PyTorch, scikit-learn, NumPy, Pandas), SQL (PostgreSQL, MySQL), R, Bash
* **Machine Learning:** Deep learning, foundation model fine-tuning, optimization algorithms, supervised/contrastive learning, NLP, Agentic AI
* **Tools & Platforms:** LangChain, LangGraph, Google Cloud, Azure Cognitive Search, Tableau, Git, LaTeX
