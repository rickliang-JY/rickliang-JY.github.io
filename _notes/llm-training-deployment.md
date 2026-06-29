---
title: "LLM 大规模训练与部署"
collection: notes
header:
  teaser: art/art-1.jpg
type: "Note"
permalink: /notes/llm-training-deployment
date: 2026-05-27
location: "Chicago, Illinois"
link: /files/notes/llm-training-deployment.html
---

> 分布式训练并行策略 + 推理服务化 + 量化压缩 + 生产部署 — 一份覆盖从单机多卡到千卡集群、从理论推导到工程指标的系统笔记。

[**→ 打开完整笔记（独立窗口推荐）**](/files/notes/llm-training-deployment.html){:target="_blank"}

## 章节概览

- **第一章 数据并行：DP / DDP / FSDP** — Ring-AllReduce、梯度桶、FSDP 全分片、梯度累积
- **第二章 模型并行：Tensor 与 Pipeline** — Megatron 列/行切分、Attention/MLP 并行化、GPipe、1F1B、Interleaved、序列并行
- **第三章 ZeRO 与 3D 并行** — 显存账本、Stage 1/2/3、Offload/Infinity、3D 组合拓扑、训练 GPU 估算公式
- **第四章 推理服务架构与批处理** — Prefill/Decode 不对称、PagedAttention、连续批处理、投机解码（Medusa/EAGLE）、P/D 分离、框架对比
- **第五章 量化与模型压缩** — GPTQ / AWQ / SmoothQuant / KV Cache 量化 / 2:4 稀疏 / 蒸馏剪枝组合
- **第六章 生产部署与服务化** — TTFT/TPOT/Goodput、SLO 设计、弹性扩缩、LLM Gateway、灰度发布、成本测算

## 重点公式速查
- AllReduce 通信量：$2 \cdot \frac{N-1}{N} \cdot P \cdot b \approx 2Pb$
- 训练总算力：$C = 6PD$ FLOPs
- 单卡训练显存（Adam 混合精度）：$16P$ 字节（DDP），$16P/N$（ZeRO-3）
- 1F1B 气泡率：$(p-1)/(m+p-1)$
- 1M token 推理成本：$\frac{N_{\text{GPU}} \cdot \$/\text{hr}}{3600 \cdot \text{tps}} \times 10^6$

## 阅读说明
独立 HTML 笔记，使用与其他笔记一致的样式：KaTeX 公式、Mermaid 架构图、左侧目录、明暗主题切换、按章节懒渲染。文档约 70 KB，首屏加载与滚动都比较顺畅。
