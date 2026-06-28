---
title: "Faster Adaptive Optimization via Expected Gradient Outer Product Reparameterization"
collection: publications
thumb_label: "OPT"
category: manuscripts
permalink: /publication/2025-egop-faster-adaptive-optimization
excerpt: 'Tightens Adagrad/Adam convergence bounds by a factor of 1/d via EGOP-based reparameterization, and proposes Auxiliary-Variable and Reduced EGOP algorithms that bypass the storage/compute bottleneck of full-matrix preconditioning. Submitted to <i>SIMODS</i>.'
date: 2025-09-01
venue: 'SIAM Journal on Mathematics of Data Science (under review)'
paperurl: '/files/egop_simods_submission.pdf'
citation: 'DePavia, A., Cruzado, J., <strong>Liang, J.</strong>, Charisopoulos, V., &amp; Willett, R. (2025). &quot;Faster Adaptive Optimization via Expected Gradient Outer Product Reparameterization.&quot; <i>Submitted to SIAM Journal on Mathematics of Data Science (SIMODS)</i>.'
---

**Keywords:** adaptive optimization · Adam · Adagrad · low-rank preconditioning · EGOP · randomized SVD

**My contribution.** Led the design of the Auxiliary-Variable and Reduced EGOP algorithms. Used randomized SVD to extract the top-r eigenvectors of the EGOP matrix and introduced an orthogonal-complement auxiliary variable enabling lossless full-space optimization while storing only a small basis. Implemented the module end-to-end and benchmarked on Fashion-MNIST, EMNIST, CIFAR-10; on a 78,400-dim layer, retaining less than 1.3% of components (r=1000), and even r=50, captured the dominant geometry of the loss landscape and accelerated convergence.
