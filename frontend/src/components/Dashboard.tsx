import React, { useState, useEffect } from 'react';
import { Phone, TrendingUp, Users, Clock, Calendar, BarChart3, Download, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import DailyView from './DailyView';
import HourlyView from './HourlyView';
import MonthlyView from './MonthlyView';
import ClassifiersView from './ClassifiersView';
import { exportAllDataToExcel } from '../utils/excelExport';
import { TestMongoDBConnectionDetailed } from '../../wailsjs/go/main/App';

// Типы для состояния
type QueueFilter = 'all' | 'm10' | 'aml';
type DashboardView = 'daily' | 'hourly' | 'monthly' | 'classifiers' | 'online';
type StandardMetric = 'calls' | 'aht' | 'sl' | 'chats' | 'frt' | 'rt' | 'abandoned' | 'total' | 'detailed_daily';
type ClassifierMetric = 'call' | 'chat' | 'overall' | 'topics' | 'subtopics_daily';

interface DashboardProps {
  activeQueue: QueueFilter;
  activeView: DashboardView;
  activeStandardMetric: StandardMetric;
  activeClassifierMetric: ClassifierMetric;
  startDate: string;
  endDate: string;
  selectedMonth: string;
  shouldLoadData: boolean;
  onDataLoaded: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  activeQueue,
  activeView,
  activeStandardMetric,
  activeClassifierMetric,
  startDate,
  endDate,
  selectedMonth,
  shouldLoadData,
  onDataLoaded
}) => {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [mongoDebugInfo, setMongoDebugInfo] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [callsData, setCallsData] = useState({
    totalCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    averageCallDuration: '00:00',
    peakHour: '00:00',
    currentHourCalls: 0
  });

  useEffect(() => {
    // Установка текущей даты
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setCurrentDate(formattedDate);

    // Симуляция загрузки данных по звонкам
    const loadCallsData = () => {
      setCallsData({
        totalCalls: Math.floor(Math.random() * 1000) + 500,
        inboundCalls: Math.floor(Math.random() * 600) + 300,
        outboundCalls: Math.floor(Math.random() * 400) + 200,
        averageCallDuration: `${Math.floor(Math.random() * 5) + 2}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        peakHour: `${Math.floor(Math.random() * 12) + 9}:00`,
        currentHourCalls: Math.floor(Math.random() * 50) + 10
      });
    };

    loadCallsData();
    // Обновление данных каждые 30 секунд
    const interval = setInterval(loadCallsData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Функция тестирования MongoDB
  const testMongoConnection = async () => {
    setDebugLoading(true);
    try {
      const debugInfo = await TestMongoDBConnectionDetailed();
      setMongoDebugInfo(debugInfo);
      console.log('MongoDB Debug Info:', debugInfo);
    } catch (error) {
      console.error('Ошибка тестирования MongoDB:', error);
      setMongoDebugInfo({ error: error instanceof Error ? error.message : 'Неизвестная ошибка' });
    } finally {
      setDebugLoading(false);
    }
  };

  // Рендер соответствующего компонента в зависимости от activeView
  const renderContent = () => {
    switch (activeView) {
      case 'daily':
        return (
          <DailyView
            queueName={activeQueue}
            startDate={startDate}
            endDate={endDate}
            activeMetric={activeStandardMetric}
            shouldLoadData={shouldLoadData}
            onDataLoaded={onDataLoaded}
          />
        );
      case 'hourly':
        return (
          <HourlyView
            queueName={activeQueue}
            startDate={startDate}
            endDate={endDate}
            activeMetric={activeStandardMetric}
            shouldLoadData={shouldLoadData}
            onDataLoaded={onDataLoaded}
          />
        );
      case 'monthly':
        return (
          <MonthlyView
            queueName={activeQueue}
            selectedMonth={selectedMonth}
            shouldLoadData={shouldLoadData}
            onDataLoaded={onDataLoaded}
          />
        );
      case 'classifiers':
        return (
                      <ClassifiersView
              queueName={activeQueue}
              startDate={startDate}
              endDate={endDate}
              activeMetric={activeClassifierMetric}
              shouldLoadData={shouldLoadData}
              onDataLoaded={onDataLoaded}
            />
        );
      case 'online':
        return (
          <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
            <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Online Monitoring</h2>
                <div className="flex space-x-2">
                  <button
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Download size={14} />
                    <span>Export Real-time</span>
                  </button>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Feature in development - Real-time export will be available when monitoring is implemented</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
            {/* Заголовок */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Daily Call Statistics</h1>
                  <p className="text-gray-600 dark:text-gray-400">Contact Center Activity Monitoring</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Today</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{currentDate}</div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center space-x-2">
                  <Phone className="w-5 h-5 text-primary-400" />
                  <span className="text-primary-400 font-medium">Active Mode:</span>
                  <span className="text-gray-900 dark:text-white">Daily View</span>
                  <span className="text-gray-500 dark:text-gray-400">•</span>
                  <span className="text-gray-900 dark:text-white">Calls Metric</span>
                  <span className="text-gray-500 dark:text-gray-400">•</span>
                  <span className="text-gray-900 dark:text-white">Current Date</span>
                </div>
              </div>
            </div>

            {/* Основные метрики звонков */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Calls</h3>
                  <Phone className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{callsData.totalCalls.toLocaleString()}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">For today</div>
              </div>

              <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inbound</h3>
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-green-400 mb-2">{callsData.inboundCalls.toLocaleString()}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round((callsData.inboundCalls / callsData.totalCalls) * 100)}% of total
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Outbound</h3>
                  <Users className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-3xl font-bold text-orange-400 mb-2">{callsData.outboundCalls.toLocaleString()}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round((callsData.outboundCalls / callsData.totalCalls) * 100)}% of total
                </div>
              </div>
            </div>

            {/* MongoDB Диагностика */}
            <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MongoDB Диагностика</h3>
                <Database className="w-6 h-6 text-blue-400" />
              </div>
              
              <button
                onClick={testMongoConnection}
                disabled={debugLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {debugLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>Тест подключения MongoDB</span>
              </button>

              {mongoDebugInfo && (
                <div className="mt-4 p-4 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <h4 className="text-gray-900 dark:text-white font-semibold mb-2">Результаты диагностики:</h4>
                  <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto">
                    {JSON.stringify(mongoDebugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Дополнительные метрики */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Average Duration</h3>
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-purple-400 mb-2">{callsData.averageCallDuration}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Minutes:seconds</div>
              </div>

              <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Peak Hour</h3>
                  <BarChart3 className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-yellow-400 mb-2">{callsData.peakHour}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Maximum activity</div>
              </div>

              <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Hour</h3>
                  <Calendar className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-3xl font-bold text-cyan-400 mb-2">{callsData.currentHourCalls}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Calls in the last hour</div>
              </div>
            </div>

            {/* Статус системы */}
            <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Статус системы</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Телефонная система</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-green-400 text-sm">Активна</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Запись разговоров</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-green-400 text-sm">Включена</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Аналитика</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-green-400 text-sm">Работает</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return renderContent();
};

export default Dashboard; 