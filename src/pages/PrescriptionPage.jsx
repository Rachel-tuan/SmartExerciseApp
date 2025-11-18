import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Tag, Progress, Space, Button, Modal, Form, Input, InputNumber, DatePicker, Divider } from 'antd';
import dayjs from 'dayjs';
import { MedicineBoxOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useHealthData } from '../contexts/HealthDataContext';
import { useUser } from '../contexts/UserContext';
import { generatePrescription, ensureFourRules, getRuleMetaById } from '../engine';
// 移除本地 localStorage 处方写入，统一通过 IndexedDB 的 addNewPrescription 保存
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
  const { activePrescription, addNewPrescription, getTodayData, buildUserProfile } = useHealthData();
  const { user } = useUser();
  const [prescriptions, setPrescriptions] = useState([]);
  const [exercisePrescription, setExercisePrescription] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [form] = Form.useForm();
  const [evidenceVisible, setEvidenceVisible] = useState(false);

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
      // 规范化的用户档案（英文条件编码）
      const profile = buildUserProfile();

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
        measurements.push({
          type: 'bg',
          value: { value: Number(today.blood_sugar), isFasting: Boolean(today?.blood_glucose_is_fasting) },
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
      const rulesForUi = ensureFourRules(pr.rules || [], profile, measurements);
      const prForUi = { ...pr, rules_for_ui: rulesForUi };
      setExercisePrescription(prForUi);
    } catch (e) {
      Modal.error({ title: '生成失败', content: e?.message || '生成运动处方时出现错误' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveExercisePrescription = async () => {
    if (!exercisePrescription) return;
    try {
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await addNewPrescription({
        fit: { ...exercisePrescription.fit },
        rules: Array.isArray(exercisePrescription.rules) ? exercisePrescription.rules : [],
        rules_for_ui: Array.isArray(exercisePrescription.rules_for_ui) ? exercisePrescription.rules_for_ui : [],
        explain: exercisePrescription.explain,
        end_date: end.toISOString(),
        plan: { weekly: { sessionMinutes: Number(exercisePrescription.fit?.time) || 30 } }
      });
      Modal.success({ title: '已保存', content: '智能运动处方已保存（全局）' });
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
            <Button disabled={!exercisePrescription} onClick={() => setEvidenceVisible(true)}>循证说明</Button>
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
              {Array.isArray(exercisePrescription.explain?.top) && exercisePrescription.explain.top.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">贡献排行：</Text>
                  <Space wrap style={{ marginLeft: 8 }}>
                    {exercisePrescription.explain.top.map((t, idx) => (
                      <Tag key={idx} color="blue">{t.id}: {Math.round(t.score)}</Tag>
                    ))}
                  </Space>
                </div>
              )}
            </>
          ) : (
            <Text type="secondary">点击上方按钮，智能生成匹配您的运动处方</Text>
          )}
        </Card>

        <Modal
          title="当前处方循证说明"
          open={evidenceVisible}
          onCancel={() => setEvidenceVisible(false)}
          footer={<Space><Button type="primary" onClick={() => setEvidenceVisible(false)}>关闭</Button></Space>}
        >
          {exercisePrescription ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">{(Array.isArray(exercisePrescription.rules) && exercisePrescription.rules.length > 0) ? '展示实际处方规则对应的循证条目。' : '当前处方无真实规则编号'}</Text>
              <List
                dataSource={((exercisePrescription.rules || []).map(id => getRuleMetaById(id)).filter(Boolean))}
                renderItem={(item) => (
                  <List.Item key={item.id}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{item.id}</Text>
                        <Tag>{item.name}</Tag>
                      </Space>
                      {Array.isArray(item.evidence) && item.evidence.length > 0 && (
                        <Space wrap>
                          {item.evidence.map((ev, i) => (
                            <Tag key={`${item.id}-${i}`} color="geekblue">{ev}</Tag>
                          ))}
                        </Space>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            </Space>
          ) : (
            <Text type="secondary">暂无处方规则</Text>
          )}
        </Modal>

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