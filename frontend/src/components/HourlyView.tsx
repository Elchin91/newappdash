import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Calendar, Filter, Loader2, Download } from 'lucide-react';
import { GetHourlyData } from '../../wailsjs/go/main/App';
import { exportHourlyToExcel } from '../utils/excelExport';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Типы данных для почасового представления
interface HourlyData {
  date: string;
  hour_0: number;
  hour_1: number;
  hour_2: number;
  hour_3: number;
  hour_4: number;
  hour_5: number;
  hour_6: number;
  hour_7: number;
  hour_8: number;
  hour_9: number;
  hour_10: number;
  hour_11: number;
  hour_12: number;
  hour_13: number;
  hour_14: number;
  hour_15: number;
  hour_16: number;
  hour_17: number;
  hour_18: number;
  hour_19: number;
  hour_20: number;
  hour_21: number;
  hour_22: number;
  hour_23: number;
}

interface HourlyViewProps {
  queueName: string;
  startDate: string;
  endDate: string;
  activeMetric: string;
  shouldLoadData: boolean;
  onDataLoaded: () => void;
}

const HourlyView: React.FC<HourlyViewProps> = ({ 
  queueName, 
  startDate, 
  endDate, 
  activeMetric, 
  shouldLoadData, 
  onDataLoaded 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<HourlyData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Для метрики "total" храним данные по calls, chats и total
  const [totalData, setTotalData] = useState<{
    calls: HourlyData[];
    chats: HourlyData[];
    total: HourlyData[];
  }>({ calls: [], chats: [], total: [] });

  // Автоматическая загрузка при изменении флага, очереди или дат
  useEffect(() => {
    if (shouldLoadData) {
      loadData();
    }
  }, [shouldLoadData, queueName, startDate, endDate]);

  // Загрузка данных при смене метрики (только для перехода к/от Total)
  useEffect(() => {
    const hasData = tableData.length > 0 || Object.values(totalData).some(arr => arr.length > 0);
    if (hasData) {
      // Перезагружаем только если переходим к Total или от Total, так как у них разная структура данных
      const wasTotal = Object.values(totalData).some(arr => arr.length > 0);
      const isTotal = activeMetric === 'total';
      
      if (wasTotal !== isTotal) {
        loadData();
      }
    }
  }, [activeMetric]);

  // Обновление данных графика при смене активной метрики
  useEffect(() => {
    if (activeMetric === 'total') {
      updateTotalChartData();
    } else if (tableData.length > 0) {
      updateChartData();
    }
  }, [activeMetric, tableData, totalData]);

  // Обновление данных графика для обычных метрик
  const updateChartData = () => {
    if (!tableData || tableData.length === 0) {
      setChartData([]);
      return;
    }

    // Создаем данные для графика - среднее значение по часам
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    
    const chartItems = hours.map((hour, index) => {
      const hourKey = `hour_${index}` as keyof HourlyData;
      let sum = 0;
      let count = 0;
      
      tableData.forEach(row => {
        const value = row[hourKey] as number;
        if (value && value > 0) {
          sum += value;
          count++;
        }
      });
      
      const average = count > 0 ? sum / count : 0;
      
      return {
        date: hour,
        name: getMetricLabel(activeMetric),
        value: average
      };
    });

    setChartData(chartItems);
  };

  // Обновление данных графика для метрики "total"
  const updateTotalChartData = () => {
    if (!totalData.calls.length || !totalData.chats.length || !totalData.total.length) {
      setChartData([]);
      return;
    }

    // Создаем данные для графика - среднее значение по часам для каждой метрики
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    
    const chartItems = hours.map((hour, index) => {
      const hourKey = `hour_${index}` as keyof HourlyData;
      
      // Расчет среднего для calls
      let callsSum = 0, callsCount = 0;
      totalData.calls.forEach(row => {
        const value = row[hourKey] as number;
        if (value && value > 0) {
          callsSum += value;
          callsCount++;
        }
      });
      const callsAverage = callsCount > 0 ? callsSum / callsCount : 0;

      // Расчет среднего для chats
      let chatsSum = 0, chatsCount = 0;
      totalData.chats.forEach(row => {
        const value = row[hourKey] as number;
        if (value && value > 0) {
          chatsSum += value;
          chatsCount++;
        }
      });
      const chatsAverage = chatsCount > 0 ? chatsSum / chatsCount : 0;

      // Расчет среднего для total
      let totalSum = 0, totalCount = 0;
      totalData.total.forEach(row => {
        const value = row[hourKey] as number;
        if (value && value > 0) {
          totalSum += value;
          totalCount++;
        }
      });
      const totalAverage = totalCount > 0 ? totalSum / totalCount : 0;

      return {
        date: hour,
        calls: callsAverage,
        chats: chatsAverage,
        total: totalAverage
      };
    });

    setChartData(chartItems);
  };

  // Загрузка данных из API
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeMetric === 'total') {
        // Для метрики "total" загружаем calls, chats и total
        const [callsResponse, chatsResponse, totalResponse] = await Promise.all([
          GetHourlyData(startDate, endDate, queueName, 'calls'),
          GetHourlyData(startDate, endDate, queueName, 'chats'),
          GetHourlyData(startDate, endDate, queueName, 'total')
        ]);

        setTotalData({
          calls: callsResponse?.data || [],
          chats: chatsResponse?.data || [],
          total: totalResponse?.data || []
        });
        setTableData([]); // Очищаем обычные данные
      } else {
        // Для обычных метрик загружаем только одну метрику
        const response = await GetHourlyData(startDate, endDate, queueName, activeMetric);
        
        if (response && response.data) {
          setTableData(response.data as HourlyData[]);
        } else {
          setTableData([]);
        }
        setTotalData({ calls: [], chats: [], total: [] }); // Очищаем total данные
      }
      
      onDataLoaded();
    } catch (err) {
      console.error('Ошибка загрузки почасовых данных:', err);
      setError(`Ошибка загрузки данных: ${err}`);
      onDataLoaded();
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты как в DailyView
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', { 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // Получение читаемого названия метрики
  const getMetricLabel = (metric: string): string => {
    switch (metric) {
      case 'calls': return 'Calls';
      case 'aht': return 'AHT (sec)';
      case 'sl': return 'SL (%)';
      case 'abandoned': return 'Abandoned';
      case 'chats': return 'Chats';
      case 'frt': return 'FRT (sec)';
      case 'rt': return 'RT (sec)';
      case 'agents': return 'Agents';
      case 'total': return 'Total';
      default: return metric;
    }
  };

  // Получение цвета метрики
  const getMetricColor = (metric: string) => {
    switch (metric) {
      case 'calls': return '#3B82F6';
      case 'aht': return '#8B5CF6';
      case 'sl': return '#10B981';
      case 'abandoned': return '#EF4444';
      case 'chats': return '#8B5CF6';
      case 'frt': return '#EC4899';
      case 'rt': return '#6366F1';
      case 'agents': return '#F97316';
      case 'total': return '#10B981';
      default: return '#3B82F6';
    }
  };

  // Подготовка данных для Chart.js
  const prepareChartData = () => {
    if (!chartData || chartData.length === 0) return null;

    if (activeMetric === 'total') {
      // Для метрики "total" создаем три dataset'а
      const labels = chartData.map(item => item.date);
      
      return {
        labels,
        datasets: [
          {
            label: 'Calls',
            data: chartData.map(item => Math.round(item.calls || 0)),
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            hoverBackgroundColor: '#60A5FA',
            hoverBorderColor: '#3B82F6',
            hoverBorderWidth: 2,
          },
          {
            label: 'Chats',
            data: chartData.map(item => Math.round(item.chats || 0)),
            backgroundColor: '#8B5CF6',
            borderColor: '#7C3AED',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            hoverBackgroundColor: '#A78BFA',
            hoverBorderColor: '#8B5CF6',
            hoverBorderWidth: 2,
          },
          {
            label: 'Total',
            data: chartData.map(item => Math.round(item.total || 0)),
            backgroundColor: '#10B981',
            borderColor: '#059669',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            hoverBackgroundColor: '#34D399',
            hoverBorderColor: '#10B981',
            hoverBorderWidth: 2,
          }
        ]
      };
    } else {
      // Для обычных метрик один dataset
      const labels = chartData.map(item => item.date);
      
      return {
        labels,
        datasets: [
          {
            label: chartData[0]?.name || 'Value',
            data: chartData.map(item => Math.round(item.value)),
            backgroundColor: getMetricColor(activeMetric),
            borderColor: '#0284C7',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            // Улучшенные эффекты при наведении
            hoverBackgroundColor: '#38BDF8',
            hoverBorderColor: '#0EA5E9',
            hoverBorderWidth: 3,
            hoverBorderRadius: 6,
          }
        ]
      };
    }
  };

  // Создаем кастомный плагин для отображения чисел над столбцами
  const dataLabelsPlugin = {
    id: 'dataLabels',
    afterDatasetsDraw(chart: any) {
      const { ctx, data } = chart;
      ctx.save();
      ctx.font = 'bold 11px Arial';
      ctx.fillStyle = '#F3F4F6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar: any, index: number) => {
          const value = dataset.data[index];
          if (value > 0) {
            const textY = Math.max(bar.y - 8, chart.chartArea.top + 15);
            ctx.fillText(Math.round(value), bar.x, textY);
          }
        });
      });
      ctx.restore();
    }
  };

  // Опции для Chart.js
  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 30
      }
    },
    plugins: {
      legend: {
        display: false, // Убираем легенду даже для total
        position: 'top',
        labels: {
          color: '#F3F4F6',
          font: {
            size: 12
          },
          usePointStyle: true,
          pointStyle: 'rect'
        }
      },
      tooltip: {
        backgroundColor: '#1F2937',
        titleColor: '#F3F4F6',
        bodyColor: '#F3F4F6',
        borderColor: '#374151',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${Math.round(context.raw as number)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          }
        },
        grid: {
          color: '#374151',
        }
      },
      y: {
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
          callback: function(value) {
            return Math.round(value as number);
          }
        },
        grid: {
          color: '#374151',
        },
        beginAtZero: true,
        grace: '15%'
      }
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    elements: {
      bar: {
        borderRadius: 4,
      }
    },
    onHover: (event, activeElements) => {
      const canvas = event.native?.target as HTMLCanvasElement;
      if (canvas) {
        canvas.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
      }
    }
  };

  // Расчет итогов
  const calculateTotals = () => {
    if (activeMetric === 'total') {
      // Для total считаем итоги по всем трем метрикам
      let callsTotal = 0, chatsTotal = 0, totalTotal = 0;

      totalData.calls.forEach(row => {
        for (let i = 0; i < 24; i++) {
          const hourKey = `hour_${i}` as keyof HourlyData;
          const value = row[hourKey] as number;
          if (value && value > 0) {
            callsTotal += value;
          }
        }
      });

      totalData.chats.forEach(row => {
        for (let i = 0; i < 24; i++) {
          const hourKey = `hour_${i}` as keyof HourlyData;
          const value = row[hourKey] as number;
          if (value && value > 0) {
            chatsTotal += value;
          }
        }
      });

      totalData.total.forEach(row => {
        for (let i = 0; i < 24; i++) {
          const hourKey = `hour_${i}` as keyof HourlyData;
          const value = row[hourKey] as number;
          if (value && value > 0) {
            totalTotal += value;
          }
        }
      });

      return {
        calls: callsTotal,
        chats: chatsTotal,
        total: totalTotal,
        contacts: callsTotal + chatsTotal
      };
    } else {
      // Для обычных метрик
      if (!tableData || tableData.length === 0) return {};

      // Определяем нужна ли сумма или среднее для данной метрики
      const shouldSum = ['calls', 'chats', 'abandoned', 'agents'].includes(activeMetric);
      
      let total = 0;
      let count = 0;
      let validValues = 0;

      tableData.forEach(row => {
        for (let i = 0; i < 24; i++) {
          const hourKey = `hour_${i}` as keyof HourlyData;
          const value = row[hourKey] as number;
          if (value && value > 0) {
            total += value;
            validValues++;
          }
          count++;
        }
      });

      if (shouldSum) {
        // Для количественных метрик возвращаем сумму
        return {
          total: total,
          average: validValues > 0 ? total / validValues : 0
        };
      } else {
        // Для качественных метрик (aht, sl, frt, rt) возвращаем среднее
        return {
          total: total,
          average: validValues > 0 ? total / validValues : 0
        };
      }
    }
  };

  // Рендер таблицы почасовых данных
  const renderHourlyTable = () => {
    if (activeMetric === 'total') {
      return renderTotalTable();
    }

    if (!tableData || tableData.length === 0) return null;

    // Создание массива часов для заголовков таблицы
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-700">
              <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 sticky left-0 bg-dark-700 z-10">
                Date
              </th>
              {hours.map((hour) => (
                <th key={hour} className="px-3 py-3 text-center font-medium text-white border-r border-dark-600 text-sm min-w-[60px]">
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {tableData.map((row, index) => (
              <tr key={index} className="hover:bg-dark-700/50">
                <td className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 sticky left-0 bg-dark-800 hover:bg-dark-700/50">
                  {formatDate(row.date)}
                </td>
                {hours.map((_, hourIndex) => {
                  const hourKey = `hour_${hourIndex}` as keyof HourlyData;
                  const value = row[hourKey] as number;
                  return (
                    <td key={hourIndex} className="px-3 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {value && value > 0 ? value.toLocaleString() : '0'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Рендер таблицы для метрики "total"
  const renderTotalTable = () => {
    if (!totalData.calls.length || !totalData.chats.length || !totalData.total.length) return null;

    // Создание массива часов для заголовков таблицы
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

    // Получаем все уникальные даты
    const allDates = [...new Set([
      ...totalData.calls.map(row => row.date),
      ...totalData.chats.map(row => row.date),
      ...totalData.total.map(row => row.date)
    ])].sort();

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-700">
              <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 sticky left-0 bg-dark-700 z-10">
                Metric
              </th>
              {hours.map((hour) => (
                <th key={hour} className="px-3 py-3 text-center font-medium text-white border-r border-dark-600 text-sm min-w-[60px]">
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {/* Строка для Calls */}
            <tr className="hover:bg-dark-700/50">
              <td className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 sticky left-0 bg-dark-800 hover:bg-dark-700/50">
                Calls
              </td>
              {hours.map((_, hourIndex) => {
                const hourKey = `hour_${hourIndex}` as keyof HourlyData;
                let total = 0;
                totalData.calls.forEach(row => {
                  const value = row[hourKey] as number;
                  if (value && value > 0) {
                    total += value;
                  }
                });
                return (
                  <td key={hourIndex} className="px-3 py-3 text-center text-white border-r border-dark-600 text-sm">
                    {total > 0 ? total.toLocaleString() : '0'}
                  </td>
                );
              })}
            </tr>
            
            {/* Строка для Chats */}
            <tr className="hover:bg-dark-700/50">
              <td className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 sticky left-0 bg-dark-800 hover:bg-dark-700/50">
                Chats
              </td>
              {hours.map((_, hourIndex) => {
                const hourKey = `hour_${hourIndex}` as keyof HourlyData;
                let total = 0;
                totalData.chats.forEach(row => {
                  const value = row[hourKey] as number;
                  if (value && value > 0) {
                    total += value;
                  }
                });
                return (
                  <td key={hourIndex} className="px-3 py-3 text-center text-white border-r border-dark-600 text-sm">
                    {total > 0 ? total.toLocaleString() : '0'}
                  </td>
                );
              })}
            </tr>
            
            {/* Строка для Total */}
            <tr className="hover:bg-dark-700/50">
              <td className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 sticky left-0 bg-dark-800 hover:bg-dark-700/50">
                Total
              </td>
              {hours.map((_, hourIndex) => {
                const hourKey = `hour_${hourIndex}` as keyof HourlyData;
                let total = 0;
                totalData.total.forEach(row => {
                  const value = row[hourKey] as number;
                  if (value && value > 0) {
                    total += value;
                  }
                });
                return (
                  <td key={hourIndex} className="px-3 py-3 text-center text-white border-r border-dark-600 text-sm">
                    {total > 0 ? total.toLocaleString() : '0'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Экспорт почасовых данных
  const handleExport = () => {
    if (activeMetric === 'total') {
      // Для total экспортируем все три набора данных
      if (totalData.calls.length > 0 || totalData.chats.length > 0 || totalData.total.length > 0) {
        exportHourlyToExcel(totalData.total, activeMetric, queueName, startDate, endDate);
      }
    } else {
      if (tableData.length > 0) {
        exportHourlyToExcel(tableData, activeMetric, queueName, startDate, endDate);
      }
    }
  };

  return (
    <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Hourly Statistics - {queueName.toUpperCase()}
            </h1>
            <p className="text-gray-400">
              Period: {startDate} - {endDate} | Metric: {activeMetric.toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Last Update</div>
            <div className="text-lg font-semibold text-white">
              {new Date().toLocaleTimeString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 p-6 rounded-lg mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-red-400 font-medium">Error:</span>
            <span className="text-white">{error}</span>
          </div>
        </div>
      )}

      {/* График */}
      {!loading && !error && chartData.length > 0 && (
        <div className="bg-dark-800 p-6 rounded-lg border border-dark-700 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">
              {activeMetric.toUpperCase()}
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={handleExport}
                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                disabled={activeMetric === 'total' ? 
                  (!totalData.calls.length && !totalData.chats.length && !totalData.total.length) : 
                  (!tableData || tableData.length === 0)
                }
              >
                <Download size={14} />
                <span>Export Hourly</span>
              </button>
            </div>
          </div>
          
          <div style={{ width: '100%', height: 300 }}>
            {chartData && chartData.length > 0 ? (
              <Bar data={prepareChartData()!} options={chartOptions} plugins={[dataLabelsPlugin]} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No data available for chart
              </div>
            )}
          </div>

          {/* Статистика */}
          {(() => {
            const totals = calculateTotals();
            
            if (activeMetric === 'total') {
              return (
                <div className="mt-4 text-sm text-gray-400 space-y-1">
                  <div>Total Calls: {totals.calls?.toLocaleString()}</div>
                  <div>Total Chats: {totals.chats?.toLocaleString()}</div>
                  <div>Total Contacts: {totals.contacts?.toLocaleString()}</div>
                </div>
              );
            } else {
              const display = activeMetric === 'aht' || activeMetric === 'frt' || activeMetric === 'rt' || activeMetric === 'sl'
                ? `Average for period: ${totals.average?.toFixed(2)} ${activeMetric === 'sl' ? '%' : activeMetric.includes('ht') || activeMetric.includes('rt') ? 'sec' : ''}`
                : `Total for period: ${totals.total?.toLocaleString()}`;

              return (
                <div className="mt-4 text-sm text-gray-400">
                  <div>{display}</div>
                </div>
              );
            }
          })()}
        </div>
      )}

      {/* Горизонтальная таблица */}
      {!loading && !error && (
        (activeMetric === 'total' ? 
          (totalData.calls.length > 0 || totalData.chats.length > 0 || totalData.total.length > 0) : 
          tableData.length > 0
        )
      ) && (
        <div className="bg-dark-800 rounded-lg border border-dark-700">
          <div className="p-6 border-b border-dark-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Hourly Data Table
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Showing hourly breakdown for {activeMetric.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
          
          {renderHourlyTable()}
          
          <div className="p-4 border-t border-dark-700 text-sm text-gray-400">
            Showing 1 to 1 of 1 entries
          </div>
        </div>
      )}
    </div>
  );
};

export default HourlyView; 