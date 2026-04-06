'use client';

import { useState } from 'react';
import { meses } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface CobroData {
  mes: number;
  anio: number;
  monto: number;
  estado: string;
}

interface VentaData {
  total: number;
  ganancia: number;
  tipo: string;
  created_at: string;
}

interface Props {
  cobros: CobroData[];
  ventas: VentaData[];
  year: number;
}

const COLORS = {
  blue: '#3B82F6',
  green: '#10B981',
  purple: '#8B5CF6',
  yellow: '#F59E0B',
};

const PIE_COLORS = [COLORS.blue, COLORS.purple];

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString('es-DO');
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C2333] border border-[#1F2937] rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-300 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatCurrencyFull(entry.value)}
        </p>
      ))}
    </div>
  );
};

export default function ReportesClient({ cobros, ventas, year }: Props) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'cobros' | 'ventas'>('resumen');

  // --- Data Processing ---

  // Cobros pagados by month
  const cobrosPorMes = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const total = cobros
      .filter((c) => c.mes === mes && c.estado === 'pagado')
      .reduce((sum, c) => sum + c.monto, 0);
    return { mes: meses[i].substring(0, 3), total };
  });

  const totalCobrosPagados = cobros
    .filter((c) => c.estado === 'pagado')
    .reduce((sum, c) => sum + c.monto, 0);

  // Ventas by month
  const ventasPorMes = Array.from({ length: 12 }, (_, i) => {
    const mesNum = i + 1;
    const mesVentas = ventas.filter((v) => {
      const d = new Date(v.created_at);
      return d.getMonth() + 1 === mesNum;
    });
    const total = mesVentas.reduce((sum, v) => sum + v.total, 0);
    const ganancia = mesVentas.reduce((sum, v) => sum + v.ganancia, 0);
    return { mes: meses[i].substring(0, 3), total, ganancia };
  });

  const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
  const totalGanancia = ventas.reduce((sum, v) => sum + v.ganancia, 0);

  // Tipo distribution for pie
  const directas = ventas.filter((v) => v.tipo === 'directa');
  const revendedor = ventas.filter((v) => v.tipo === 'revendedor');
  const pieData = [
    { name: 'Directa', value: directas.reduce((sum, v) => sum + v.total, 0) },
    { name: 'Revendedor', value: revendedor.reduce((sum, v) => sum + v.total, 0) },
  ].filter((d) => d.value > 0);

  // KPI
  const totalIngresos = totalCobrosPagados + totalVentas;
  const margenPromedio = totalVentas > 0 ? (totalGanancia / totalVentas) * 100 : 0;

  const tabs = [
    { key: 'resumen' as const, label: 'Resumen' },
    { key: 'cobros' as const, label: 'Cobros' },
    { key: 'ventas' as const, label: 'Ventas' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Reportes</h1>
        <p className="text-sm text-gray-400">Analisis financiero {year}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1F2937]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-400">Total Ingresos</p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrencyFull(totalIngresos)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-400">Cobros Pagados</p>
            <p className="text-2xl font-bold text-blue-400">
              {formatCurrencyFull(totalCobrosPagados)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-400">Total Ventas</p>
            <p className="text-2xl font-bold text-purple-400">
              {formatCurrencyFull(totalVentas)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-400">Margen Promedio</p>
            <p className="text-2xl font-bold text-yellow-400">{margenPromedio.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Tab: Cobros */}
      {activeTab === 'cobros' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Cobros Pagados por Mes - {year}
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cobrosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="mes" stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <YAxis
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={formatCurrencyShort}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Pagado" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Ventas */}
      {activeTab === 'ventas' && (
        <div className="space-y-6">
          {/* Ventas bar chart */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Ventas por Mes - {year}
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis
                    dataKey="mes"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    tickFormatter={formatCurrencyShort}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ color: '#9CA3AF' }}
                  />
                  <Bar
                    dataKey="total"
                    name="Total"
                    fill={COLORS.blue}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">
                Distribucion por Tipo
              </h3>
              <div className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={PIE_COLORS[idx % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1C2333',
                          border: '1px solid #1F2937',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatCurrencyFull(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Sin datos de ventas
                  </div>
                )}
              </div>
            </div>

            {/* Line chart - Ganancia */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">
                Ganancia por Mes
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ventasPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis
                      dataKey="mes"
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#6B7280"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      tickFormatter={formatCurrencyShort}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="ganancia"
                      name="Ganancia"
                      stroke={COLORS.green}
                      strokeWidth={2}
                      dot={{ fill: COLORS.green, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
