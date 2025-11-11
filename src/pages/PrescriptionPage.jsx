import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Tag, Progress, Space, Button, Modal, Form, Input, InputNumber, DatePicker, Divider } from 'antd';
import dayjs from 'dayjs';
import { MedicineBoxOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useHealthData } from '../contexts/HealthDataContext';
import { useUser } from '../contexts/UserContext';
import { generatePrescription } from '../engine';
import { upsertPrescription } from '../models/storage';
import { updatePrescription as updateDbPrescription } from '../models';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Title, Text } = Typography;

const PrescriptionContainer = styled.div`
  .prescription-card {
    margin-bottom: 16px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    
    .ant-card-head {
      border-bottom: none;
    }
    
    .ant-card-body {
      padding-top: 0;
    }
  }

  .medicine-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e6f7ff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
  }

  .add-button {
    width: 100%;
    height: 120px;
    border-radius: 12px;
    border: 2px dashed #d9d9d9;
    
    &:hover {
      border-color: #1890ff;
    }
  }
`;

const PrescriptionPage = () => {
  const { activePrescription, addNewPrescription, getTodayData } = useHealthData();
  const { user } = useUser();
  const [prescriptions, setPrescriptions] = useState([]);
  const [exercisePrescription, setExercisePrescription] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    // 根据上下文的活跃处方刷新列表（仅展示活跃处方）
    if (activePrescription) {
      setPrescriptions([activePrescription]);
    } else {
      setPrescriptions([]);
    }
  }, [activePrescription]);

  const handleGenerateExercisePrescription = async () => {
    try {
      setGenerating(true);
      // 映射用户档案到 UserProfile
      const conditions = Array.isArray(user?.diseases) ? user.diseases : [];
      const mhText = user?.medical_history || '';
      const extra = mhText ? mhText.split(/[，,、；;\s]+/).filter(Boolean) : [];
      const profile = {
        age: Number(user?.age) || 0,
        sex: (user?.gender === 'male' || user?.gender === 'female') ? user.gender : 'other',
        height: user?.height != null ? Number(user.height) : undefined,
        weight: user?.weight != null ? Number(user.weight) : undefined,
        waist: user?.waist != null ? Number(user.waist) : undefined,
        conditions: [...conditions, ...extra]
      };

      // 将今日数据映射为 Measurement[]（若无则生成空数组）
      const today = getTodayData();
      const measurements = [];
      if (today?.systolic != null && today?.diastolic != null) {
        measurements.push({
          type: 'bp',
          value: { systolic: Number(today.systolic), diastolic: Number(today.diastolic) },
          takenAt: today?.timestamp || new Date().toISOString(),
          source: 'manual'
        });
      }
      if (today?.blood_sugar != null) {
        // 引擎兼容 number 或 { value: number }
        measurements.push({
          type: 'bg',
          value: Number(today.blood_sugar),
          takenAt: today?.timestamp || new Date().toISOString(),
          source: 'manual'
        });
      }
      if (today?.heart_rate != null) {
        measurements.push({
          type: 'hr',
          value: Number(today.heart_rate),
          takenAt: today?.timestamp || new Date().toISOString(),
          source: 'manual'
        });
      }

      const pr = generatePrescription(profile, measurements);
      setExercisePrescription(pr);
    } catch (e) {
      Modal.error({ title: '生成失败', content: e?.message || '生成运动处方时出现错误' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveExercisePrescription = async () => {
    if (!exercisePrescription) return;
    try {
      await upsertPrescription(exercisePrescription);
      Modal.success({ title: '已保存', content: '智能运动处方已保存到本地' });
    } catch (e) {
      Modal.error({ title: '保存失败', content: e?.message || '保存运动处方时出现错误' });
    }
  };

  const handleAddOrEdit = () => {
    setEditingPrescription(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (prescription) => {
    setEditingPrescription(prescription);
    form.setFieldsValue({
      ...prescription,
      start_date: prescription.start_date ? dayjs(prescription.start_date) : null,
      end_date: prescription.end_date ? dayjs(prescription.end_date) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (prescriptionId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个处方吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        // 无删除API，标记为已完成以隐藏活跃处方
        try {
          await updateDbPrescription(prescriptionId, { status: 'completed', end_date: new Date().toISOString() });
          Modal.success({ title: '已删除', content: '该处方已标记为完成' });
        } catch (e) {
          Modal.error({ title: '删除失败', content: e?.message || '更新处方状态时出现错误' });
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const prescriptionData = {
        ...values,
        start_date: values.start_date?.toDate().toISOString(),
        end_date: values.end_date?.toDate().toISOString(),
      };

      if (editingPrescription) {
        await updateDbPrescription(editingPrescription.prescription_id, prescriptionData);
      } else {
        await addNewPrescription(prescriptionData);
      }

      setModalVisible(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const calculateAdherenceRate = (prescription) => {
    const total = prescription.daily_count * 7; // 一周应服用次数
    const taken = prescription.taken_count || 0; // 实际服用次数
    return Math.round((taken / total) * 100);
  };

  // 模拟更新处方完成状态的函数
  const updatePrescriptionCompletion = async (prescriptionId, type, value) => {
    // 在实际应用中，这里应该调用API更新处方完成状态
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 500);
    });
  };

  return (
    <PrescriptionContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>我的处方</Title>

        {/* 智能运动处方生成与展示 */}
        <Card className="prescription-card" title={
          <Space>
            <div className="medicine-icon" style={{ background: '#f5f3ff' }}>
              <ThunderboltOutlined style={{ fontSize: 24, color: '#7c3aed' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0 }}>运动处方（智能生成）</Title>
              <Text type="secondary">基于个人档案与最近测量</Text>
            </div>
          </Space>
        } extra={
          <Space>
            <Button type="primary" loading={generating} onClick={handleGenerateExercisePrescription}>
              智能生成运动处方
            </Button>
            <Button disabled={!exercisePrescription} onClick={handleSaveExercisePrescription}>保存到我的处方</Button>
          </Space>
        }>
          {exercisePrescription ? (
            <>
              <List>
                <List.Item>
                  <Space>
                    <Tag color="blue">频率</Tag>
                    <Text>每周 {exercisePrescription.fit.freq} 次</Text>
                  </Space>
                </List.Item>
                <List.Item>
                  <Space>
                    <Tag color="purple">强度</Tag>
                    <Text>{exercisePrescription.fit.intensity}</Text>
                  </Space>
                </List.Item>
                <List.Item>
                  <Space>
                    <Tag color="green">时间</Tag>
                    <Text>每次 {exercisePrescription.fit.time} 分钟</Text>
                  </Space>
                </List.Item>
                <List.Item>
                  <Space>
                    <Tag color="geekblue">类型</Tag>
                    <Text>{exercisePrescription.fit.type}</Text>
                  </Space>
                </List.Item>
              </List>
              <Divider style={{ margin: '8px 0' }} />
              <Space wrap>
                <Text type="secondary">规则编号：</Text>
                {(exercisePrescription.rules || []).map(id => (
                  <Tag key={id} color="default">{id}</Tag>
                ))}
              </Space>
            </>
          ) : (
            <Text type="secondary">点击上方按钮，智能生成匹配您的运动处方</Text>
          )}
        </Card>

        {prescriptions.map((prescription) => (
          <Card
            key={prescription.prescription_id}
            className="prescription-card"
            title={
              <Space>
                <div className="medicine-icon">
                  <MedicineBoxOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{prescription.medicine_name}</Title>
                  <Text type="secondary">
                    {format(new Date(prescription.start_date), 'yyyy年MM月dd日', { locale: zhCN })} -
                    {format(new Date(prescription.end_date), 'yyyy年MM月dd日', { locale: zhCN })}
                  </Text>
                </div>
              </Space>
            }
            extra={
              <Space>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(prescription)}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(prescription.prescription_id)}
                />
              </Space>
            }
          >
            <List>
              <List.Item>
                <Text>用药说明：{prescription.instructions}</Text>
              </List.Item>
              <List.Item>
                <Text>每日服用次数：{prescription.daily_count}次</Text>
              </List.Item>
              <List.Item>
                <Text>每次剂量：{prescription.dosage}</Text>
              </List.Item>
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>本周服药达标率</Text>
                  <Progress
                    percent={calculateAdherenceRate(prescription)}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                </Space>
              </List.Item>
              <List.Item>
                <Space>
                  <Tag color={prescription.status === 'active' ? 'success' : 'default'}>
                    {prescription.status === 'active' ? '进行中' : '已完成'}
                  </Tag>
                  {prescription.notes && <Tag color="blue">医嘱: {prescription.notes}</Tag>}
                </Space>
              </List.Item>
            </List>
          </Card>
        ))}

        <Button
          type="dashed"
          className="add-button"
          onClick={handleAddOrEdit}
          icon={<PlusOutlined />}
        >
          添加新处方
        </Button>

        <Modal
          title={editingPrescription ? '编辑处方' : '添加处方'}
          open={modalVisible}
          onOk={handleModalOk}
          onCancel={() => setModalVisible(false)}
          okText="确定"
          cancelText="取消"
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              status: 'active',
              taken_count: 0,
            }}
          >
            <Form.Item
              name="medicine_name"
              label="药品名称"
              rules={[{ required: true, message: '请输入药品名称' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="instructions"
              label="用药说明"
              rules={[{ required: true, message: '请输入用药说明' }]}
            >
              <Input.TextArea />
            </Form.Item>
            <Form.Item
              name="daily_count"
              label="每日服用次数"
              rules={[{ required: true, message: '请输入每日服用次数' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="dosage"
              label="每次剂量"
              rules={[{ required: true, message: '请输入每次剂量' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="start_date"
              label="开始日期"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="end_date"
              label="结束日期"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="notes"
              label="医嘱"
            >
              <Input.TextArea />
            </Form.Item>
            <Form.Item name="status" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="taken_count" hidden>
              <InputNumber />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </PrescriptionContainer>
  );
};

export default PrescriptionPage;