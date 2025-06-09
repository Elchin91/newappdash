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
import { Calendar, Filter, Loader2, Play, Download, FileSpreadsheet } from 'lucide-react';
import { GetDailyData } from '../../wailsjs/go/main/App';
import { exportMetricToExcel, exportAllDataToExcel, exportHourlyDetailedToExcel } from '../utils/excelExport';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Типы данных
interface DailyData {
  date: string;
  total_calls: number;
  avg_call_duration: string;
  avg_call_duration_minutes: number;
  sl: number;
  total_abandoned: number;
  total_chats: number;
  avg_chat_frt: string;
  resolution_time_avg: string;
  distinct_agents: number;
  total_inquiries: number;
}

// Интерфейс для почасовых данных (Detailed daily)
interface HourlyDetailedData {
  date: string;
  metric: string;
  hour_0: number | string;
  hour_1: number | string;
  hour_2: number | string;
  hour_3: number | string;
  hour_4: number | string;
  hour_5: number | string;
  hour_6: number | string;
  hour_7: number | string;
  hour_8: number | string;
  hour_9: number | string;
  hour_10: number | string;
  hour_11: number | string;
  hour_12: number | string;
  hour_13: number | string;
  hour_14: number | string;
  hour_15: number | string;
  hour_16: number | string;
  hour_17: number | string;
  hour_18: number | string;
  hour_19: number | string;
  hour_20: number | string;
  hour_21: number | string;
  hour_22: number | string;
  hour_23: number | string;
}

interface DailyViewProps {
  queueName: string;
  startDate: string;
  endDate: string;
  activeMetric: string;
  shouldLoadData: boolean; // Флаг для загрузки данных
  onDataLoaded: () => void; // Колбэк после загрузки
}

const DailyView: React.FC<DailyViewProps> = ({ queueName, startDate, endDate, activeMetric, shouldLoadData, onDataLoaded }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<DailyData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [hourlyDetailedData, setHourlyDetailedData] = useState<HourlyDetailedData[]>([]);
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  // Отслеживаем изменения темы
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Автоматическая загрузка при изменении флага, очереди или дат
  useEffect(() => {
    if (shouldLoadData) {
      loadData();
    }
  }, [shouldLoadData, queueName, startDate, endDate]);

  // Обновление данных графика при смене активной метрики или данных
  useEffect(() => {
    if (tableData.length > 0) {
      updateChartData();
      
      // Генерируем почасовые данные для detailed_daily
      if (activeMetric === 'detailed_daily') {
        const hourlyData = generateMockHourlyData();
        setHourlyDetailedData(hourlyData);
      }
    }
  }, [activeMetric, tableData]);

  // Конвертация времени в минуты
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || timeStr === '00:00:00') return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0] || '0');
    const minutes = parseInt(parts[1] || '0');
    const seconds = parseInt(parts[2] || '0');
    return hours * 60 + minutes + seconds / 60;
  };

  // Обновление данных графика на основе активной метрики
  const updateChartData = () => {
    if (tableData.length === 0) return;

    let chartRows: any[] = [];
    switch (activeMetric) {
      case 'calls':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: row.total_calls,
          name: 'Calls'
        }));
        break;
      case 'aht':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: row.avg_call_duration_minutes,
          name: 'AHT (min.)'
        }));
        break;
      case 'sl':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: row.sl,
          name: 'SL (%)'
        }));
        break;
      case 'abandoned':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: row.total_abandoned,
          name: 'Abandoned'
        }));
        break;
      case 'chats':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: row.total_chats,
          name: 'Chats'
        }));
        break;
      case 'frt':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: timeToMinutes(row.avg_chat_frt),
          name: 'FRT (min.)'
        }));
        break;
      case 'rt':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          value: timeToMinutes(row.resolution_time_avg),
          name: 'RT (min.)'
        }));
        break;
      case 'total':
        chartRows = tableData.map(row => ({
          date: formatDate(row.date),
          calls: row.total_calls,
          chats: row.total_chats,
          total: row.total_inquiries,
          agents: row.distinct_agents,
          name: 'Total'
        }));
        break;
      case 'detailed_daily':
        // Для detailed_daily не показываем график, только таблицу
        chartRows = [];
        break;
      default:
        chartRows = [];
    }

    setChartData(chartRows);
  };

  // Генерация заглушки почасовых данных на основе дат периода
  const generateMockHourlyData = () => {
    if (tableData.length === 0) return [];

    const mockData: HourlyDetailedData[] = [];
    
    // Для каждого дня в периоде создаем строки для каждой метрики
    tableData.forEach(dayData => {
      const date = formatDate(dayData.date);
      
      // Calls - звонки по часам
      const callsRow: HourlyDetailedData = {
        date,
        metric: 'Calls',
        hour_0: Math.floor(Math.random() * 20),
        hour_1: Math.floor(Math.random() * 10),
        hour_2: Math.floor(Math.random() * 5),
        hour_3: Math.floor(Math.random() * 5),
        hour_4: Math.floor(Math.random() * 5),
        hour_5: Math.floor(Math.random() * 10),
        hour_6: Math.floor(Math.random() * 15),
        hour_7: Math.floor(Math.random() * 25),
        hour_8: Math.floor(Math.random() * 35),
        hour_9: Math.floor(Math.random() * 40),
        hour_10: Math.floor(Math.random() * 45),
        hour_11: Math.floor(Math.random() * 50),
        hour_12: Math.floor(Math.random() * 55),
        hour_13: Math.floor(Math.random() * 60),
        hour_14: Math.floor(Math.random() * 65),
        hour_15: Math.floor(Math.random() * 60),
        hour_16: Math.floor(Math.random() * 55),
        hour_17: Math.floor(Math.random() * 50),
        hour_18: Math.floor(Math.random() * 45),
        hour_19: Math.floor(Math.random() * 40),
        hour_20: Math.floor(Math.random() * 35),
        hour_21: Math.floor(Math.random() * 25),
        hour_22: Math.floor(Math.random() * 20),
        hour_23: Math.floor(Math.random() * 15),
      };

      // AHT - среднее время по часам (в минутах)
      const ahtRow: HourlyDetailedData = {
        date,
        metric: 'AHT (min)',
        hour_0: Math.floor(Math.random() * 3) + 2,
        hour_1: Math.floor(Math.random() * 3) + 2,
        hour_2: Math.floor(Math.random() * 3) + 2,
        hour_3: Math.floor(Math.random() * 3) + 2,
        hour_4: Math.floor(Math.random() * 3) + 2,
        hour_5: Math.floor(Math.random() * 3) + 2,
        hour_6: Math.floor(Math.random() * 3) + 2,
        hour_7: Math.floor(Math.random() * 3) + 2,
        hour_8: Math.floor(Math.random() * 3) + 2,
        hour_9: Math.floor(Math.random() * 3) + 2,
        hour_10: Math.floor(Math.random() * 3) + 2,
        hour_11: Math.floor(Math.random() * 3) + 2,
        hour_12: Math.floor(Math.random() * 3) + 2,
        hour_13: Math.floor(Math.random() * 3) + 2,
        hour_14: Math.floor(Math.random() * 3) + 2,
        hour_15: Math.floor(Math.random() * 3) + 2,
        hour_16: Math.floor(Math.random() * 3) + 2,
        hour_17: Math.floor(Math.random() * 3) + 2,
        hour_18: Math.floor(Math.random() * 3) + 2,
        hour_19: Math.floor(Math.random() * 3) + 2,
        hour_20: Math.floor(Math.random() * 3) + 2,
        hour_21: Math.floor(Math.random() * 3) + 2,
        hour_22: Math.floor(Math.random() * 3) + 2,
        hour_23: Math.floor(Math.random() * 3) + 2,
      };

      // SL - уровень сервиса по часам (в процентах)
      const slRow: HourlyDetailedData = {
        date,
        metric: 'SL (%)',
        hour_0: Math.floor(Math.random() * 20) + 80,
        hour_1: Math.floor(Math.random() * 20) + 80,
        hour_2: Math.floor(Math.random() * 20) + 80,
        hour_3: Math.floor(Math.random() * 20) + 80,
        hour_4: Math.floor(Math.random() * 20) + 80,
        hour_5: Math.floor(Math.random() * 20) + 80,
        hour_6: Math.floor(Math.random() * 20) + 80,
        hour_7: Math.floor(Math.random() * 20) + 80,
        hour_8: Math.floor(Math.random() * 20) + 80,
        hour_9: Math.floor(Math.random() * 20) + 80,
        hour_10: Math.floor(Math.random() * 20) + 80,
        hour_11: Math.floor(Math.random() * 20) + 80,
        hour_12: Math.floor(Math.random() * 20) + 80,
        hour_13: Math.floor(Math.random() * 20) + 80,
        hour_14: Math.floor(Math.random() * 20) + 80,
        hour_15: Math.floor(Math.random() * 20) + 80,
        hour_16: Math.floor(Math.random() * 20) + 80,
        hour_17: Math.floor(Math.random() * 20) + 80,
        hour_18: Math.floor(Math.random() * 20) + 80,
        hour_19: Math.floor(Math.random() * 20) + 80,
        hour_20: Math.floor(Math.random() * 20) + 80,
        hour_21: Math.floor(Math.random() * 20) + 80,
        hour_22: Math.floor(Math.random() * 20) + 80,
        hour_23: Math.floor(Math.random() * 20) + 80,
      };

      // Abandoned - заброшенные звонки по часам
      const abandonedRow: HourlyDetailedData = {
        date,
        metric: 'Abandoned',
        hour_0: Math.floor(Math.random() * 3),
        hour_1: Math.floor(Math.random() * 2),
        hour_2: Math.floor(Math.random() * 1),
        hour_3: Math.floor(Math.random() * 1),
        hour_4: Math.floor(Math.random() * 1),
        hour_5: Math.floor(Math.random() * 2),
        hour_6: Math.floor(Math.random() * 3),
        hour_7: Math.floor(Math.random() * 5),
        hour_8: Math.floor(Math.random() * 8),
        hour_9: Math.floor(Math.random() * 10),
        hour_10: Math.floor(Math.random() * 12),
        hour_11: Math.floor(Math.random() * 15),
        hour_12: Math.floor(Math.random() * 18),
        hour_13: Math.floor(Math.random() * 20),
        hour_14: Math.floor(Math.random() * 18),
        hour_15: Math.floor(Math.random() * 15),
        hour_16: Math.floor(Math.random() * 12),
        hour_17: Math.floor(Math.random() * 10),
        hour_18: Math.floor(Math.random() * 8),
        hour_19: Math.floor(Math.random() * 6),
        hour_20: Math.floor(Math.random() * 5),
        hour_21: Math.floor(Math.random() * 4),
        hour_22: Math.floor(Math.random() * 3),
        hour_23: Math.floor(Math.random() * 2),
      };

      // Chats - чаты по часам
      const chatsRow: HourlyDetailedData = {
        date,
        metric: 'Chats',
        hour_0: Math.floor(Math.random() * 50),
        hour_1: Math.floor(Math.random() * 30),
        hour_2: Math.floor(Math.random() * 15),
        hour_3: Math.floor(Math.random() * 15),
        hour_4: Math.floor(Math.random() * 10),
        hour_5: Math.floor(Math.random() * 15),
        hour_6: Math.floor(Math.random() * 20),
        hour_7: Math.floor(Math.random() * 30),
        hour_8: Math.floor(Math.random() * 40),
        hour_9: Math.floor(Math.random() * 50),
        hour_10: Math.floor(Math.random() * 60),
        hour_11: Math.floor(Math.random() * 70),
        hour_12: Math.floor(Math.random() * 80),
        hour_13: Math.floor(Math.random() * 90),
        hour_14: Math.floor(Math.random() * 85),
        hour_15: Math.floor(Math.random() * 75),
        hour_16: Math.floor(Math.random() * 70),
        hour_17: Math.floor(Math.random() * 60),
        hour_18: Math.floor(Math.random() * 50),
        hour_19: Math.floor(Math.random() * 40),
        hour_20: Math.floor(Math.random() * 35),
        hour_21: Math.floor(Math.random() * 30),
        hour_22: Math.floor(Math.random() * 25),
        hour_23: Math.floor(Math.random() * 20),
      };

      // FRT - время первого ответа (в минутах)
      const frtRow: HourlyDetailedData = {
        date,
        metric: 'FRT (min)',
        hour_0: Math.floor(Math.random() * 2) + 1,
        hour_1: Math.floor(Math.random() * 2) + 1,
        hour_2: Math.floor(Math.random() * 2) + 1,
        hour_3: Math.floor(Math.random() * 2) + 1,
        hour_4: Math.floor(Math.random() * 2) + 1,
        hour_5: Math.floor(Math.random() * 2) + 1,
        hour_6: Math.floor(Math.random() * 2) + 1,
        hour_7: Math.floor(Math.random() * 2) + 1,
        hour_8: Math.floor(Math.random() * 2) + 1,
        hour_9: Math.floor(Math.random() * 2) + 1,
        hour_10: Math.floor(Math.random() * 2) + 1,
        hour_11: Math.floor(Math.random() * 2) + 1,
        hour_12: Math.floor(Math.random() * 2) + 1,
        hour_13: Math.floor(Math.random() * 2) + 1,
        hour_14: Math.floor(Math.random() * 2) + 1,
        hour_15: Math.floor(Math.random() * 2) + 1,
        hour_16: Math.floor(Math.random() * 2) + 1,
        hour_17: Math.floor(Math.random() * 2) + 1,
        hour_18: Math.floor(Math.random() * 2) + 1,
        hour_19: Math.floor(Math.random() * 2) + 1,
        hour_20: Math.floor(Math.random() * 2) + 1,
        hour_21: Math.floor(Math.random() * 2) + 1,
        hour_22: Math.floor(Math.random() * 2) + 1,
        hour_23: Math.floor(Math.random() * 2) + 1,
      };

      // RT - время решения (в минутах)
      const rtRow: HourlyDetailedData = {
        date,
        metric: 'RT (min)',
        hour_0: (Math.random() * 10 + 5).toFixed(1),
        hour_1: (Math.random() * 10 + 5).toFixed(1),
        hour_2: (Math.random() * 10 + 5).toFixed(1),
        hour_3: (Math.random() * 10 + 5).toFixed(1),
        hour_4: (Math.random() * 10 + 5).toFixed(1),
        hour_5: (Math.random() * 10 + 5).toFixed(1),
        hour_6: (Math.random() * 10 + 5).toFixed(1),
        hour_7: (Math.random() * 10 + 5).toFixed(1),
        hour_8: (Math.random() * 10 + 5).toFixed(1),
        hour_9: (Math.random() * 10 + 5).toFixed(1),
        hour_10: (Math.random() * 10 + 5).toFixed(1),
        hour_11: (Math.random() * 10 + 5).toFixed(1),
        hour_12: (Math.random() * 10 + 5).toFixed(1),
        hour_13: (Math.random() * 10 + 5).toFixed(1),
        hour_14: (Math.random() * 10 + 5).toFixed(1),
        hour_15: (Math.random() * 10 + 5).toFixed(1),
        hour_16: (Math.random() * 10 + 5).toFixed(1),
        hour_17: (Math.random() * 10 + 5).toFixed(1),
        hour_18: (Math.random() * 10 + 5).toFixed(1),
        hour_19: (Math.random() * 10 + 5).toFixed(1),
        hour_20: (Math.random() * 10 + 5).toFixed(1),
        hour_21: (Math.random() * 10 + 5).toFixed(1),
        hour_22: (Math.random() * 10 + 5).toFixed(1),
        hour_23: (Math.random() * 10 + 5).toFixed(1),
      };

      // Agents - количество агентов по часам
      const agentsRow: HourlyDetailedData = {
        date,
        metric: 'Agents',
        hour_0: Math.floor(Math.random() * 5) + 4,
        hour_1: Math.floor(Math.random() * 5) + 4,
        hour_2: Math.floor(Math.random() * 3) + 1,
        hour_3: Math.floor(Math.random() * 3) + 1,
        hour_4: Math.floor(Math.random() * 3) + 1,
        hour_5: Math.floor(Math.random() * 3) + 1,
        hour_6: Math.floor(Math.random() * 3) + 2,
        hour_7: Math.floor(Math.random() * 5) + 4,
        hour_8: Math.floor(Math.random() * 5) + 6,
        hour_9: Math.floor(Math.random() * 5) + 8,
        hour_10: Math.floor(Math.random() * 5) + 9,
        hour_11: Math.floor(Math.random() * 5) + 10,
        hour_12: Math.floor(Math.random() * 5) + 12,
        hour_13: Math.floor(Math.random() * 5) + 13,
        hour_14: Math.floor(Math.random() * 5) + 12,
        hour_15: Math.floor(Math.random() * 5) + 15,
        hour_16: Math.floor(Math.random() * 5) + 13,
        hour_17: Math.floor(Math.random() * 5) + 12,
        hour_18: Math.floor(Math.random() * 3) + 7,
        hour_19: Math.floor(Math.random() * 3) + 7,
        hour_20: Math.floor(Math.random() * 3) + 7,
        hour_21: Math.floor(Math.random() * 3) + 8,
        hour_22: Math.floor(Math.random() * 3) + 4,
        hour_23: Math.floor(Math.random() * 3) + 4,
      };

      // Total - общий итог по часам
      const totalRow: HourlyDetailedData = {
        date,
        metric: 'Total',
        hour_0: (callsRow.hour_0 as number) + (chatsRow.hour_0 as number),
        hour_1: (callsRow.hour_1 as number) + (chatsRow.hour_1 as number),
        hour_2: (callsRow.hour_2 as number) + (chatsRow.hour_2 as number),
        hour_3: (callsRow.hour_3 as number) + (chatsRow.hour_3 as number),
        hour_4: (callsRow.hour_4 as number) + (chatsRow.hour_4 as number),
        hour_5: (callsRow.hour_5 as number) + (chatsRow.hour_5 as number),
        hour_6: (callsRow.hour_6 as number) + (chatsRow.hour_6 as number),
        hour_7: (callsRow.hour_7 as number) + (chatsRow.hour_7 as number),
        hour_8: (callsRow.hour_8 as number) + (chatsRow.hour_8 as number),
        hour_9: (callsRow.hour_9 as number) + (chatsRow.hour_9 as number),
        hour_10: (callsRow.hour_10 as number) + (chatsRow.hour_10 as number),
        hour_11: (callsRow.hour_11 as number) + (chatsRow.hour_11 as number),
        hour_12: (callsRow.hour_12 as number) + (chatsRow.hour_12 as number),
        hour_13: (callsRow.hour_13 as number) + (chatsRow.hour_13 as number),
        hour_14: (callsRow.hour_14 as number) + (chatsRow.hour_14 as number),
        hour_15: (callsRow.hour_15 as number) + (chatsRow.hour_15 as number),
        hour_16: (callsRow.hour_16 as number) + (chatsRow.hour_16 as number),
        hour_17: (callsRow.hour_17 as number) + (chatsRow.hour_17 as number),
        hour_18: (callsRow.hour_18 as number) + (chatsRow.hour_18 as number),
        hour_19: (callsRow.hour_19 as number) + (chatsRow.hour_19 as number),
        hour_20: (callsRow.hour_20 as number) + (chatsRow.hour_20 as number),
        hour_21: (callsRow.hour_21 as number) + (chatsRow.hour_21 as number),
        hour_22: (callsRow.hour_22 as number) + (chatsRow.hour_22 as number),
        hour_23: (callsRow.hour_23 as number) + (chatsRow.hour_23 as number),
      };

      // Добавляем все строки для этого дня
      mockData.push(callsRow, ahtRow, slRow, abandonedRow, chatsRow, frtRow, rtRow, agentsRow, totalRow);
    });

    return mockData;
  };

  // Загрузка данных
  const loadData = async () => {
    // Убрана проверка очереди - теперь загружаем данные для всех очередей
    setLoading(true);
    setError(null);

    try {
      const result = await GetDailyData(startDate, endDate, queueName);
      setData(result);
      processData(result);
      onDataLoaded();
    } catch (err) {
      setError(`Data loading error: ${err}`);
      console.error('Data loading error:', err);
      onDataLoaded(); // Вызываем колбэк даже при ошибке
    } finally {
      setLoading(false);
    }
  };

  // Обработка данных
  const processData = (rawData: any) => {
    if (!rawData) return;

    // Собираем все даты
    const allDates = new Set<string>();
    Object.values(rawData).forEach((metricData: any) => {
      if (Array.isArray(metricData)) {
        metricData.forEach((item: any) => {
          if (item.date) allDates.add(item.date);
        });
      }
    });

    const sortedDates = Array.from(allDates).sort();

    // Создаем данные для таблицы
    const processedData: DailyData[] = sortedDates.map(date => {
      const callsItem = rawData.calls?.find((item: any) => item.date === date);
      const ahtItem = rawData.aht?.find((item: any) => item.date === date);
      const slItem = rawData.sl?.find((item: any) => item.date === date);
      const abandonedItem = rawData.abandoned?.find((item: any) => item.date === date);
      const chatsItem = rawData.chats?.find((item: any) => item.date === date);
      const frtItem = rawData.frt?.find((item: any) => item.date === date);
      const rtItem = rawData.rt?.find((item: any) => item.date === date);
      const agentsItem = rawData.agents?.find((item: any) => item.date === date);

      const ahtString = ahtItem?.avg_call_duration || '00:00:00';
      const totalCalls = callsItem?.total_calls || 0;
      const totalChats = chatsItem?.total_chats || 0;

      return {
        date,
        total_calls: totalCalls,
        avg_call_duration: ahtString,
        avg_call_duration_minutes: timeToMinutes(ahtString),
        sl: slItem?.sl || 0,
        total_abandoned: abandonedItem?.total_abandoned || 0,
        total_chats: totalChats,
        avg_chat_frt: frtItem?.avg_chat_frt || '00:00:00',
        resolution_time_avg: rtItem?.resolution_time_avg || '00:00:00',
        distinct_agents: agentsItem?.distinct_agents || 0,
        total_inquiries: totalCalls + totalChats
      };
    });

    setTableData(processedData);
    
    // Генерируем почасовые данные для detailed_daily
    if (activeMetric === 'detailed_daily') {
      const hourlyData = generateMockHourlyData();
      setHourlyDetailedData(hourlyData);
    }
  };

  // Форматирование даты
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', { 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

    // Цвет метрики (как у кнопки Apply)
  const getMetricColor = (metric: string) => {
    // Используем цвет кнопки Apply для всех одиночных метрик
    return '#0EA5E9'; // primary-500 цвет
  };

  // Подготовка данных для Chart.js
  const prepareChartData = () => {
    if (!chartData || chartData.length === 0) return null;

    const labels = chartData.map(item => item.date);
    
    if (activeMetric === 'total') {
      return {
        labels,
        datasets: [
          {
            label: 'Calls',
            data: chartData.map(item => item.calls),
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            // Улучшенные эффекты при наведении
            hoverBackgroundColor: '#60A5FA',
            hoverBorderColor: '#3B82F6',
            hoverBorderWidth: 3,
            hoverBorderRadius: 6,
          },
          {
            label: 'Chats',
            data: chartData.map(item => item.chats),
            backgroundColor: '#8B5CF6',
            borderColor: '#7C3AED',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            // Улучшенные эффекты при наведении
            hoverBackgroundColor: '#A78BFA',
            hoverBorderColor: '#8B5CF6',
            hoverBorderWidth: 3,
            hoverBorderRadius: 6,
          },
          {
            label: 'Total',
            data: chartData.map(item => item.total),
            backgroundColor: '#10B981',
            borderColor: '#059669',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            // Улучшенные эффекты при наведении
            hoverBackgroundColor: '#34D399',
            hoverBorderColor: '#10B981',
            hoverBorderWidth: 3,
            hoverBorderRadius: 6,
          },
          {
            label: 'Agents',
            data: chartData.map(item => item.agents),
            backgroundColor: '#F97316',
            borderColor: '#EA580C',
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            // Улучшенные эффекты при наведении
            hoverBackgroundColor: '#FB923C',
            hoverBorderColor: '#F97316',
            hoverBorderWidth: 3,
            hoverBorderRadius: 6,
          }
        ]
      };
    } else {
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
            hoverBackgroundColor: '#38BDF8', // Более яркий цвет при hover
            hoverBorderColor: '#0EA5E9',
            hoverBorderWidth: 3,
            hoverBorderRadius: 6, // Больше скругление при hover
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
      // Динамический цвет текста в зависимости от темы
      ctx.fillStyle = isDarkMode ? '#F3F4F6' : '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar: any, index: number) => {
          const value = dataset.data[index];
          if (value > 0) {
            // Убеждаемся что текст не выходит за пределы графика
            const textY = Math.max(bar.y - 8, chart.chartArea.top + 15);
            ctx.fillText(Math.round(value), bar.x, textY);
          }
        });
      });
      ctx.restore();
    }
  };

  // Функция для получения динамических настроек Chart.js в зависимости от темы
  const getChartOptions = (): ChartOptions<'bar'> => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      // Добавляем отступы для подписей над столбцами
      layout: {
        padding: {
          top: 30
        }
      },
      plugins: {
        // Скрываем легенду
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          titleColor: isDarkMode ? '#F3F4F6' : '#111827',
          bodyColor: isDarkMode ? '#F3F4F6' : '#374151',
          borderColor: isDarkMode ? '#374151' : '#D1D5DB',
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
            color: isDarkMode ? '#9CA3AF' : '#374151',
            font: {
              size: 11,
            }
          },
          grid: {
            color: isDarkMode ? '#374151' : '#E5E7EB',
          }
        },
        y: {
          ticks: {
            color: isDarkMode ? '#9CA3AF' : '#374151',
            font: {
              size: 11,
            },
            callback: function(value) {
              return Math.round(value as number);
            }
          },
          grid: {
            color: isDarkMode ? '#374151' : '#E5E7EB',
          },
          beginAtZero: true,
          // Добавляем отступ сверху для чисел над столбцами
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
      // Эффекты при наведении
      onHover: (event, activeElements) => {
        const canvas = event.native?.target as HTMLCanvasElement;
        if (canvas) {
          canvas.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
        }
      }
    };
  };

  // Target значения
  const getMetricTarget = (metric: string) => {
    switch (metric) {
      case 'aht': return { value: 3, label: 'target - 3 min.' };
      case 'sl': return { value: 95, label: 'target - 95%' };
      default: return null;
    }
  };

  // Расчет статистики
  const calculateTotals = () => {
    if (tableData.length === 0) return {};

    const totals = tableData.reduce((acc, row) => ({
      calls: acc.calls + row.total_calls,
      chats: acc.chats + row.total_chats,
      inquiries: acc.inquiries + row.total_inquiries,
      aht: acc.aht + row.avg_call_duration_minutes,
      sl: acc.sl + row.sl,
      abandoned: acc.abandoned + row.total_abandoned
    }), { calls: 0, chats: 0, inquiries: 0, aht: 0, sl: 0, abandoned: 0 });

    const count = tableData.length;
    return {
      totalCalls: totals.calls,
      totalChats: totals.chats,
      totalInquiries: totals.inquiries,
      totalAbandoned: totals.abandoned,
      avgAht: (totals.aht / count).toFixed(2),
      avgSl: (totals.sl / count).toFixed(2)
    };
  };

  // Рендер горизонтальной таблицы для конкретной метрики
  const renderMetricTable = () => {
    if (tableData.length === 0) return null;

    const dates = tableData.map(row => formatDate(row.date));
    
    const renderTableForMetric = (metricName: string, getValue: (row: DailyData) => any, formatValue?: (val: any) => string) => {
      const values = tableData.map(row => getValue(row));
      const total = values.reduce((sum, val) => typeof val === 'number' ? sum + val : sum, 0);
      const average = total / values.length;

      return (
        <tr>
          <td className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
            {metricName}
          </td>
          {values.map((value, index) => (
            <td key={index} className="px-4 py-3 text-center text-white border-r border-dark-600">
              {formatValue ? formatValue(value) : value?.toLocaleString?.() || value}
            </td>
          ))}
        </tr>
      );
    };

    // Рендер таблицы в зависимости от активной метрики
    switch (activeMetric) {
      case 'calls':
        const totals = calculateTotals();
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700">
                <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                  Metric / {new Date().getFullYear()}
                </th>
                {dates.map((date, index) => (
                  <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderTableForMetric('Calls', row => row.total_calls)}
            </tbody>
          </table>
        );

      case 'aht':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700">
                <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                  Metric / {new Date().getFullYear()}
                </th>
                {dates.map((date, index) => (
                  <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderTableForMetric('AHT (min)', row => row.avg_call_duration_minutes.toFixed(1))}
            </tbody>
          </table>
        );

      case 'sl':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700">
                <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                  Metric / {new Date().getFullYear()}
                </th>
                {dates.map((date, index) => (
                  <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderTableForMetric('SL (%)', row => row.sl, val => `${val.toFixed(1)}%`)}
            </tbody>
          </table>
        );

             case 'chats':
         return (
           <table className="w-full">
             <thead>
               <tr className="bg-dark-700">
                 <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                   Metric / {new Date().getFullYear()}
                 </th>
                 {dates.map((date, index) => (
                   <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                     {date}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody>
               {renderTableForMetric('Chats', row => row.total_chats)}
             </tbody>
           </table>
         );

       case 'frt':
         return (
           <table className="w-full">
             <thead>
               <tr className="bg-dark-700">
                 <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                   Metric / {new Date().getFullYear()}
                 </th>
                 {dates.map((date, index) => (
                   <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                     {date}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody>
               {renderTableForMetric('FRT (min)', row => timeToMinutes(row.avg_chat_frt).toFixed(1))}
             </tbody>
           </table>
         );

       case 'rt':
         return (
           <table className="w-full">
             <thead>
               <tr className="bg-dark-700">
                 <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                   Metric / {new Date().getFullYear()}
                 </th>
                 {dates.map((date, index) => (
                   <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                     {date}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody>
               {renderTableForMetric('RT (min)', row => timeToMinutes(row.resolution_time_avg).toFixed(1))}
             </tbody>
           </table>
         );

       case 'abandoned':
         return (
           <table className="w-full">
             <thead>
               <tr className="bg-dark-700">
                 <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                   Metric / {new Date().getFullYear()}
                 </th>
                 {dates.map((date, index) => (
                   <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                     {date}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody>
               {renderTableForMetric('Abandoned', row => row.total_abandoned)}
             </tbody>
           </table>
         );

      case 'total':
        return (
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700">
                <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                  Date
                </th>
                {dates.map((date, index) => (
                  <th key={index} className="px-4 py-3 text-center font-medium text-white border-r border-dark-600">
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              <tr>
                <td className="px-4 py-3 text-left font-medium text-orange-400 border-r border-dark-600">
                  Agents
                </td>
                {tableData.map((row, index) => (
                  <td key={index} className="px-4 py-3 text-center text-white border-r border-dark-600">
                    {row.distinct_agents}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-blue-400 border-r border-dark-600">
                  Calls
                </td>
                {tableData.map((row, index) => (
                  <td key={index} className="px-4 py-3 text-center text-white border-r border-dark-600">
                    {row.total_calls.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-purple-400 border-r border-dark-600">
                  Chats
                </td>
                {tableData.map((row, index) => (
                  <td key={index} className="px-4 py-3 text-center text-white border-r border-dark-600">
                    {row.total_chats.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-green-400 border-r border-dark-600">
                  Total
                </td>
                {tableData.map((row, index) => (
                  <td key={index} className="px-4 py-3 text-center text-white border-r border-dark-600">
                    {row.total_inquiries.toLocaleString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        );

      case 'detailed_daily':
        // Рендер почасовой таблицы для detailed_daily
        if (hourlyDetailedData.length === 0) {
          return (
            <div className="text-center py-8">
              <p className="text-gray-400">Загрузка почасовых данных...</p>
            </div>
          );
        }

        // Создаем массив часов для заголовков
        const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        
        // Группируем данные по дням
        const groupedByDate = hourlyDetailedData.reduce((acc, row) => {
          if (!acc[row.date]) {
            acc[row.date] = [];
          }
          acc[row.date].push(row);
          return acc;
        }, {} as Record<string, HourlyDetailedData[]>);

        return (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([date, dayData]) => (
              <div key={date} className="bg-gray-100 dark:bg-dark-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Метрика / {date}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-200 dark:bg-dark-600">
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white border-r border-gray-400 dark:border-dark-500 min-w-[120px]">
                          Метрика
                        </th>
                        {hours.map((hour) => (
                          <th key={hour} className="px-2 py-2 text-center font-medium text-gray-900 dark:text-white border-r border-gray-400 dark:border-dark-500 text-xs min-w-[50px]">
                            {hour}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 dark:divide-dark-500">
                      {dayData.map((row, index) => {
                        // Определяем цвет для каждой метрики
                        const getMetricRowColor = (metric: string) => {
                          switch (metric) {
                            case 'Calls': return 'text-blue-400';
                            case 'AHT (min)': return 'text-green-400';
                            case 'SL (%)': return 'text-yellow-400';
                            case 'Abandoned': return 'text-red-400';
                            case 'Chats': return 'text-purple-400';
                            case 'FRT (min)': return 'text-cyan-400';
                            case 'RT (min)': return 'text-pink-400';
                            case 'Agents': return 'text-orange-400';
                            case 'Total': return 'text-emerald-400';
                            default: return 'text-gray-900 dark:text-white';
                          }
                        };

                        return (
                          <tr key={index}>
                            <td className={`px-3 py-2 text-left font-medium border-r border-gray-400 dark:border-dark-500 ${getMetricRowColor(row.metric)}`}>
                              {row.metric}
                            </td>
                            {hours.map((_, hourIndex) => {
                              const hourKey = `hour_${hourIndex}` as keyof HourlyDetailedData;
                              const value = row[hourKey];
                              return (
                                <td key={hourIndex} className="px-2 py-2 text-center text-gray-900 dark:text-white border-r border-gray-400 dark:border-dark-500 text-xs">
                                  {value || '0'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  // Убрана проверка очереди - теперь поддерживаются все очереди (m10, AML, all)

  return (
    <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Daily Statistics - {queueName.toUpperCase()}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Period: {startDate} - {endDate} | Metric: {activeMetric.toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400">Last Update</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {new Date().toLocaleTimeString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500 p-6 rounded-lg mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-red-600 dark:text-red-400 font-medium">Error:</span>
            <span className="text-red-800 dark:text-white">{error}</span>
          </div>
        </div>
      )}

      {/* График - не показываем для detailed_daily */}
      {!loading && !error && chartData.length > 0 && activeMetric !== 'detailed_daily' && (
        <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeMetric === 'total' ? 'Total' : activeMetric.toUpperCase()}
              {getMetricTarget(activeMetric) && (
                <span className="text-gray-600 dark:text-gray-400 text-base ml-2">
                  ({getMetricTarget(activeMetric)?.label})
                </span>
              )}
            </h2>
            <div className="flex space-x-2">
              {activeMetric === 'detailed_daily' ? (
                // Кнопки экспорта для detailed_daily
                <button
                  onClick={() => exportHourlyDetailedToExcel(hourlyDetailedData, queueName, startDate, endDate)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                  disabled={!hourlyDetailedData || hourlyDetailedData.length === 0}
                >
                  <Download size={14} />
                  <span>Export Hourly</span>
                </button>
              ) : (
                // Стандартные кнопки экспорта
                <>
                  <button
                    onClick={() => exportMetricToExcel(tableData, activeMetric, queueName, startDate, endDate)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    disabled={!tableData || tableData.length === 0}
                  >
                    <Download size={14} />
                    <span>Export Current</span>
                  </button>
                  <button
                    onClick={() => exportAllDataToExcel(tableData, queueName, startDate, endDate)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                    disabled={!tableData || tableData.length === 0}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Export All</span>
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div style={{ width: '100%', height: 300 }}>
            {chartData && chartData.length > 0 ? (
              <Bar data={prepareChartData()!} options={getChartOptions()} plugins={[dataLabelsPlugin]} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 dark:text-gray-400">
                No data available for chart
              </div>
            )}
          </div>

          {/* Статистика */}
          {activeMetric !== 'total' && (() => {
            const totals = calculateTotals();
            let display = '';
            
                         switch (activeMetric) {
               case 'calls':
                 display = `Total for period: ${totals.totalCalls?.toLocaleString()}`;
                 break;
               case 'aht':
                 display = `Average for period: ${totals.avgAht}`;
                 break;
               case 'sl':
                 display = `Average for period: ${totals.avgSl}`;
                 break;
               case 'chats':
                 display = `Total for period: ${totals.totalChats?.toLocaleString()}`;
                 break;
               case 'abandoned':
                 display = `Total for period: ${totals.totalAbandoned?.toLocaleString()}`;
                 break;
               case 'frt':
               case 'rt':
                 // Для FRT и RT нужно вычислить средние значения
                 const avgTime = activeMetric === 'frt' 
                   ? tableData.reduce((sum, row) => sum + timeToMinutes(row.avg_chat_frt), 0) / tableData.length
                   : tableData.reduce((sum, row) => sum + timeToMinutes(row.resolution_time_avg), 0) / tableData.length;
                 display = `Average for period: ${avgTime.toFixed(2)} min`;
                 break;
             }

            return display ? (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <div>{display}</div>
              </div>
            ) : null;
          })()}

          {/* Статистика для Total */}
          {activeMetric === 'total' && (() => {
            const totals = calculateTotals();
            return (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>Total calls: {totals.totalCalls?.toLocaleString()}</div>
                <div>Total chats: {totals.totalChats?.toLocaleString()}</div>
                <div>Total inquiries: {totals.totalInquiries?.toLocaleString()}</div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Горизонтальная таблица */}
      {!loading && !error && tableData.length > 0 && (
        <div className="bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
          <div className="p-6 border-b border-gray-200 dark:border-dark-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {activeMetric === 'detailed_daily' ? 'Почасовые данные по дням' : 'Detailed Data Table'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  {activeMetric === 'detailed_daily' 
                    ? 'Показаны почасовые результаты каждой метрики за выбранный период'
                    : 'Showing entries'
                  }
                </p>
              </div>
              
              {/* Кнопки экспорта для detailed_daily в таблице */}
              {activeMetric === 'detailed_daily' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => exportHourlyDetailedToExcel(hourlyDetailedData, queueName, startDate, endDate)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    disabled={!hourlyDetailedData || hourlyDetailedData.length === 0}
                  >
                    <Download size={14} />
                    <span>Export Hourly</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {renderMetricTable()}
          </div>
          
          <div className="p-4 border-t border-gray-200 dark:border-dark-700 text-sm text-gray-600 dark:text-gray-400">
            Showing 1 to 1 of 1 entries
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyView; 