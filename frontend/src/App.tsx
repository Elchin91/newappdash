import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';

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
  const result = today.toISOString().slice(0, 7);
  console.log('=== getCurrentMonth ===');
  console.log('сегодняшняя дата:', today);
  console.log('getMonth() (0-11):', today.getMonth());
  console.log('getFullYear():', today.getFullYear());
  console.log('результат toISOString().slice(0, 7):', result);
  console.log('======================');
  return result;
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Инициализация темы при первом запуске
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []); // Выполняется только при первом рендере
  const [activeQueue, setActiveQueue] = useState<QueueFilter>('all');
  const [activeView, setActiveView] = useState<DashboardView>('daily');
  const [activeStandardMetric, setActiveStandardMetric] = useState<StandardMetric>('calls');
  const [activeClassifierMetric, setActiveClassifierMetric] = useState<ClassifierMetric>('call');
  const [startDate, setStartDate] = useState<string>(getCurrentDate());
  const [endDate, setEndDate] = useState<string>(getCurrentDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [shouldLoadData, setShouldLoadData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Эффект для установки класса темы на корневой элемент при изменении режима
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleApplyFilters = () => {
    setIsLoading(true);
    setShouldLoadData(prev => !prev); // Переключаем флаг для вызова загрузки
  };

  const handleDataLoaded = () => {
    setIsLoading(false);
    console.log('Data loaded successfully');
  };

  // Автозагрузка при смене параметров (кроме метрики - она загружается внутри компонентов)
  useEffect(() => {
    // Пропускаем первый рендер, загружаем только при изменениях
    if (shouldLoadData) {
      handleApplyFilters();
    }
  }, [activeQueue, activeView]);

  // Отладка selectedMonth
  useEffect(() => {
    console.log('=== APP selectedMonth изменился ===');
    console.log('новое значение selectedMonth:', selectedMonth);
    console.log('===================================');
  }, [selectedMonth]);

  return (
    <div className={`flex h-screen transition-colors duration-300 ${isDarkMode ? 'bg-dark-900 text-gray-100' : 'bg-white text-gray-900'}`}>
      <Sidebar 
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        activeQueue={activeQueue}
        setActiveQueue={setActiveQueue}
        activeView={activeView}
        setActiveView={setActiveView}
        activeStandardMetric={activeStandardMetric}
        setActiveStandardMetric={setActiveStandardMetric}
        activeClassifierMetric={activeClassifierMetric}
        setActiveClassifierMetric={setActiveClassifierMetric}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        onApplyFilters={handleApplyFilters}
        isLoading={isLoading}
      />
      <Dashboard 
        activeQueue={activeQueue}
        activeView={activeView}
        activeStandardMetric={activeStandardMetric}
        activeClassifierMetric={activeClassifierMetric}
        startDate={startDate}
        endDate={endDate}
        selectedMonth={selectedMonth}
        shouldLoadData={shouldLoadData}
        onDataLoaded={handleDataLoaded}
      />
    </div>
  );
}

export default App;
