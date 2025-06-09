import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Calendar,
  Moon,
  Sun,
  RefreshCw,
  Filter,
  BarChart3,
  Clock,
  TrendingUp,
  Loader2,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import clsx from 'clsx';
import { GetDatabaseStats } from '../../wailsjs/go/main/App';

// Типы для состояния
type QueueFilter = 'all' | 'm10' | 'aml';
type DashboardView = 'daily' | 'hourly' | 'monthly' | 'classifiers' | 'online';
type StandardMetric = 'calls' | 'aht' | 'sl' | 'chats' | 'frt' | 'rt' | 'abandoned' | 'total' | 'detailed_daily';
type ClassifierMetric = 'call' | 'chat' | 'overall' | 'topics' | 'subtopics_daily';

// Получение текущей даты в формате YYYY-MM-DD
const getCurrentDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Получение текущего месяца в формате YYYY-MM
const getCurrentMonth = () => {
  const today = new Date();
  return today.toISOString().slice(0, 7);
};

interface SidebarProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  activeQueue: QueueFilter;
  setActiveQueue: (queue: QueueFilter) => void;
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  activeStandardMetric: StandardMetric;
  setActiveStandardMetric: (metric: StandardMetric) => void;
  activeClassifierMetric: ClassifierMetric;
  setActiveClassifierMetric: (metric: ClassifierMetric) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onApplyFilters: () => void; // Добавляем функцию для применения фильтров
  isLoading: boolean; // Состояние загрузки
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isDarkMode, 
  onToggleDarkMode,
  activeQueue,
  setActiveQueue,
  activeView,
  setActiveView,
  activeStandardMetric,
  setActiveStandardMetric,
  activeClassifierMetric,
  setActiveClassifierMetric,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMonth,
  setSelectedMonth,
  onApplyFilters,
  isLoading
}) => {
  const [dbStatus, setDbStatus] = useState({
    mysql: 'Проверка...',
    mongodb: 'Проверка...'
  });

  const queueFilters = [
    { id: 'all', label: 'All queues' },
    { id: 'm10', label: 'm10' },
    { id: 'aml', label: 'AML' },
  ];

  const dashboardViews = [
    { id: 'daily', label: 'Daily' },
    { id: 'hourly', label: 'Hourly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'classifiers', label: 'Classifiers' },
    { id: 'online', label: 'Online' },
  ];

  const defaultMetrics = [
    { id: 'calls', label: 'Calls' },
    { id: 'aht', label: 'AHT' },
    { id: 'sl', label: 'SL' },
    { id: 'chats', label: 'Chats' },
    { id: 'frt', label: 'FRT' },
    { id: 'rt', label: 'RT' },
    { id: 'abandoned', label: 'Abandoned' },
    { id: 'total', label: 'Total' },
    { id: 'detailed_daily', label: 'Detailed daily' },
  ];

  const classifierMetrics = [
    { id: 'call', label: 'Call' },
    { id: 'chat', label: 'Chat' },
    { id: 'overall', label: 'Overall' },
    { id: 'topics', label: 'Topics' },
    { id: 'subtopics_daily', label: 'Subtopics (Daily)' },
  ];

  // Генерируем список доступных месяцев
  const generateMonths = (): Array<{value: string, label: string}> => {
    const months = [];
    const currentDate = new Date();
    
    console.log('=== ГЕНЕРАЦИЯ МЕСЯЦЕВ ===');
    console.log('текущая дата:', currentDate);
    console.log('текущий год:', currentDate.getFullYear());
    console.log('текущий месяц (0-11):', currentDate.getMonth());
    
    // Генерируем список месяцев начиная с текущего и на 24 месяца назад
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      
      // Исправляем генерацию value - используем локальную дату вместо UTC
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 потому что getMonth() возвращает 0-11
      const value = `${year}-${month}`; // YYYY-MM
      
      const label = date.toLocaleDateString('ru-RU', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      if (i < 5) { // Логируем первые 5 месяцев для примера
        console.log(`месяц ${i}:`, {
          originalDate: date,
          year: year,
          monthIndex: date.getMonth(), // 0-11
          monthNumber: date.getMonth() + 1, // 1-12 
          value: value, // YYYY-MM
          label: label
        });
      }
      
      months.push({ value, label });
    }
    
    console.log('первые 3 сгенерированных месяца:', months.slice(0, 3));
    console.log('========================');
    
    return months;
  };

  const availableMonths = generateMonths();

  // Функция проверки статуса подключений
  const checkDatabaseStatus = async () => {
    try {
      const stats = await GetDatabaseStats();
      setDbStatus({
        mysql: stats.mysql || 'Не подключено',
        mongodb: stats.mongodb || 'Не подключено'
      });
    } catch (error) {
      console.error('Ошибка проверки статуса БД:', error);
      setDbStatus({
        mysql: 'Ошибка',
        mongodb: 'Ошибка'
      });
    }
  };

  // Проверяем статус при загрузке и каждые 30 секунд
  useEffect(() => {
    checkDatabaseStatus();
    const interval = setInterval(checkDatabaseStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getBadgeColor = (status: string) => {
    return status === 'Подключено' ? 'bg-green-500' : 'bg-red-500';
  };

  const handleApplyFilters = () => {
    console.log('Apply filters:', { startDate, endDate, activeQueue, activeView, activeStandardMetric, activeClassifierMetric, selectedMonth });
    onApplyFilters();
  };

  const toggleTheme = () => {
    onToggleDarkMode();
    // Здесь можно добавить логику переключения темы
  };

  // Определяем, показывать ли блок метрик
  const shouldShowMetrics = activeView !== 'monthly' && activeView !== 'online';
  
  // Определяем, показывать ли блок периода
  const shouldShowPeriod = activeView !== 'online';

  return (
    <div className="w-80 bg-gray-50 dark:bg-dark-800 border-r border-gray-200 dark:border-dark-700 flex flex-col h-full overflow-y-auto scrollbar-thin transition-colors duration-300">
      {/* Логотип */}
      <div className="p-6 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center justify-center mb-4">
          <img 
            src="https://static.tildacdn.one/tild6263-6436-4064-b637-633061366565/M10.svg" 
            alt="M10 Logo" 
            className="h-16 w-auto"
          />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">CC Dashboard</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Contact Center Management</p>
        </div>
      </div>

      {/* Статус подключений */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">MySQL</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${dbStatus.mysql === 'Подключено' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-700 dark:text-gray-300">{dbStatus.mysql}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">MongoDB</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${dbStatus.mongodb === 'Подключено' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-700 dark:text-gray-300">{dbStatus.mongodb}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Фильтр по очередям */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center space-x-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Queues</h3>
        </div>
        <div className="space-y-1">
          {queueFilters.map((queue) => (
            <button
              key={queue.id}
              onClick={() => setActiveQueue(queue.id as QueueFilter)}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200',
                activeQueue === queue.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
              )}
            >
              {queue.label}
            </button>
          ))}
        </div>
      </div>

      {/* Переключатель представлений */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center space-x-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Dashboard</h3>
        </div>
        <div className="space-y-1">
          {dashboardViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as DashboardView)}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200',
                activeView === view.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Блок метрик - показываем только если не Monthly и не Online */}
      {shouldShowMetrics && (
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Metrics</h3>
          </div>
          
          {/* Стандартные метрики */}
          {activeView !== 'classifiers' && (
            <div className="space-y-1 mb-4">
              <h4 className="text-xs text-gray-500 dark:text-gray-500 uppercase mb-2">Standard</h4>
              {defaultMetrics
                .filter(metric => {
                  // Скрываем detailed_daily для hourly view
                  if (activeView === 'hourly' && metric.id === 'detailed_daily') {
                    return false;
                  }
                  return true;
                })
                .map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setActiveStandardMetric(metric.id as StandardMetric)}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200',
                    activeStandardMetric === metric.id
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
                  )}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          )}

          {/* Метрики классификаторов */}
          {activeView === 'classifiers' && (
            <div className="space-y-1">
              <h4 className="text-xs text-gray-500 dark:text-gray-500 uppercase mb-2">Classifiers</h4>
              {classifierMetrics.map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setActiveClassifierMetric(metric.id as ClassifierMetric)}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200',
                    activeClassifierMetric === metric.id
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
                  )}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Селектор периода - показываем только если не Online */}
      {shouldShowPeriod && (
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center space-x-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Period</h3>
          </div>
          <div className="space-y-3">
            
            {/* Для Monthly - только селектор месяца */}
            {activeView === 'monthly' ? (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Select Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white text-sm focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Выберите месяц</option>
                  {availableMonths.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              /* Для остальных - диапазон дат */
              <>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </>
            )}
            
            <button
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}

      {/* Кнопка темного режима */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <button
          onClick={toggleTheme}
          className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 w-full"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* Нижняя секция */}
      <div className="p-4 mt-auto">
        <button 
          onClick={() => window.location.reload()}
          className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 w-full"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Data</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 