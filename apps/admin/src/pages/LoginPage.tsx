import { useState } from "react";

import { Alert, Button, Card, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/stores/auth-store";
import type { LoginPayload } from "@/types/auth";

/**
 * 后台登录页：校验管理员账号并跳转首页。
 */
export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: LoginPayload) => {
    setSubmitting(true);
    setError(null);
    const failureMessage = await login(values);
    setSubmitting(false);
    if (failureMessage) {
      setError(failureMessage);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">CC</span>
          <h1>ContentCreator 管理后台</h1>
          <p className="login-brand-sub">请登录后继续</p>
        </div>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false} autoComplete="off">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="请输入用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
