import { useState, type FormEvent } from "react";

import { Button } from "antd";

import { queryRag } from "@/api/rag";
import { getRequestErrorMessage } from "@/lib/request";
import type { RagQueryResponse } from "@/types/rag";

/**
 * RAG 测试页：对已上传文档提问，验证检索增强问答效果。
 */
export function RagTestPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagQueryResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const response = await queryRag({ query: query.trim(), top_k: 4 });
    setLoading(false);

    if (!response.ok) {
      setError(getRequestErrorMessage(response));
      return;
    }

    setResult(response.data);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>RAG 测试</h1>
          <p className="page-desc">基于已上传文档进行检索增强问答</p>
        </div>
      </header>

      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="form-field">
          <span className="form-label">提问</span>
          <textarea
            className="form-input rag-query-input"
            rows={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="请输入问题，例如：文档里提到了哪些要点？"
            disabled={loading}
          />
        </label>

        <div className="form-actions">
          <Button type="primary" htmlType="submit" loading={loading} disabled={!query.trim()}>
            提交
          </Button>
        </div>
      </form>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {result ? (
        <div className="card rag-result">
          <h2 className="section-title">回答</h2>
          <p className="rag-answer" style={{ whiteSpace: "pre-wrap" }}>
            {result.answer}
          </p>

          {result.sources.length > 0 ? (
            <div className="rag-sources">
              <h3 className="rag-sources-title">参考来源</h3>
              {result.sources.map((source, index) => (
                <div className="rag-source" key={`${source.document_id}-${index}`}>
                  <div className="rag-source-head">
                    <span className="cell-title">{source.filename}</span>
                    {source.score != null ? (
                      <span className="muted">相似度 {(source.score * 100).toFixed(1)}%</span>
                    ) : null}
                  </div>
                  <p className="rag-source-snippet">{source.snippet}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
