import React, { useState, useEffect, useRef, JSX } from "react";
import {
  Card,
  Layout,
  Button,
  Row,
  Col,
  Select,
  Table,
  message,
  Spin,
  AutoComplete,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, AreaChartOutlined } from "@ant-design/icons";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const { Header, Content } = Layout;
const { Option } = Select;

// ---------- CẤU HÌNH ----------
// Remove BASE_URL usage for direct calls since it causes CORS
const PROXY_BASE = "/.netlify/functions/proxy";

// ---------- Các kiểu dữ liệu (Types) ----------
type TickerOverview = {
  ticker: string;
  lastPrice?: number;
  change?: number;
  changePercent?: number;
  [key: string]: any;
};

type HistoryPoint = {
  date: string;
  close: number;
};

// ---------- HÀM HỖ TRỢ API ----------
async function fetchViaProxy(path: string) {
  const url = `${PROXY_BASE}${path}`;
  const res = await axios.get(url);
  return res.data;
}

// FIX: Removed the try/catch fallback that called BASE_URL directly
async function fetchTickerOverview(ticker: string): Promise<TickerOverview> {
  const path = `/tcanalysis/v1/ticker/${encodeURIComponent(ticker)}/overview`;
  return await fetchViaProxy(path);
}

// FIX: Removed the try/catch fallback that called BASE_URL directly
async function fetchCompanyOverview(ticker: string): Promise<any> {
  const path = `/tcanalysis/v1/company/${encodeURIComponent(ticker)}/overview`;
  return await fetchViaProxy(path);
}

// FIX: Removed the try/catch fallback that called BASE_URL directly
async function fetchTickerHistory(
  ticker: string,
  range: string = "1m"
): Promise<HistoryPoint[]> {
  const path = `/tcanalysis/v1/ticker/${encodeURIComponent(
    ticker
  )}/history?range=${range}`;

  const res = await fetchViaProxy(path);
  if (Array.isArray(res)) {
    return res.map((p: any) => ({
      date: p.date || p.tradingDate || p.dt,
      close: p.close || p.price || p.c,
    }));
  }
  return [];
}

async function fetchTickerSuggestions(q: string): Promise<string[]> {
  if (!q) return [];
  const path = `/tcanalysis/v1/search?query=${encodeURIComponent(q)}`;
  try {
    const res = await fetchViaProxy(path);
    if (res && Array.isArray(res.items))
      return res.items.map((it: any) => `${it.ticker}`);
  } catch (e) {
    // Just ignore errors here, don't fallback to direct URL
    console.warn("Search failed", e);
  }

  // Local Fallback (Safe)
  const fallback = [
    "VHM",
    "VIC",
    "VNM",
    "SSI",
    "MSN",
    "FPT",
    "VCB",
    "HPG",
    "BVH",
    "MWG",
    "PSC",
  ];
  return fallback.filter((s) => s.includes(q.toUpperCase()));
}

// ---------- THÀNH PHẦN GIAO DIỆN (UI COMPONENT) ----------
export default function MarketDashboard(): JSX.Element {
  const [query, setQuery] = useState<string>("VHM");
  const [selectedTicker, setSelectedTicker] = useState<string>("VHM");
  const [overview, setOverview] = useState<TickerOverview | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<string>("1m");

  const [options, setOptions] = useState<{ value: string }[]>([]);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    searchTicker(selectedTicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearchTickerAuto(value: string) {
    setQuery(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const items = await fetchTickerSuggestions(value);
        setOptions((items || []).map((t) => ({ value: t })));
      } catch (e) {
        setOptions([]);
      }
    }, 300);
  }

  async function searchTicker(ticker: string) {
    if (!ticker) return;
    setLoading(true);
    setOverview(null);
    setCompany(null);
    setHistory([]);
    try {
      const [ov, co, hi] = await Promise.all([
        fetchTickerOverview(ticker).catch((e) => {
          console.warn("Lỗi overview:", e);
          return null;
        }),
        fetchCompanyOverview(ticker).catch((e) => {
          console.warn("Lỗi company:", e);
          return null;
        }),
        fetchTickerHistory(ticker, range).catch((e) => {
          console.warn("Lỗi history:", e);
          return [];
        }),
      ]);
      setOverview(ov);
      setCompany(co);
      setHistory(hi);
      setSelectedTicker(ticker.toUpperCase());
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi khi gọi API. Kiểm tra Proxy.");
    } finally {
      setLoading(false);
    }
  }

  const columns: ColumnsType<any> = [
    { title: "Trường", dataIndex: "key", key: "key" },
    { title: "Giá trị", dataIndex: "value", key: "value" },
  ];

  function overviewToRows(obj: any = {}) {
    if (!obj) return [];
    return Object.keys(obj).map((k) => ({
      key: k,
      value:
        typeof obj[k] === "object" ? JSON.stringify(obj[k]) : String(obj[k]),
    }));
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#001529",
          color: "white",
          fontSize: 20,
          fontWeight: 600,
          padding: "0 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 18 }}>
            <AreaChartOutlined style={{ marginRight: 8 }} />
            Bảng tin Chứng khoán
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <AutoComplete
              style={{ width: 260 }}
              options={options}
              onSelect={(val) => {
                setQuery(val);
                searchTicker(val);
              }}
              onSearch={onSearchTickerAuto}
              value={query}
              placeholder="Nhập mã (VHM, VNM...)"
              filterOption={false}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => searchTicker(query)}
            >
              Tìm kiếm
            </Button>
          </div>
        </div>
      </Header>

      <Content style={{ padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card title={`Tổng quan — ${selectedTicker}`} bordered>
                {overview ? (
                  <Table
                    columns={columns}
                    dataSource={overviewToRows(overview)}
                    pagination={{ pageSize: 8 }}
                    rowKey={(r) => r.key}
                  />
                ) : (
                  <div>Không có dữ liệu tổng quan.</div>
                )}
              </Card>

              <Card title="Công ty" style={{ marginTop: 16 }}>
                {company ? (
                  <Table
                    columns={columns}
                    dataSource={overviewToRows(company)}
                    pagination={{ pageSize: 8 }}
                    rowKey={(r) => r.key}
                  />
                ) : (
                  <div>Không có dữ liệu tổng quan công ty.</div>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={16}>
              <Card
                title={`Lịch sử giá — ${selectedTicker}`}
                extra={
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <Select
                      value={range}
                      onChange={(v) => {
                        setRange(v);
                        // Trigger reload explicitly if needed or wait for next search
                        // Better user experience: re-fetch immediately
                        searchTicker(selectedTicker);
                      }}
                      style={{ width: 120 }}
                    >
                      <Option value="1m">1 tháng</Option>
                      <Option value="3m">3 tháng</Option>
                      <Option value="6m">6 tháng</Option>
                      <Option value="1y">1 năm</Option>
                    </Select>
                    <Button
                      size="small"
                      onClick={() => searchTicker(selectedTicker)}
                    >
                      Làm mới
                    </Button>
                  </div>
                }
              >
                {history && history.length > 0 ? (
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="close" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div>Không có dữ liệu lịch sử.</div>
                )}
              </Card>

              <Card title="Chỉ số nhanh" style={{ marginTop: 16 }}>
                {overview ? (
                  <Row gutter={16}>
                    <Col span={8}>
                      <div>Giá hiện tại</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {overview.lastPrice ?? "—"}
                      </div>
                    </Col>
                    <Col span={8}>
                      <div>Thay đổi</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {overview.change ?? "—"}
                      </div>
                    </Col>
                    <Col span={8}>
                      <div>% Thay đổi</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {overview.changePercent ?? "—"}
                      </div>
                    </Col>
                  </Row>
                ) : (
                  <div>Chưa có chỉ số.</div>
                )}
              </Card>
            </Col>
          </Row>
        )}
      </Content>
    </Layout>
  );
}
