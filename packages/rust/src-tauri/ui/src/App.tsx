import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Layout, Menu, Card, Statistic, Row, Col, Table, Tag, Button, message, Typography, Space, Tabs } from 'antd';
import {
  CodeOutlined,
  RuleOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ErrorOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface RuleIssue {
  rule_id: string;
  file: string;
  line: number | null;
  message: string;
  severity: string;
  fix: string | null;
}

interface Rule {
  id: string;
  description: string;
  category: string;
  severity: string;
  pattern: string | null;
  message: string;
  fix: string | null;
  tags: string[];
}

interface RuleStats {
  total: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
}

function App() {
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [rules, setRules] = useState<Rule[]>([]);
  const [stats, setStats] = useState<RuleStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('function foo(x: any) {}');
  const [issues, setIssues] = useState<RuleIssue[]>([]);

  // 加载规则
  const loadRules = async () => {
    setLoading(true);
    try {
      const loadedRules = await invoke<Rule[]>('get_rules');
      setRules(loadedRules);
      
      const loadedStats = await invoke<RuleStats>('get_stats');
      setStats(loadedStats);
    } catch (error) {
      message.error(`加载失败：${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 初始化时加载内置规则
  useEffect(() => {
    const init = async () => {
      try {
        await invoke('generate_built_in_rules');
        await loadRules();
      } catch (error) {
        message.error(`初始化失败：${error}`);
      }
    };
    init();
  }, []);

  // 检查代码
  const handleCheck = async () => {
    setLoading(true);
    try {
      const result = await invoke<CheckResult>('check_code', {
        path: 'test.ts',
        content: code,
      });
      setIssues(result.issues);
      message.success(`检查完成，发现 ${result.issues.length} 个问题`);
    } catch (error) {
      message.error(`检查失败：${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 规则表格列
  const ruleColumns: ColumnsType<Rule> = [
    {
      title: '规则 ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 80,
      render: (severity: string) => {
        const color = severity === 'Error' ? 'red' : severity === 'Warning' ? 'orange' : 'blue';
        return <Tag color={color}>{severity}</Tag>;
      },
    },
  ];

  // 问题表格列
  const issueColumns: ColumnsType<RuleIssue> = [
    {
      title: '文件',
      dataIndex: 'file',
      key: 'file',
      width: 150,
    },
    {
      title: '行号',
      dataIndex: 'line',
      key: 'line',
      width: 60,
      render: (line: number | null) => line || '-',
    },
    {
      title: '问题',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 80,
      render: (severity: string) => {
        const icon = severity === 'Error' ? <ErrorOutlined /> : severity === 'Warning' ? <WarningOutlined /> : <CheckCircleOutlined />;
        const color = severity === 'Error' ? 'red' : severity === 'Warning' ? 'orange' : 'green';
        return <Tag color={color}>{icon} {severity}</Tag>;
      },
    },
    {
      title: '修复建议',
      dataIndex: 'fix',
      key: 'fix',
      render: (fix: string | null) => fix || '-',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <RuleOutlined style={{ fontSize: 24, color: '#fff' }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>CheckIt</Title>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => setSelectedKey(key)}
            items={[
              { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
              { key: 'rules', icon: <RuleOutlined />, label: '规则管理' },
              { key: 'check', icon: <CodeOutlined />, label: '代码检查' },
            ]}
          />
        </Sider>
        <Content style={{ padding: 24 }}>
          {selectedKey === 'dashboard' && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={2}>仪表盘</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="规则总数"
                      value={stats?.total || 0}
                      prefix={<RuleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="发现问题的"
                      value={issues.length}
                      prefix={<WarningOutlined />}
                      valueStyle={{ color: issues.length > 0 ? '#faad14' : '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="检查的文件"
                      value={issues.length > 0 ? 1 : 0}
                      prefix={<CodeOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              {stats && (
                <>
                  <Card title="按类别分布">
                    <Row gutter={16}>
                      {Object.entries(stats.by_category).map(([category, count]) => (
                        <Col span={6} key={category}>
                          <Statistic title={category} value={count} />
                        </Col>
                      ))}
                    </Row>
                  </Card>

                  <Card title="按严重级别分布">
                    <Row gutter={16}>
                      {Object.entries(stats.by_severity).map(([severity, count]) => (
                        <Col span={8} key={severity}>
                          <Statistic
                            title={severity}
                            value={count}
                            valueStyle={{
                              color: severity === 'Error' ? '#ff4d4f' : severity === 'Warning' ? '#faad14' : '#1890ff',
                            }}
                          />
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </>
              )}
            </Space>
          )}

          {selectedKey === 'rules' && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={2}>规则管理</Title>
              <Card>
                <Table
                  columns={ruleColumns}
                  dataSource={rules}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            </Space>
          )}

          {selectedKey === 'check' && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={2}>代码检查</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="输入代码">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      style={{
                        width: '100%',
                        height: 300,
                        fontFamily: 'monospace',
                        padding: 8,
                      }}
                    />
                    <Button
                      type="primary"
                      onClick={handleCheck}
                      loading={loading}
                      style={{ marginTop: 16 }}
                    >
                      检查代码
                    </Button>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="检查结果">
                    <Table
                      columns={issueColumns}
                      dataSource={issues}
                      rowKey={(record, index) => `${record.rule_id}-${index}`}
                      loading={loading}
                      pagination={false}
                      scroll={{ y: 300 }}
                    />
                  </Card>
                </Col>
              </Row>
            </Space>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
