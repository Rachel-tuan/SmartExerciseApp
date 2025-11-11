import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, DatePicker, InputNumber, Typography, Space, Table, Tag, Modal, message } from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useHealthData } from '../contexts/HealthDataContext';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';
import { computeBMI } from '../models/rules';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend
);

const { Title, Text } = Typography;

const DataRecordContainer = styled.div`
  .data-card {
    margin-bottom: 16px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .chart-container {
    margin: 24px 0;
    padding: 16px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const DataRecordPage = () => {
  const { getAllHealthRecords, addHealthRecord, updateHealthRecord, removeHealthRecord } = useHealthData();
  const [records, setRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const allRecords = await getAllHealthRecords();
    // 兼容不同来源的日期字段：record_date 或 timestamp
    const sorted = (allRecords || []).sort((a, b) => {
      const da = new Date(a.record_date || a.timestamp);
      const db = new Date(b.record_date || b.timestamp);
      return db - da; // 按时间倒序
    });
    setRecords(sorted);
  };

  const handleAddOrEdit = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      record_date: dayjs(),
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      record_date: dayjs(record.record_date),
    });
    setModalVisible(true);
  };

  const handleDelete = (recordId) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条记录吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        await removeHealthRecord(recordId);
        await loadRecords();
        message.success('记录已删除');
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const recordData = {
        ...values,
        record_date: values.record_date?.toDate().toISOString(),
      };

      if (editingRecord) {
        await updateHealthRecord(editingRecord.record_id, recordData);
      } else {
        await addHealthRecord(recordData);
      }

      setModalVisible(false);
      await loadRecords();
      message.success('记录已保存');
    } catch (error) {
      console.error('表单验证失败:', error);
      message.error('表单校验失败或保存异常');
    }
  };

  const columns = [
    {
      title: '记录日期',
      dataIndex: 'record_date',
      key: 'record_date',
      render: (_, record) => {
        const d = record.record_date || record.timestamp;
        try {
          return d ? format(new Date(d), 'yyyy年MM月dd日 HH:mm', { locale: zhCN }) : '—';
        } catch {
          return '—';
        }
      },
    },
    {
      title: '收缩压',
      dataIndex: 'systolic',
      key: 'systolic',
      render: (value) => (
        <span>
          {value}
          {value >= 160 && <Tag color="error" style={{ marginLeft: 8 }}>偏高</Tag>}
        </span>
      ),
    },
    {
      title: '舒张压',
      dataIndex: 'diastolic',
      key: 'diastolic',
      render: (value) => (
        <span>
          {value}
          {value >= 100 && <Tag color="error" style={{ marginLeft: 8 }}>偏高</Tag>}
        </span>
      ),
    },
    {
      title: '血糖',
      dataIndex: 'blood_sugar',
      key: 'blood_sugar',
      render: (value) => (
        <span>
          {value}
          {(value < 3.9 || value > 13.9) && (
            <Tag color="error" style={{ marginLeft: 8 }}>
              {value < 3.9 ? '偏低' : '偏高'}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: '身高 (cm)',
      dataIndex: 'height',
      key: 'height',
      render: (value) => value ?? '—',
    },
    {
      title: '体重 (kg)',
      dataIndex: 'weight',
      key: 'weight',
      render: (value) => (value != null ? Number(value).toFixed(1) : '—'),
    },
    {
      title: 'BMI',
      key: 'bmi',
      render: (_, record) => (record.height && record.weight ? computeBMI(record.height, record.weight) : '—'),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.record_id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const getChartData = () => {
    const byDateAsc = [...records].sort((a, b) => {
      const da = new Date(a.record_date || a.timestamp);
      const db = new Date(b.record_date || b.timestamp);
      return da - db;
    });
    const valid = byDateAsc.filter(r => {
      const d = r.record_date || r.timestamp;
      return d && !isNaN(new Date(d));
    });

    const dates = valid.map(r => {
      const d = r.record_date || r.timestamp;
      return format(new Date(d), 'MM/dd');
    });
    
    return {
      labels: dates,
      datasets: [
        {
          label: '收缩压',
          data: valid.map(r => r.systolic),
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
        },
        {
          label: '舒张压',
          data: valid.map(r => r.diastolic),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        },
        {
          label: '血糖',
          data: valid.map(r => r.blood_sugar),
          borderColor: 'rgb(53, 162, 235)',
          tension: 0.1,
        },
        {
          label: '体重 (kg)',
          data: valid.map(r => r.weight ?? null),
          borderColor: 'rgb(255, 159, 64)',
          tension: 0.1,
          yAxisID: 'y',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '健康指标趋势',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <DataRecordContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="data-card">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Title level={2} style={{ margin: 0 }}>健康数据记录</Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddOrEdit}
              >
                添加记录
              </Button>
            </Space>
          </Space>
        </Card>

        <div className="chart-container">
          <Line data={getChartData()} options={chartOptions} />
        </div>

        <Card className="data-card">
          <Table
            columns={columns}
            dataSource={records}
            rowKey="record_id"
            pagination={{
              pageSize: 10,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </Card>

        <Modal
          title={editingRecord ? '编辑记录' : '添加记录'}
          open={modalVisible}
          onOk={handleModalOk}
          onCancel={() => setModalVisible(false)}
          okText="确定"
          cancelText="取消"
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="record_date"
              label="记录日期"
              rules={[{ required: true, message: '请选择记录日期' }]}
            >
              <DatePicker
                showTime
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="systolic"
              label="收缩压 (mmHg)"
              rules={[
                { required: true, message: '请输入收缩压' },
                { type: 'number', min: 60, max: 200, message: '请输入有效的收缩压数值' },
              ]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="diastolic"
              label="舒张压 (mmHg)"
              rules={[
                { required: true, message: '请输入舒张压' },
                { type: 'number', min: 40, max: 150, message: '请输入有效的舒张压数值' },
              ]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="blood_sugar"
              label="血糖 (mmol/L)"
              rules={[
                { required: true, message: '请输入血糖值' },
                { type: 'number', min: 2, max: 30, message: '请输入有效的血糖数值' },
              ]}
            >
              <InputNumber style={{ width: '100%' }} precision={1} />
            </Form.Item>
            <Form.Item
              name="height"
              label="身高 (cm)"
              tooltip="用于计算BMI，可不填"
              rules={[
                { type: 'number', min: 100, max: 220, message: '请输入100-220之间的数值' },
              ]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="weight"
              label="体重 (kg)"
              tooltip="用于计算BMI，可不填"
              rules={[
                { type: 'number', min: 30, max: 200, message: '请输入30-200之间的数值' },
              ]}
            >
              <InputNumber style={{ width: '100%' }} precision={1} />
            </Form.Item>
            <Form.Item
              name="notes"
              label="备注"
            >
              <Input.TextArea />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </DataRecordContainer>
  );
};

export default DataRecordPage;