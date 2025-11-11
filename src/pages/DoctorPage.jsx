import React, { useState, useEffect, useMemo } from 'react';
import { Card, List, Typography, Space, Button, Modal, Form, Input, DatePicker, Empty, message, AutoComplete } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useHealthData } from '../contexts/HealthDataContext';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { pinyin } from 'pinyin-pro';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const DoctorContainer = styled.div`
  .doctor-card {
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

  .note-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    color: white;
    font-size: 24px;
  }

  .note-list {
    .ant-list-item {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      background: white;
      transition: all 0.3s;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }

  .add-note-button {
    width: 100%;
    height: 48px;
    border-radius: 8px;
    font-size: 16px;
    margin-bottom: 16px;
  }
`;

const DoctorPage = () => {
  const { getDoctorNotes, addDoctorNote } = useHealthData();
  const [notes, setNotes] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm();

  const doctorOptions = useMemo(() => {
    const freq = {};
    notes.forEach(n => {
      const name = (n?.doctor_name || '').trim();
      if (name) freq[name] = (freq[name] || 0) + 1;
    });
    return Object.keys(freq)
      .sort((a, b) => freq[b] - freq[a])
      .map(name => ({ value: name, label: name }));
  }, [notes]);

  const hospitalOptions = useMemo(() => {
    const freq = {};
    notes.forEach(n => {
      const name = (n?.hospital || '').trim();
      if (name) freq[name] = (freq[name] || 0) + 1;
    });
    return Object.keys(freq)
      .sort((a, b) => freq[b] - freq[a])
      .map(name => ({ value: name, label: name }));
  }, [notes]);

  const departmentOptions = useMemo(() => {
    const freq = {};
    notes.forEach(n => {
      const name = (n?.department || '').trim();
      if (name) freq[name] = (freq[name] || 0) + 1;
    });
    return Object.keys(freq)
      .sort((a, b) => freq[b] - freq[a])
      .map(name => ({ value: name, label: name }));
  }, [notes]);

  const normalize = (s) => (s || '').toLowerCase().trim();
  const toPinyinFull = (s) => pinyin(s || '', { toneType: 'none' }).toLowerCase();
  const toPinyinFirst = (s) => pinyin(s || '', { pattern: 'first', toneType: 'none' }).toLowerCase();
  const fuzzyFilter = (inputValue, option) => {
    const iv = normalize(inputValue);
    const ov = normalize(option?.value || '');
    if (!iv) return true;
    if (ov.includes(iv)) return true;
    const ovP = toPinyinFull(ov);
    const ivP = toPinyinFull(iv);
    if (ovP.includes(ivP)) return true;
    const ovF = toPinyinFirst(ov);
    const ivF = toPinyinFirst(iv);
    return ovF.includes(ivF);
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const allNotes = await getDoctorNotes();
    setNotes(allNotes);
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true);
      const values = await form.validateFields();
      const newNote = {
        content: values.content,
        doctor_name: values.doctorName,
        hospital: values.hospital || undefined,
        department: values.department || undefined,
        visit_date: values.visitDate?.toDate().toISOString(),
        created_at: new Date().toISOString()
      };

      await addDoctorNote(newNote);
      await loadNotes();
      message.success('已添加随访记录');
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('提交失败，请检查必填项');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <DoctorContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="doctor-card">
          <Space align="center">
            <div className="note-icon">
              <FileTextOutlined />
            </div>
            <div>
              <Title level={2} style={{ margin: 0 }}>医生随访记录</Title>
              <Text type="secondary">
                记录每次就医的诊疗建议
              </Text>
            </div>
          </Space>
        </Card>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          className="add-note-button"
          onClick={showModal}
        >
          添加随访记录
        </Button>

        <Card className="doctor-card" title="随访记录列表">
          {notes.length > 0 ? (
            <List
              className="note-list"
              itemLayout="vertical"
              dataSource={notes}
              renderItem={note => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space wrap>
          <Text strong>就诊医生：{note.doctor_name}</Text>
          <Text type="secondary">就诊时间：{format(new Date(note.visit_date), 'yyyy年MM月dd日', { locale: zhCN })}</Text>
          {note.hospital ? <Text type="secondary">就诊医院：{note.hospital}</Text> : null}
          {note.department ? <Text type="secondary">科室：{note.department}</Text> : null}
        </Space>
                    <Paragraph
                      style={{
                        margin: '12px 0',
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px'
                      }}
                    >
                      {note.content}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      记录时间：{format(new Date(note.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无随访记录"
            />
          )}
        </Card>
      </Space>

      <Modal
        title="添加随访记录"
        open={isModalVisible}
        confirmLoading={submitLoading}
        onOk={handleSubmit}
        onCancel={handleCancel}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            visitDate: null,
            doctorName: '',
            hospital: '',
            department: '',
            content: ''
          }}
        >
          <Form.Item
            name="visitDate"
            label="就诊时间"
            rules={[{ required: true, message: '请选择就诊时间' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="doctorName"
            label="就诊医生"
            rules={[{ required: true, message: '请输入就诊医生姓名' }]}
          >
            <AutoComplete
              options={doctorOptions}
              placeholder="请输入或选择就诊医生"
              filterOption={fuzzyFilter}
              allowClear
            />
          </Form.Item>

          <Form.Item name="hospital" label="就诊医院">
            <AutoComplete
              options={hospitalOptions}
              placeholder="可选输入或选择就诊医院"
              filterOption={fuzzyFilter}
              allowClear
            />
          </Form.Item>

          <Form.Item name="department" label="科室">
            <AutoComplete
              options={departmentOptions}
              placeholder="可选输入或选择科室"
              filterOption={fuzzyFilter}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="诊疗建议"
            rules={[{ required: true, message: '请输入诊疗建议内容' }]}
          >
            <TextArea
              placeholder="请输入诊疗建议内容"
              autoSize={{ minRows: 4, maxRows: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </DoctorContainer>
  );
};

export default DoctorPage;