import React, { useMemo } from 'react';
import { Card, Typography, Space, Form, DatePicker, Select, InputNumber, Button, message } from 'antd';
import FreshnessBadge from '../components/FreshnessBadge';
import SafetyIndicator from '../components/SafetyIndicator';
import InlineGateBadge from '../components/InlineGateBadge';
import showSafetyDialog from '../components/SafetyDialog';
import { useHealthData } from '../contexts/HealthDataContext';
import { useUser } from '../contexts/UserContext';
import { preExerciseGate } from '../engine';
import { logGateEvent, updateGateEvent } from '../models';

const { Title, Text } = Typography;

export default function MeasurePage() {
  const [form] = Form.useForm();
  const { addRecord, activePrescription, buildUserProfile } = useHealthData();
  const { user } = useUser();

  const measuredAt = Form.useWatch('measuredAt', form);
  const source = Form.useWatch('source', form);
  const confidence = Form.useWatch('confidence_score', form);

  const systolic = Form.useWatch('systolic', form);
  const diastolic = Form.useWatch('diastolic', form);
  const blood_sugar = Form.useWatch('blood_sugar', form);
  const blood_glucose_is_fasting = Form.useWatch('blood_glucose_is_fasting', form);
  const heart_rate = Form.useWatch('heart_rate', form);

  const gatePreview = useMemo(() => {
    try {
      const measurements = [];
      const takenAt = measuredAt ? measuredAt.toDate().toISOString() : new Date().toISOString();
      if (systolic != null && diastolic != null) {
        measurements.push({ type: 'bp', value: { systolic: Number(systolic), diastolic: Number(diastolic) }, takenAt, source: 'manual' });
      }
      if (blood_sugar != null) {
        measurements.push({ type: 'bg', value: { value: Number(blood_sugar), isFasting: Boolean(blood_glucose_is_fasting) }, takenAt, source: 'manual' });
      }
      if (heart_rate != null) {
        measurements.push({ type: 'hr', value: Number(heart_rate), takenAt, source: 'manual' });
      }
      const profile = buildUserProfile();
      return preExerciseGate(measurements, profile);
    } catch (_e) {
      return { status: 'green', reasons: [], suggestedAction: undefined };
    }
  }, [systolic, diastolic, blood_sugar, heart_rate, measuredAt, user?.age, user?.gender, user?.height, user?.weight, user?.waist, user?.diseases]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        systolic: Number(values.systolic),
        diastolic: Number(values.diastolic),
        blood_sugar: Number(values.blood_sugar),
        blood_glucose_is_fasting: Boolean(values.blood_glucose_is_fasting),
        heart_rate: Number(values.heart_rate),
        bmi: values.bmi !== undefined ? Number(values.bmi) : undefined,
        waist: values.waist !== undefined ? Number(values.waist) : undefined,
        rpe: values.rpe !== undefined ? Number(values.rpe) : undefined,
        six_mwt: values.six_mwt !== undefined ? Number(values.six_mwt) : undefined,
        source: values.source,
        source_type: values.source,
        confidence_score: values.confidence_score !== undefined ? Number(values.confidence_score) / 100 : undefined,
        timestamp: values.measuredAt ? values.measuredAt.toDate().toISOString() : new Date().toISOString()
      };
      // 构造 canonical 安全闸门输入
      const measurements = [];
      const takenAt = payload.timestamp;
      measurements.push({ type: 'bp', value: { systolic: payload.systolic, diastolic: payload.diastolic }, takenAt, source: payload.source || 'manual' });
      measurements.push({ type: 'bg', value: { value: payload.blood_sugar, isFasting: Boolean(payload.blood_glucose_is_fasting) }, takenAt, source: payload.source || 'manual' });
      measurements.push({ type: 'hr', value: payload.heart_rate, takenAt, source: payload.source || 'manual' });

      const profile = buildUserProfile();

      const gate = preExerciseGate(measurements, profile);
      const dt = values.measuredAt ? values.measuredAt.toDate() : new Date();
      const y = dt.getFullYear(); const m = `${dt.getMonth()+1}`.padStart(2,'0'); const d = `${dt.getDate()}`.padStart(2,'0');
      const dateStr = `${y}-${m}-${d}`;

      // 记录 Gate 事件
      const evt = await logGateEvent(user?.user_id, {
        date: dateStr,
        status: gate.status,
        reasons: gate.reasons || [],
        suggestedAction: gate.suggestedAction,
        forcedStart: false,
        prescription_id: activePrescription?.prescription_id
      });

      if (gate.status === 'red' || gate.status === 'yellow') {
        showSafetyDialog({
          status: gate.status,
          reasons: gate.reasons || [],
          suggestedAction: gate.suggestedAction,
          context: 'measure',
          okText: '仍然保存',
          cancelText: '取消',
          onOk: async () => {
            await updateGateEvent(evt?.event_id, { forcedStart: true });
            await addRecord(payload);
            message.success('已保存测量记录');
            form.resetFields();
          }
        });
        return;
      }

      // 绿灯：正常保存
      await addRecord(payload);
      message.success("已保存测量记录");
      form.resetFields();
    } catch (e) {
      // 校验失败或保存错误
      message.error("保存失败，请稍后重试");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={3}>录入测量</Title>
        <Card>
          <Form form={form} layout="vertical" initialValues={{ source: 'manual', blood_glucose_is_fasting: false }}>
            <Form.Item label="收缩压(高压)" name="systolic" rules={[{ required: true, message: '请输入收缩压' }]}> 
              <InputNumber min={60} max={250} style={{ width: '100%' }} addonAfter="mmHg" />
            </Form.Item>
            <Form.Item label="舒张压(低压)" name="diastolic" rules={[{ required: true, message: '请输入舒张压' }]}> 
              <InputNumber min={40} max={150} style={{ width: '100%' }} addonAfter="mmHg" />
            </Form.Item>
            <Form.Item label="血糖" name="blood_sugar" rules={[{ required: true, message: '请输入血糖值' }]}> 
              <InputNumber min={2} max={25} precision={1} style={{ width: '100%' }} addonAfter="mmol/L" />
            </Form.Item>
            <Form.Item label="取样类型" name="blood_glucose_is_fasting" tooltip="空腹值：采样前至少8小时未进食；随机值：非空腹随时采样">
              <Select style={{ width: '100%' }}
                options={[
                  { value: true, label: '空腹' },
                  { value: false, label: '随机' }
                ]}
              />
            </Form.Item>
            <Form.Item label="心率" name="heart_rate" rules={[{ required: true, message: '请输入心率' }]}> 
              <InputNumber min={30} max={220} style={{ width: '100%' }} addonAfter="bpm" />
            </Form.Item>
            <Form.Item label="BMI" name="bmi" rules={[{ type: 'number', min: 10, max: 60, message: '请输入合理的 BMI' }]}> 
              <InputNumber min={10} max={60} precision={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="腰围" name="waist" rules={[{ type: 'number', min: 40, max: 200, message: '请输入合理的腰围' }]}> 
              <InputNumber min={40} max={200} style={{ width: '100%' }} addonAfter="cm" />
            </Form.Item>
            <Form.Item label="主观用力(RPE)" name="rpe" rules={[{ type: 'number', min: 1, max: 10, message: '请输入 1-10 的 RPE' }]}> 
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="6 分钟步行距离(6MWT)" name="six_mwt" rules={[{ type: 'number', min: 0, max: 1000, message: '请输入有效的距离' }]}> 
              <InputNumber min={0} max={1000} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>

            <Form.Item label="测量时间" name="measuredAt">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="数据来源" name="source">
              <Select options={[
                { value: 'medical', label: '医疗级' },
                { value: 'wearable', label: '可穿戴' },
                { value: 'manual', label: '手动' }
              ]} />
            </Form.Item>
            <Form.Item label="来源可信度(%)" name="confidence_score" rules={[{ type: 'number', min: 0, max: 100, message: '请输入 0-100 的百分比' }]}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
            </Form.Item>

            <Space align="center" size="middle" style={{ marginBottom: 16, justifyContent:'space-between', width:'100%' }}>
              <Text>数据新鲜度：</Text>
              <FreshnessBadge timestamp={measuredAt ? measuredAt.toDate() : null} source={source} confidence={confidence} />
              <SafetyIndicator status={gatePreview?.status} reasons={gatePreview?.reasons} suggestedAction={gatePreview?.suggestedAction} size="small" context="measure" />
            </Space>

            <Form.Item>
              <Space>
                <Button type="primary" onClick={onSave}>保存</Button>
                <Button htmlType="reset" onClick={() => form.resetFields()}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
}