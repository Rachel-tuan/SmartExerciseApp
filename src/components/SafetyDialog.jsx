import React from 'react';
import { Modal } from 'antd';
import './safety.css';

/**
 * SafetyDialog
 * 统一的安全提示对话框（红/黄不同文案）
 * Usage: showSafetyDialog({ status, reasons, suggestedAction, context, okText, cancelText, onOk, onCancel })
 */
export function showSafetyDialog({
  status = 'yellow',
  reasons = [],
  suggestedAction,
  context = 'exercise', // 'exercise' | 'measure'
  okText,
  cancelText = '取消',
  onOk,
  onCancel
}) {
  const isRed = status === 'red';
  const title = isRed
    ? (context === 'exercise' ? '暂缓运动' : '暂缓保存测量')
    : '注意事项';
  const ok = okText || (context === 'exercise' ? '仍然开始' : '仍然保存');
  const content = (
    <div className="gate-dialog">
      <ul className="reasons">{(reasons || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
      {suggestedAction && <p className="suggest">建议：{suggestedAction}</p>}
    </div>
  );
  Modal.confirm({
    title,
    content,
    okText: ok,
    cancelText,
    onOk,
    onCancel,
  });
}

export default showSafetyDialog;