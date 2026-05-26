---
title: "Validating Two Pathological Foundation Models for Breast Biomarker Detection"
collection: publications
category: manuscripts
permalink: /publication/2025-pathology-foundation-validation
excerpt: 'First study transferring Direct Preference Optimization (DPO) from LLM alignment to computational pathology. A label-free preference-pair pipeline (UMAP + DBSCAN on TITAN embeddings) plus LoRA-DPO fine-tuning lifts PR-status AUROC from 79.75% to 81.92% and Cohen''s κ from 45.40% to 54.43%. In preparation.'
date: 2025-12-15
venue: 'In preparation'
citation: 'Atiya, S., <strong>Liang, J.</strong>, et al. (2025). &quot;Validating Two Pathological Foundation Models for Breast Biomarker Detection.&quot; <i>In preparation</i>.'
---

**Keywords:** vision foundation model · DPO · pathology · LoRA · breast biomarker · PR status

**Highlights.** First to transfer Direct Preference Optimization from LLM alignment to computational pathology. Designed a pseudo-probability framework — cosine similarity, temperature scaling (γ=10), sigmoid — converting TITAN encoder geometry into DPO preference likelihoods; LoRA (r=16) trains only 2.7% of base parameters with a frozen reference model for implicit KL regularization. Designed a label-free preference-pair pipeline where a baseline classifier flags misclassified samples and UMAP+DBSCAN over correctly classified clusters yields "preferred" embeddings vs. misclassified "rejected" targets. Awarded **Honorable Mention** at the UChicago Applied Data Science Capstone Showcase.
