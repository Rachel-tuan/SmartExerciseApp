import React, { useEffect, useMemo, useState } from 'react'
import { Card, Typography, Space, Row, Col, Tag, List, Button, Progress, message, Modal, InputNumber, Checkbox, Form } from 'antd'
import { CheckCircleTwoTone, AlertTwoTone, HeartOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { useUser } from '../contexts/UserContext'
import {
  getWeeklyExerciseSummary,
  setExerciseCompletion,
  getHealthStats,
  getExerciseLogs,
  getDailyGoalMinutes,
  setDailyGoalMinutes,
  getWeeklyPlannedDaysGoal,
  setWeeklyPlannedDaysGoal
} from '../models'
import { preExerciseGate } from '@/models/rules'
import { getPrescriptions } from '@/models/storage'
import { startOfWeek, addDays, format } from 'date-fns'

const { Title, Text } = Typography

const Container = styled.div`
  .card {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    margin-bottom: 16px;
  }
  .section-title {
    margin-bottom: 8px;
  }
  .pill {
    padding: 4px 10px;
    border-radius: 999px;
    background: #f3f4f6;
    font-size: 12px;
  }
`

function ymd(d) {
  return format(d, 'yyyy-MM-dd')
}

const weekdays = ['周一','周二','周三','周四','周五','周六','周日']

const ExercisePage = () => {
  const { user } = useUser()
  const [prescription, setPrescription] = useState(null)
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [weekSummary, setWeekSummary] = useState({ dates: [], completedDates: [], completedCount: 0, adherencePercent: 0 })
  const [loading, setLoading] = useState(false)
  const [healthStats, setHealthStats] = useState(null)
  // 简易计时器状态
  const [elapsedSec, setElapsedSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [todayAccumulatedMins, setTodayAccumulatedMins] = useState(0)
  const [goalMinutes, setGoalMinutes] = useState(30)
  const [plannedDays, setPlannedDays] = useState(5)

  // 计时器持久化：从 localStorage 恢复/保存
  function restoreTimerState() {
    try {
      const raw = localStorage.getItem('exercise_timer_state')
      if (!raw) return { elapsedSec: 0, running: false }
      const parsed = JSON.parse(raw)
      const prevElapsed = Number(parsed?.elapsedSec) || 0
      const wasRunning = Boolean(parsed?.running)
      const startTs = Number(parsed?.timerStartTimestamp) || null
      if (wasRunning && startTs) {
        const now = Date.now()
        const delta = Math.max(0, Math.floor((now - startTs) / 1000))
        return { elapsedSec: prevElapsed + delta, running: true }
      }
      return { elapsedSec: prevElapsed, running: false }
    } catch (_e) {
      return { elapsedSec: 0, running: false }
    }
  }

  function persistTimerState(next) {
    try {
      const payload = {
        elapsedSec: Number(next?.elapsedSec) || 0,
        running: Boolean(next?.running),
        timerStartTimestamp: next?.running ? Date.now() : null
      }
      localStorage.setItem('exercise_timer_state', JSON.stringify(payload))
    } catch (_e) {
      // ignore
    }
  }

  const reload = async () => {
    if (!user) return
    setLoading(true)
    try {
      // 读取本地保存的 FITT 处方（最新一条作为当前）
      const list = await getPrescriptions()
      const p = Array.isArray(list) && list.length > 0 ? list[0] : null
      setPrescription(p)
      const stats = await getHealthStats(user.user_id)
      setHealthStats(stats)
      // 每周计划天数（用户可自定义），默认取处方频次
      const fallbackDays = (p?.plan?.weekly?.plannedSessionsPerWeek) ?? (p?.fit?.freq) ?? 5
      const userPlannedDays = getWeeklyPlannedDaysGoal(user.user_id, fallbackDays)
      setPlannedDays(userPlannedDays)
      const summary = await getWeeklyExerciseSummary(
        user.user_id,
        weekStart,
        userPlannedDays
      )
      setWeekSummary(summary)
      // 今日累计时长与目标
      const todayStr = ymd(new Date())
      const allLogs = await getExerciseLogs(user.user_id)
      const todayLog = (allLogs || []).find(l => l.date === todayStr)
      setTodayAccumulatedMins(Number(todayLog?.duration_mins) || 0)
      const fallbackGoal = p?.fit?.time || 30
      setGoalMinutes(getDailyGoalMinutes(user.user_id, todayStr, fallbackGoal))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 恢复计时器状态（跨页切换仍然连续）
    const restored = restoreTimerState()
    setElapsedSec(restored.elapsedSec)
    setRunning(restored.running)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStart])

  // 当用户调整每周目标天数时，重新计算本周完成情况
  useEffect(() => {
    (async () => {
      if (!user) return
      try {
        const summary = await getWeeklyExerciseSummary(user.user_id, weekStart, plannedDays)
        setWeekSummary(summary)
      } catch (_e) {}
    })()
  }, [plannedDays, user, weekStart])

  // 定时器运行控制
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // 每次状态变化，保存到 localStorage
  useEffect(() => {
    persistTimerState({ elapsedSec, running })
  }, [elapsedSec, running])

  const weekDates = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart])

  const handleToggleToday = async () => {
    if (!user) return
    const today = new Date()
    const dateStr = ymd(today)
    // 运动前安全闸门
    const gate = preExerciseGate({
      sbp: healthStats?.latestRecord?.systolic,
      dbp: healthStats?.latestRecord?.diastolic,
      glucose: healthStats?.latestRecord?.blood_sugar,
      ketonePositive: false,
      onInsulinOrSecretagogue: Boolean(user?.onInsulinOrSecretagogue),
      meds: [],
      plannedLoad: (prescription?.fit?.intensity || '').includes('高') ? 'high' : 'moderate'
    })
    if (!gate.ok) {
      Modal.error({ title: '暂缓运动', content: (<ul>{gate.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>) })
      return
    }
    if (gate.caution) {
      Modal.warning({ title: '注意事项', content: (<ul>{gate.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>) })
    }
    // 改为打开记录弹窗，由用户确认并保存RPE/时长等
    setCompleteModalOpen(true)
  }

  const handleToggle = async (date) => {
    if (!user) return
    const dateStr = ymd(date)
    const isDone = weekSummary.completedDates.includes(dateStr)
    const gate = preExerciseGate({
      sbp: healthStats?.latestRecord?.systolic,
      dbp: healthStats?.latestRecord?.diastolic,
      glucose: healthStats?.latestRecord?.blood_sugar,
      ketonePositive: false,
      onInsulinOrSecretagogue: Boolean(user?.onInsulinOrSecretagogue),
      meds: [],
      plannedLoad: (prescription?.fit?.intensity || '').includes('高') ? 'high' : 'moderate'
    })
    if (!gate.ok) {
      Modal.error({ title: '暂缓运动', content: (<ul>{gate.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>) })
      return
    }
    if (gate.caution) {
      Modal.warning({ title: '注意事项', content: (<ul>{gate.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>) })
    }
    await setExerciseCompletion(user.user_id, date, !isDone)
    await reload()
  }

  return (
    <Container>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card className="card">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Title level={3} style={{ margin: 0 }}>
                <HeartOutlined style={{ marginRight: 8 }} /> 个体化运动处方
              </Title>
              {healthStats?.bmi != null && (
                <span className="pill">BMI：{healthStats.bmi}（{healthStats.bmiCategory}）</span>
              )}
            </Space>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card className="card" title="核心指标">
                  <Space direction="vertical">
                    <Text>年龄：{user?.age ?? '—'}</Text>
                    <Text>血压：{healthStats?.latestRecord?.systolic ?? '—'}/{healthStats?.latestRecord?.diastolic ?? '—'}（{healthStats?.bloodPressureStatus?.stage ?? '—'}）</Text>
                    <Text>血糖：{healthStats?.latestRecord?.blood_sugar ?? '—'} mmol/L（{healthStats?.bloodSugarStatus?.isNormal ? '正常' : '异常'}）</Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={16}>
                <Card className="card" title="执行计划（摘要）">
                  <Space direction="vertical" size="middle">
                    <div>
                      <Text strong>FITT 摘要：</Text>
                      <div style={{ marginTop: 8 }}>
                        <Tag color="purple">频率：每周 {prescription?.fit?.freq ?? '—'} 次</Tag>
                        <Tag color="blue">强度：{prescription?.fit?.intensity ?? '—'}</Tag>
                        <Tag color="geekblue">时长：每次 {prescription?.fit?.time ?? '—'} 分钟</Tag>
                        <Tag color="green">类型：{prescription?.fit?.type ?? '—'}</Tag>
                      </div>
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="card" title="训练计时器">
              <Space direction="vertical" style={{ width:'100%' }}>
                <Title level={4} style={{ margin:0 }}>
                  {String(Math.floor(elapsedSec/60)).padStart(2,'0')}:{String(elapsedSec%60).padStart(2,'0')}
                </Title>
                <Space>
                  <Button type={running ? 'default' : 'primary'} onClick={() => setRunning(r => !r)}>{running ? '暂停' : '开始'}</Button>
                  <Button onClick={() => { setRunning(false); setElapsedSec(0) }}>重置</Button>
                  <Button type="primary" onClick={() => setCompleteModalOpen(true)}>完成本次</Button>
                </Space>
                <div style={{ marginTop: 12 }}>
                  <Space direction="vertical" style={{ width:'100%' }}>
                    <Space align="center">
                      <Text>今日目标：</Text>
                      <InputNumber min={5} max={240} step={5} value={goalMinutes} onChange={(v) => {
                        const mins = Number(v) || 30
                        setGoalMinutes(mins)
                        const todayStr = ymd(new Date())
                        if (user?.user_id) setDailyGoalMinutes(user.user_id, todayStr, mins)
                      }} />
                      <Text type="secondary">分钟</Text>
                    </Space>
                    {(() => {
                      const currentMins = Math.floor(elapsedSec / 60) + (Number(todayAccumulatedMins) || 0)
                      const percent = Math.min(100, Math.round((currentMins / (goalMinutes || 1)) * 100))
                      return (
                        <>
                          <Text>今日进度：{currentMins} / {goalMinutes} 分钟</Text>
                          <Progress percent={percent} status="active" strokeColor="#52c41a" />
                        </>
                      )
                    })()}
                    <Text type="secondary">说明：达到今日目标后，该日才记为“完成”。</Text>
                  </Space>
                </div>
              </Space>
            </Card>

            {(healthStats?.bloodPressureStatus?.alert || healthStats?.bloodSugarStatus?.alert) && (
              <Card className="card" title="风险提示">
                <List
                  dataSource={[healthStats?.bloodPressureStatus?.alert, healthStats?.bloodSugarStatus?.alert].filter(Boolean)}
                  renderItem={(w) => (
                    <List.Item>
                      <AlertTwoTone twoToneColor="#faad14" style={{ marginRight: 8 }} />
                      <Text>{w}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            <Card className="card" title="本周完成情况">
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} md={8}>
                  <Space direction="vertical">
                    <Space align="center">
                      <Text>每周目标天数：</Text>
                      <InputNumber min={1} max={7} value={plannedDays} onChange={(v) => {
                        const d = Math.min(Math.max(Number(v) || 0, 1), 7)
                        setPlannedDays(d)
                        if (user?.user_id) setWeeklyPlannedDaysGoal(user.user_id, d)
                      }} />
                      <Text type="secondary">建议 {prescription?.fit?.freq || 5} 天</Text>
                    </Space>
                    <Text>建议时长：每次 {prescription?.fit?.time || 30} 分钟</Text>
                    <Progress percent={weekSummary.adherencePercent} status="active" strokeColor="#00b96b" />
                  </Space>
                </Col>
                <Col xs={24} md={16}>
                  <Row gutter={[8, 8]}>
                    {weekDates.map((d, i) => {
                      const dateStr = ymd(d)
                      const done = weekSummary.completedDates.includes(dateStr)
                      return (
                        <Col span={12} md={6} key={dateStr}>
                          <Button
                            block
                            type={done ? 'primary' : 'default'}
                            onClick={() => handleToggle(d)}
                            icon={done ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : null}
                          >
                            {weekdays[i]}（{format(d, 'MM/dd')}）
                          </Button>
                        </Col>
                      )
                    })}
                  </Row>
                  <div style={{ marginTop: 12 }}>
                    {/* 移除“记录本次锻炼”按钮，达成当日目标后自动记为“完成” */}
                  </div>
                </Col>
              </Row>
            </Card>

            {Array.isArray(prescription?.rules) && prescription.rules.length > 0 && (
              <Card className="card" title="规则编号">
                <Space wrap>
                  {prescription.rules.map(id => (
                    <Tag key={id}>{id}</Tag>
                  ))}
                </Space>
              </Card>
            )}
          </Space>
        </Card>

        <Modal
          title="记录本次完成"
          open={completeModalOpen}
          onOk={async () => {
            try {
              const values = await form.validateFields()
              const today = new Date()
              const duration_mins = Math.round(elapsedSec / 60)
              await setExerciseCompletion(user.user_id, today, true, {
                rpe: Number(values.rpe),
                symptoms: values.symptoms || [],
                duration_mins,
                notes: values.notes || ''
              })
              message.success('已记录本次完成')
              setCompleteModalOpen(false)
              setRunning(false)
              setElapsedSec(0)
              persistTimerState({ elapsedSec: 0, running: false })
              // 保存后刷新今日累计进度
              const todayStr = ymd(new Date())
              const allLogs = await getExerciseLogs(user.user_id)
              const todayLog = (allLogs || []).find(l => l.date === todayStr)
              setTodayAccumulatedMins(Number(todayLog?.duration_mins) || 0)
              await reload()
            } catch (e) {
              // 验证失败
            }
          }}
          onCancel={() => setCompleteModalOpen(false)}
          okText="保存"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item label="主观用力（RPE 1-10）" name="rpe" rules={[{ required: true, message: '请填写RPE' }]}> 
              <InputNumber min={1} max={10} style={{ width:'100%' }} />
            </Form.Item>
            <Form.Item label="不适症状（可多选）" name="symptoms">
              <Checkbox.Group options={[
                { label:'胸闷/胸痛', value:'chest_pain' },
                { label:'呼吸困难', value:'dyspnea' },
                { label:'心悸', value:'palpitations' },
                { label:'异常疲劳', value:'fatigue' },
                { label:'下肢水肿', value:'edema' }
              ]} />
            </Form.Item>
            <Form.Item label="备注" name="notes">
              <textarea style={{ width:'100%', minHeight:80 }} />
            </Form.Item>
            <Form.Item>
              <Text type="secondary">计时器用时将自动作为本次时长（分钟）。</Text>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </Container>
  )
}

export default ExercisePage