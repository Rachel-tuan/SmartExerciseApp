import React from 'react';
import { Tag, Tooltip } from 'antd';
import showSafetyDialog from './SafetyDialog';
import './safety.css';

/**
 * InlineGateBadge
 * 小型三色灯标签，用于内联指示当前安全状态
 * props:
 * - status: 'green' | 'yellow' | 'red'
 * - reasons?: string[]
 * - suggestedAction?: string
 * - context?: 'exercise' | 'measure'
 */
export default function InlineGateBadge({ status = 'green', reasons = [], suggestedAction, context = 'exercise' }) {
  const label = status === 'red' ? '红灯' : status === 'yellow' ? '黄灯' : '绿灯';
  const tip = (
    <div>
      <div>安全状态：{label}</div>
      {Array.isArray(reasons) && reasons.length > 0 && (
        <div style={{ marginTop: 4 }}>原因：{reasons[0]}{reasons.length > 1 ? ' 等' : ''}</div>
      )}
      {suggestedAction && <div style={{ marginTop: 4 }}>建议：{suggestedAction}</div>}
    </div>
  );

  return (
    <Tooltip title={tip} placement="top">
      <span className={`gate-tag gate-${status}`} style={{ cursor: 'pointer' }}
            onClick={() => showSafetyDialog({ status, reasons, suggestedAction, context })}>
        <Tag>
          <span className="gate-dot" />
          <span style={{ marginLeft: 6 }}>{label}</span>
        </Tag>
      </span>
    </Tooltip>
  );
}