import React from 'react';
import { Tag, Space, Tooltip } from 'antd';

function computeFreshness(timestamp) {
  if (!timestamp) return { color: 'default', text: '无数据', hours: null };
  try {
    const t = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const h = Math.max(0, Math.floor((Date.now() - t.getTime()) / 3600000));
    if (h <= 24) return { color: 'green', text: '≤24h 新鲜', hours: h };
    if (h <= 72) return { color: 'gold', text: '24–72h 一般', hours: h };
    return { color: 'default', text: '>72h 过期', hours: h };
  } catch (_e) {
    return { color: 'default', text: '时间异常', hours: null };
  }
}

function computeConfidenceMeta(confidence) {
  if (confidence == null || Number.isNaN(Number(confidence))) {
    return { color: 'default', text: '可信度未知', pct: null };
  }
  let val = Number(confidence);
  if (val <= 1) {
    // 兼容模型层存储为 0-1 的情况，转换为百分比
    val = val * 100;
  }
  const pct = Math.max(0, Math.min(100, Math.round(val)));
  if (pct >= 80) return { color: 'green', text: '高可信度', pct };
  if (pct >= 50) return { color: 'gold', text: '中等可信度', pct };
  return { color: 'default', text: '低可信度', pct };
}

export default function FreshnessBadge({ timestamp, source, confidence, style }) {
  const f = computeFreshness(timestamp);
  const c = computeConfidenceMeta(confidence);
  const srcText = source === 'medical' ? '医疗级'
    : source === 'wearable' ? '可穿戴'
    : source === 'manual' ? '手动'
    : (source || '未知');
  const formatted = timestamp ? (timestamp instanceof Date ? timestamp : new Date(timestamp)).toLocaleString('zh-CN') : '—';
  return (
    <Space size="small" style={style}>
      <Tooltip title={`最近测量时间：${formatted}`}>
        <Tag color={f.color}>{f.text}</Tag>
      </Tooltip>
      <Tooltip title={`来源可信度：${c.pct != null ? c.pct + '%' : '未知'}`}>
        <Tag color={c.color}>{c.text}</Tag>
      </Tooltip>
      <Tag>{srcText}</Tag>
    </Space>
  );
}