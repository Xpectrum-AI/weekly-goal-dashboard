"use client";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const axisProps = {
  tick: { fill: "#94a3b8", fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 40px -10px rgb(15 23 42 / 0.25)",
    fontSize: 12,
  },
  labelStyle: { fontWeight: 600, color: "#0f172a" },
};

export function TrendArea({
  data,
  dataKey,
  color = "#4f46e5",
  unit = "%",
}: {
  data: any[];
  dataKey: string;
  color?: string;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="week" {...axisProps} />
        <YAxis {...axisProps} unit={unit} />
        <Tooltip {...tooltipStyle} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#grad-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({
  data,
  series,
}: {
  data: any[];
  series: { key: string; color: string; label: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="week" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data,
  dataKey,
  xKey,
  colors,
  horizontal = false,
  unit,
}: {
  data: any[];
  dataKey: string;
  xKey: string;
  colors?: string[];
  horizontal?: boolean;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 16, left: horizontal ? 8 : -16, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axisProps} unit={unit} />
            <YAxis
              type="category"
              dataKey={xKey}
              {...axisProps}
              width={130}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} unit={unit} />
          </>
        )}
        <Tooltip {...tooltipStyle} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey={dataKey} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={colors ? colors[i % colors.length] : "#6366f1"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={84}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => <span className="text-ink-600">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DeptRadar({
  data,
}: {
  data: { metric: string; [k: string]: any }[];
  // each entry has metric + one value key per department
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: "#64748b", fontSize: 11 }}
        />
        <PolarRadiusAxis tick={{ fill: "#cbd5e1", fontSize: 10 }} angle={30} />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#4f46e5"
          fill="#6366f1"
          fillOpacity={0.4}
          strokeWidth={2}
        />
        <Tooltip {...tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
