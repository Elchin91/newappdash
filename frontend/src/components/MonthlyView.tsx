import React, { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { GetMonthlyData } from '../../wailsjs/go/main/App';
import { exportMonthlyDataToExcel } from '../utils/excelExport';

// Интерфейсы для данных
interface MonthlyCallData {
  day: number;
  total_calls: number;
  avg_call_duration: string; // в формате HH:MM:SS
  sl: number;
  total_abandoned: number;
  distinct_agents: number;
}

interface MonthlyChatData {
  day: number;
  total_chats: number;
  avg_chat_frt: string; // в формате HH:MM:SS
  resolution_time_avg: string; // в формате HH:MM:SS
}

interface MonthlyViewProps {
  queueName: string;
  selectedMonth: string;
  shouldLoadData: boolean;
  onDataLoaded: () => void;
}



// Функция для получения количества дней в месяце
const getDaysInMonth = (year: number, month: number): number => {
  // month приходит в формате 1-12, но Date ожидает 0-11
  // Используем month (без -1), чтобы получить последний день нужного месяца
  return new Date(year, month, 0).getDate();
};

const MonthlyView: React.FC<MonthlyViewProps> = ({ 
  queueName, 
  selectedMonth, 
  shouldLoadData, 
  onDataLoaded 
}) => {
  const [callData, setCallData] = useState<MonthlyCallData[]>([]);
  const [chatData, setChatData] = useState<MonthlyChatData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Функция экспорта в Excel
  const handleExportToExcel = () => {
    if (!selectedMonth) {
      alert('Выберите месяц для экспорта данных');
      return;
    }
    
    if (callData.length === 0 && chatData.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    exportMonthlyDataToExcel(callData, chatData, queueName, selectedMonth);
  };

  // Загрузка данных
  const loadData = async () => {
    if (!selectedMonth) return;

    setLoading(true);
    setError('');

    try {
      // Формируем даты начала и конца месяца
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]);
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${getDaysInMonth(year, month)}`;

      console.log('Загружаем месячные данные для:', { startDate, endDate, queueName });

      const response = await GetMonthlyData(startDate, endDate, queueName);
      
      if (response && typeof response === 'object') {
        // Обрабатываем данные звонков
        if (response.calls && Array.isArray(response.calls)) {
          setCallData(response.calls);
        }
        
        // Обрабатываем данные чатов
        if (response.chats && Array.isArray(response.chats)) {
          setChatData(response.chats);
        }
      }

      onDataLoaded();
    } catch (error) {
      console.error('Ошибка загрузки месячных данных:', error);
      setError(`Ошибка загрузки данных: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем данные при изменении месяца или когда нужно обновить
  useEffect(() => {
    if (shouldLoadData) {
      loadData();
    }
  }, [selectedMonth, shouldLoadData, queueName]);

  // Объединенная таблица данных в формате как на скриншоте
  const renderMainTable = () => {
    if (!selectedMonth) {
      return (
        <div className="text-center py-8 text-gray-400">
          Выберите месяц для просмотра данных
        </div>
      );
    }

    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]);
    const daysInMonth = getDaysInMonth(year, month);
    
    // Детальная отладочная информация
    console.log('=== ДЕТАЛИ ОТЛАДКИ МЕСЯЦА ===');
    console.log('selectedMonth (из пропсов):', selectedMonth);
    console.log('разделение по "-":', selectedMonth.split('-'));
    console.log('parsed year:', year);
    console.log('parsed month (1-12):', month);
    console.log('daysInMonth:', daysInMonth);
    
    // Создаем массив всех дней месяца
    const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    // Создаем мапы данных по дням
    const callDataMap = new Map();
    const chatDataMap = new Map();
    
    callData.forEach(item => {
      callDataMap.set(item.day, item);
    });
    
    chatData.forEach(item => {
      chatDataMap.set(item.day, item);
    });

    // Получаем название месяца и год для заголовка
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    
    console.log('month - 1 (индекс для массива):', month - 1);
    console.log('все названия месяцев:', monthNames);
    console.log('monthNames[month - 1]:', monthNames[month - 1]);
    
    const monthName = monthNames[month - 1];
    
    console.log('итоговое название месяца:', monthName);
    console.log('итоговый заголовок: Metric /', monthName, year);
    console.log('===========================');

    return (
      <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-lg font-semibold text-white">Metric / {monthName} {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700">
                <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600 min-w-[120px]">
                  Metric
                </th>
                {allDays.map(day => (
                  <th key={day} className="px-2 py-3 text-center font-medium text-white border-r border-dark-600 min-w-[50px] text-sm">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {/* Звонки */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-blue-400 border-r border-dark-600">
                  Calls
                </td>
                {allDays.map(day => {
                  const dayData = callDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.total_calls.toLocaleString() : '0'}
                    </td>
                  );
                })}
              </tr>
              
              {/* AHT */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-green-400 border-r border-dark-600">
                  AHT (min)
                </td>
                {allDays.map(day => {
                  const dayData = callDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.avg_call_duration || '00:00:00' : '00:00:00'}
                    </td>
                  );
                })}
              </tr>
              
              {/* SL */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-yellow-400 border-r border-dark-600">
                  SL (%)
                </td>
                {allDays.map(day => {
                  const dayData = callDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? `${dayData.sl.toFixed(1)}%` : '0.0%'}
                    </td>
                  );
                })}
              </tr>
              
              {/* Заброшенные */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-red-400 border-r border-dark-600">
                  Abandoned
                </td>
                {allDays.map(day => {
                  const dayData = callDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.total_abandoned.toLocaleString() : '0'}
                    </td>
                  );
                })}
              </tr>
              
              {/* Чаты */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-purple-400 border-r border-dark-600">
                  Chats
                </td>
                {allDays.map(day => {
                  const dayData = chatDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.total_chats.toLocaleString() : '0'}
                    </td>
                  );
                })}
              </tr>
              
              {/* FRT */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-cyan-400 border-r border-dark-600">
                  FRT (min)
                </td>
                {allDays.map(day => {
                  const dayData = chatDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.avg_chat_frt || '00:00:00' : '00:00:00'}
                    </td>
                  );
                })}
              </tr>
              
              {/* RT */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-orange-400 border-r border-dark-600">
                  RT (min)
                </td>
                {allDays.map(day => {
                  const dayData = chatDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.resolution_time_avg || '00:00:00' : '00:00:00'}
                    </td>
                  );
                })}
              </tr>
              
              {/* Агенты */}
              <tr>
                <td className="px-4 py-3 text-left font-medium text-pink-400 border-r border-dark-600">
                  Agents
                </td>
                {allDays.map(day => {
                  const dayData = callDataMap.get(day);
                  return (
                    <td key={day} className="px-2 py-3 text-center text-white border-r border-dark-600 text-sm">
                      {dayData ? dayData.distinct_agents : '0'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Сводная таблица как на скриншоте
  const renderSummaryTable = () => {
    if (!selectedMonth || (callData.length === 0 && chatData.length === 0)) {
      return null;
    }

    // Вычисляем итоговые значения
    const totalCalls = callData.reduce((sum, item) => sum + item.total_calls, 0);
    const totalAbandoned = callData.reduce((sum, item) => sum + item.total_abandoned, 0);
    const totalChats = chatData.reduce((sum, item) => sum + item.total_chats, 0);
    
    // Средние значения
    const avgAht = callData.length > 0 ? 
      callData.reduce((sum, item, _, arr) => {
        // Конвертируем время в секунды для расчета среднего
        const timeToSeconds = (time: string) => {
          if (!time) return 0;
          const parts = time.split(':');
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        };
        return sum + timeToSeconds(item.avg_call_duration) / arr.length;
      }, 0) : 0;

    const avgSl = callData.length > 0 ? 
      callData.reduce((sum, item, _, arr) => sum + item.sl / arr.length, 0) : 0;

    const avgFrt = chatData.length > 0 ? 
      chatData.reduce((sum, item, _, arr) => {
        const timeToSeconds = (time: string) => {
          if (!time) return 0;
          const parts = time.split(':');
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        };
        return sum + timeToSeconds(item.avg_chat_frt) / arr.length;
      }, 0) : 0;

    const avgRt = chatData.length > 0 ? 
      chatData.reduce((sum, item, _, arr) => {
        const timeToSeconds = (time: string) => {
          if (!time) return 0;
          const parts = time.split(':');
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        };
        return sum + timeToSeconds(item.resolution_time_avg) / arr.length;
      }, 0) : 0;

    const formatSecondsToTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
      <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-lg font-semibold text-white">Period Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700">
                <th className="px-4 py-3 text-left font-medium text-white border-r border-dark-600">
                  Metric
                </th>
                <th className="px-4 py-3 text-center font-medium text-white">
                  Total/Average
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              <tr>
                <td className="px-4 py-3 text-left font-medium text-blue-400 border-r border-dark-600">
                  Calls
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {totalCalls.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-green-400 border-r border-dark-600">
                  AHT (Min)
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {formatSecondsToTime(avgAht)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-yellow-400 border-r border-dark-600">
                  SL
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {avgSl.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-red-400 border-r border-dark-600">
                  Abandoned
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {totalAbandoned.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-red-400 border-r border-dark-600">
                  Abandoned (%)
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {totalCalls > 0 ? ((totalAbandoned / totalCalls) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-purple-400 border-r border-dark-600">
                  Chats
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {totalChats.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-cyan-400 border-r border-dark-600">
                  FRT (min)
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {formatSecondsToTime(avgFrt)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-orange-400 border-r border-dark-600">
                  RT (min)
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {formatSecondsToTime(avgRt)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-left font-medium text-gray-400 border-r border-dark-600">
                  Total
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {(totalCalls + totalChats).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
      <div className="max-w-full">
        {/* Заголовок */}
        <div className="bg-dark-800 p-6 rounded-lg border border-dark-700 mb-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Месячный отчет</h2>
            <div className="flex space-x-2">
              <button
                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleExportToExcel}
                disabled={loading || !selectedMonth || (callData.length === 0 && chatData.length === 0)}
              >
                <Download size={14} />
                <span>Экспорт</span>
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center space-x-2 text-gray-400 mt-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Загрузка...</span>
            </div>
          )}

          {error && (
            <div className="mt-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Таблицы данных */}
        {selectedMonth && !loading && (
          <div className="space-y-6">
            {renderMainTable()}
            {renderSummaryTable()}
          </div>
        )}

        {/* Заглушка если месяц не выбран */}
        {!selectedMonth && !loading && (
          <div className="bg-dark-800 p-6 rounded-lg border border-dark-700 text-center">
            <p className="text-gray-400">Выберите месяц для просмотра данных</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyView; 