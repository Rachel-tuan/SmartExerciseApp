import React, { useMemo } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import showSafetyDialog from './SafetyDialog';
import './safety.css';

/**
 * SafetyIndicator
 * 交通灯指示 + 详情弹窗
 * props:
 * - status: 'green' | 'yellow' | 'red'
 * - reasons: string[]
 * - suggestedAction?: string
 * - size?: 'small' | 'default'
 */
export default function SafetyIndicator({ status = 'green', reasons = [], suggestedAction, size = 'default', context = 'measure' }) {
  const badgeStatus = useMemo(() => {
    if (status === 'red') return 'error';
    if (status === 'yellow') return 'warning';
    return 'success';
  }, [status]);

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
    <div className={`gate-indicator gate-${status}`} style={{ display:'flex', alignItems:'center', gap:8 }}>
      <Tooltip title={tip} placement="top">
        <Badge status={badgeStatus} text={label} />
      </Tooltip>
      <Button type="link" size={size} onClick={() => showSafetyDialog({ status, reasons, suggestedAction, context })}>
        查看安全提示
      </Button>
    </div>
  );
}