import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, Loader2, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Search, X, Copy, Check, CheckSquare, Square } from 'lucide-react';
import { GetCallClassifiers, GetChatClassifiers, GetOverallClassifiers, GetTopics, GetAvailableTopics, GetSubtopicsDaily } from '../../wailsjs/go/main/App';
import { exportClassifiersToExcel } from '../utils/excelExport';

// Component types
type ClassifierMetric = 'call' | 'chat' | 'overall' | 'topics' | 'subtopics_daily';
type SortField = 'topic' | 'subtopic' | 'total' | 'ratio' | string; // string for dates
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface ClassifierData {
  report_date: string;
  topic: string;
  subtopic: string;
  total: number;
}

interface TopicData {
  report_date: string;
  topic: string;
  total: number;
  ratio: number;
}

interface ClassifiersViewProps {
  queueName: string;
  startDate: string;
  endDate: string;
  activeMetric: ClassifierMetric;
  shouldLoadData: boolean;
  onDataLoaded: () => void;
}

const ClassifiersView: React.FC<ClassifiersViewProps> = ({
  queueName,
  startDate,
  endDate,
  activeMetric,
  shouldLoadData,
  onDataLoaded
}) => {
  const [data, setData] = useState<ClassifierData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'topic', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({
    totalEntries: 0,
    uniqueTopics: 0,
    dateRange: { from: '', to: '' }
  });
  
  // Новые состояния для функциональности копирования столбцов
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Состояния для метрики Subtopics (Daily)
  const [availableTopics, setAvailableTopics] = useState<Array<{topic: string}>>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [allSubtopicsData, setAllSubtopicsData] = useState<ClassifierData[]>([]);  // Все данные субтопиков

  // Функция извлечения доступных топиков из загруженных данных
  const extractAvailableTopics = (data: ClassifierData[]) => {
    const uniqueTopics = Array.from(new Set(data.map(item => item.topic)))
      .filter(topic => topic && topic.trim() !== '')
      .map(topic => ({ topic }))
      .sort((a, b) => a.topic.localeCompare(b.topic));
    
    console.log(`Извлечено ${uniqueTopics.length} уникальных топиков:`, uniqueTopics);
    setAvailableTopics(uniqueTopics);
    return uniqueTopics;
  };

  // Data loading function
  const loadData = async () => {
    console.log('Начинаем загрузку данных...', { 
      activeMetric, 
      startDate, 
      endDate, 
      queueName, 
      selectedTopic: activeMetric === 'subtopics_daily' ? selectedTopic : 'N/A' 
    });
    
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      switch (activeMetric) {
        case 'call':
          response = await GetCallClassifiers(startDate, endDate, queueName);
          break;
        case 'chat':
          response = await GetChatClassifiers(startDate, endDate, queueName);
          break;
        case 'overall':
          response = await GetOverallClassifiers(startDate, endDate, queueName);
          break;
        case 'topics':
          response = await GetTopics(startDate, endDate, queueName);
          break;
        case 'subtopics_daily':
          // Загружаем ВСЕ данные классификаторов сразу для быстрой фильтрации
          console.log('Загружаем все данные классификаторов для subtopics_daily');
          
          // Загружаем данные звонков и чатов параллельно
          const [callDataResponse, chatDataResponse] = await Promise.all([
            GetCallClassifiers(startDate, endDate, queueName),
            GetChatClassifiers(startDate, endDate, queueName)
          ]);
          
          // Объединяем данные
          const combinedData = [
            ...(callDataResponse.data || []),
            ...(chatDataResponse.data || [])
          ];
          
          // Сохраняем все данные для локального фильтрования
          setAllSubtopicsData(combinedData);
          
          // Извлекаем доступные топики
          extractAvailableTopics(combinedData);
          
          // Возвращаем пустые данные - отображение будет по выбору топика
          response = {
            data: [],
            type: 'subtopics_daily'
          };
          break;
        default:
          throw new Error('Unknown classifier metric');
      }

      const results = response.data || [];
      setData(results);
      
      // Calculate summary statistics
      const uniqueTopics = new Set(results.map((item: ClassifierData) => item.topic)).size;
      const totalEntries = results.reduce((sum: number, item: ClassifierData) => sum + item.total, 0);
      const dates = results.map((item: ClassifierData) => item.report_date).sort();
      
      setSummary({
        totalEntries,
        uniqueTopics,
        dateRange: {
          from: dates[0] || startDate,
          to: dates[dates.length - 1] || endDate
        }
      });

      console.log(`Loaded ${results.length} classifier records for ${activeMetric} metric`);
      
    } catch (err) {
      console.error('Error loading classifier data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      onDataLoaded();
    }
  };

  // Reset selected topic when switching to subtopics_daily metric
  useEffect(() => {
    if (activeMetric === 'subtopics_daily') {
      setSelectedTopic(''); // Сбрасываем выбранный топик
      setAvailableTopics([]); // Очищаем список топиков
      setAllSubtopicsData([]); // Очищаем данные
    }
  }, [activeMetric]);

  // Load data when parameters or queue change
  useEffect(() => {
    if (shouldLoadData && activeMetric && startDate && endDate) {
      loadData();
    }
  }, [shouldLoadData, activeMetric, startDate, endDate, queueName]);

  // Локальная фильтрация данных при выборе топика для subtopics_daily
  useEffect(() => {
    if (activeMetric === 'subtopics_daily' && selectedTopic && allSubtopicsData.length > 0) {
      console.log('Фильтруем данные локально для топика:', selectedTopic);
      
      // Фильтруем уже загруженные данные
      const filteredData = allSubtopicsData.filter(item => item.topic === selectedTopic);
      setData(filteredData);
      
      // Пересчитываем статистику
      const uniqueTopics = 1; // Только выбранный топик
      const totalEntries = filteredData.reduce((sum, item) => sum + item.total, 0);
      const dates = filteredData.map(item => item.report_date).sort();
      
      setSummary({
        totalEntries,
        uniqueTopics,
        dateRange: {
          from: dates[0] || startDate,
          to: dates[dates.length - 1] || endDate
        }
      });
      
      console.log(`Отфильтровано ${filteredData.length} записей для топика "${selectedTopic}"`);
    } else if (activeMetric === 'subtopics_daily' && !selectedTopic) {
      // Если топик не выбран, очищаем данные
      setData([]);
      setSummary({
        totalEntries: 0,
        uniqueTopics: 0,
        dateRange: { from: startDate, to: endDate }
      });
    }
  }, [selectedTopic, allSubtopicsData, activeMetric, startDate, endDate]);

  // Function to handle column header click for sorting
  const handleSort = (field: SortField) => {
    let direction: SortDirection = 'asc';
    
    if (sortConfig.field === field && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.field === field && sortConfig.direction === 'desc') {
      direction = null;
    }
    
    setSortConfig({ field, direction });
  };

  // Function to get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    }
    
    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="w-4 h-4 text-blue-400" />;
    } else if (sortConfig.direction === 'desc') {
      return <ChevronDown className="w-4 h-4 text-blue-400" />;
    }
    
    return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
  };

  // Function to sort table data
  const sortTableData = (data: any[]) => {
    if (!sortConfig.direction) {
      return data; // Return original data if sorting is disabled
    }

    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];

      // Special handling for string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle empty values (e.g., empty subtopics)
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return sortConfig.direction === 'desc' ? comparison * -1 : comparison;
    });
  };

  // Функция для получения всех доступных столбцов
  const getAvailableColumns = () => {
    let columns = [];
    
    if (activeMetric === 'subtopics_daily') {
      columns.push('subtopic');
    } else {
      columns.push('topic');
      if (activeMetric === 'topics') {
        columns.push('ratio');
      } else {
        columns.push('subtopic');
      }
    }
    
    // Добавляем столбцы дат
    const uniqueDates = [...new Set(data.map(item => item.report_date))].sort();
    columns.push(...uniqueDates);
    columns.push('total');
    
    return columns;
  };

  // Функция для переключения выбора столбца
  const toggleColumnSelection = (column: string) => {
    setSelectedColumns(prev => 
      prev.includes(column) 
        ? prev.filter(col => col !== column)
        : [...prev, column]
    );
  };

  // Функция для выбора всех столбцов
  const selectAllColumns = () => {
    const allColumns = getAvailableColumns();
    setSelectedColumns(allColumns);
  };

  // Функция для очистки выбора столбцов
  const clearColumnSelection = () => {
    setSelectedColumns([]);
  };

  // Функция для копирования выбранных столбцов
  const copySelectedColumns = async () => {
    if (selectedColumns.length === 0) {
      alert('Выберите хотя бы один столбец для копирования');
      return;
    }

    try {
      const headers = selectedColumns.map(col => {
        if (col === 'topic') return 'Topic';
        if (col === 'subtopic') return 'Subtopic';
        if (col === 'ratio') return 'Ratio (%)';
        if (col === 'total') return 'Total';
        return col; // Для дат
      });

      const csvData = [
        headers.join('\t'), // Заголовки
        ...sortTableData(filteredTableData).map(row => 
          selectedColumns.map(col => {
            if (col === 'ratio' && row[col]) {
              return `${row[col].toFixed(1)}%`;
            }
            return row[col] || (col === 'subtopic' ? '—' : '0');
          }).join('\t')
        )
      ].join('\n');

      await navigator.clipboard.writeText(csvData);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Ошибка при копировании:', err);
      alert('Не удалось скопировать данные в буфер обмена');
    }
  };

  // Функция для копирования отдельного столбца
  const copyColumnData = async (column: string) => {
    try {
      const header = column === 'topic' ? 'Topic' :
                    column === 'subtopic' ? 'Subtopic' :
                    column === 'ratio' ? 'Ratio (%)' :
                    column === 'total' ? 'Total' : column;

      const columnData = [
        header, // Заголовок
        ...sortTableData(filteredTableData).map(row => {
          if (column === 'ratio' && row[column]) {
            return `${row[column].toFixed(1)}%`;
          }
          return row[column] || (column === 'subtopic' ? '—' : '0');
        })
      ].join('\n');

      await navigator.clipboard.writeText(columnData);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Ошибка при копировании столбца:', err);
      alert('Не удалось скопировать столбец в буфер обмена');
    }
  };

  // Function to group data by dates for table display
  const prepareTableData = () => {
    // Если это метрика Topics, обрабатываем данные по-особому
    if (activeMetric === 'topics') {
      return prepareTopicsTableData();
    }

    // Если это метрика Subtopics Daily, обрабатываем только субтопики
    if (activeMetric === 'subtopics_daily') {
      return prepareSubtopicsDailyTableData();
    }

    // Get unique dates and sort them
    const uniqueDates = [...new Set(data.map(item => item.report_date))].sort();
    
    // Get unique topic/subtopic combinations
    const topicSubtopicPairs = [...new Set(data.map(item => `${item.topic}|${item.subtopic}`))]
      .map(pair => {
        const [topic, subtopic] = pair.split('|');
        return { topic, subtopic };
      });

    // Create table data
    return topicSubtopicPairs.map(({ topic, subtopic }) => {
      const row: any = { topic, subtopic };
      let totalSum = 0;
      
      uniqueDates.forEach(date => {
        const entry = data.find(item => 
          item.report_date === date && 
          item.topic === topic && 
          item.subtopic === subtopic
        );
        const value = entry ? entry.total : 0;
        row[date] = value;
        totalSum += value;
      });
      
      row.total = totalSum;
      return row;
    });
  };

  // Function to prepare Subtopics Daily table data (only subtopics for selected topic)
  const prepareSubtopicsDailyTableData = () => {
    // Get unique dates and sort them
    const uniqueDates = [...new Set(data.map(item => item.report_date))].sort();
    
    // Get unique subtopics for selected topic
    const subtopicList = [...new Set(data.map(item => item.subtopic))];

    // Create table data for Subtopics Daily
    return subtopicList.map(subtopic => {
      const row: any = { subtopic };
      let totalSum = 0;
      
      uniqueDates.forEach(date => {
        const entry = data.find(item => 
          item.report_date === date && 
          item.subtopic === subtopic
        );
        const value = entry ? entry.total : 0;
        row[date] = value;
        totalSum += value;
      });
      
      row.total = totalSum;
      return row;
    });
  };

  // Function to prepare Topics table data (only topics, no subtopics, with ratio)
  const prepareTopicsTableData = () => {
    // Get unique dates and sort them
    const uniqueDates = [...new Set(data.map(item => item.report_date))].sort();
    
    // Get unique topics
    const topicList = [...new Set(data.map(item => item.topic))];

    // Create table data for Topics
    return topicList.map(topic => {
      const row: any = { topic };
      let totalSum = 0;
      let ratioSum = 0;
      let dateCount = 0;
      
      uniqueDates.forEach(date => {
        const entry = data.find(item => 
          item.report_date === date && 
          item.topic === topic
        );
        const value = entry ? (entry as any).total : 0;
        row[date] = value;
        totalSum += value;
        
        // Суммируем ratio для подсчета среднего
        if (entry && (entry as any).ratio) {
          ratioSum += (entry as any).ratio;
          dateCount++;
        }
      });
      
      row.total = totalSum;
      // Подсчитываем средний процент по всем датам для топика
      row.ratio = dateCount > 0 ? (ratioSum / dateCount) : 0;
      return row;
    });
  };

  // Function to filter table data by search query
  const filterTableData = (tableData: any[]) => {
    if (!searchQuery.trim()) {
      return tableData;
    }

    const query = searchQuery.toLowerCase().trim();
    return tableData.filter(row => 
      row.topic.toLowerCase().includes(query) ||
      (row.subtopic && row.subtopic.toLowerCase().includes(query)) ||
      row.total.toString().includes(query) ||
             (activeMetric === 'topics' && row.ratio && row.ratio.toFixed(1).includes(query))
    );
  };

  // Excel export function
  const handleExport = () => {
    exportClassifiersToExcel(data, activeMetric, queueName, startDate, endDate, searchQuery);
  };

  const tableData = prepareTableData();
  const filteredTableData = filterTableData(tableData);
  const uniqueDates = [...new Set(data.map(item => item.report_date))].sort();

  if (loading) {
    return (
      <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
        <div className="bg-gray-50 dark:bg-dark-800 p-6 rounded-lg border border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            <span className="text-gray-900 dark:text-white">Loading classifier data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
        <div className="bg-red-50 dark:bg-dark-800 p-6 rounded-lg border border-red-200 dark:border-dark-700">
          <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Error loading data</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 bg-white dark:bg-dark-900 overflow-y-auto h-screen transition-colors duration-300">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Classifiers - {
                activeMetric === 'call' ? 'Calls' : 
                activeMetric === 'chat' ? 'Chats' : 
                activeMetric === 'overall' ? 'Overall' : 
                activeMetric === 'topics' ? 'Topics' : 
                'Subtopics (Daily)'
              }
            </h1>
            <p className="text-gray-400">
              Analysis of classifiers for period {startDate} to {endDate}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
              disabled={filteredTableData.length === 0}
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Summary information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <h3 className="text-lg font-semibold text-white">Total Records</h3>
            <p className="text-2xl font-bold text-primary-400">{summary.totalEntries.toLocaleString()}</p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <h3 className="text-lg font-semibold text-white">Unique Topics</h3>
            <p className="text-2xl font-bold text-green-400">{summary.uniqueTopics}</p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <h3 className="text-lg font-semibold text-white">Data Period</h3>
            <p className="text-sm text-gray-300">
              {summary.dateRange.from} - {summary.dateRange.to}
            </p>
          </div>
        </div>
      </div>

      {/* Topic selector for Subtopics (Daily) */}
      {activeMetric === 'subtopics_daily' && (
        <div className="mb-6 bg-dark-800 p-4 rounded-lg border border-dark-700">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Topic (daily):
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">-- Choose a topic --</option>
                {availableTopics.map((topic) => (
                  <option key={topic.topic} value={topic.topic}>
                    {topic.topic}
                  </option>
                ))}
              </select>
            </div>
            
          </div>
                     {!selectedTopic && availableTopics.length > 0 && (
             <p className="text-sm text-gray-400 mt-2">
               Выберите топик для просмотра его субтопиков
             </p>
           )}
         </div>
       )}

      {/* Сообщение о необходимости выбора топика */}
      {activeMetric === 'subtopics_daily' && !selectedTopic && (
        <div className="mb-6 bg-dark-800 p-6 rounded-lg border border-dark-700 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Выберите топик</h3>
          <p className="text-gray-400">
            Для просмотра субтопиков выберите топик из выпадающего списка выше
          </p>
        </div>
      )}

      {/* Search and filters panel */}
      <div className="mb-6 bg-dark-800 p-4 rounded-lg border border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={activeMetric === 'topics' ? "Search by topic, ratio or count..." : "Search by topic, subtopic or count..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-96"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="text-sm text-gray-400">
                Found: {filteredTableData.length} of {tableData.length} records
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={14} />
                <span>Clear Search</span>
              </button>
            )}
            {sortConfig.direction && (
              <button
                onClick={() => setSortConfig({ field: 'topic', direction: null })}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ChevronsUpDown size={14} />
                <span>Reset Sort</span>
              </button>
            )}
          </div>
        </div>

        {/* Панель выбора столбцов для копирования */}
        <div className="border-t border-dark-700 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-white font-medium">Выбор столбцов для копирования:</h3>
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showColumnSelector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showColumnSelector ? 'Скрыть' : 'Показать'} выбор столбцов</span>
              </button>
              {selectedColumns.length > 0 && (
                <span className="text-sm text-green-400">
                  Выбрано: {selectedColumns.length} столбцов
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {selectedColumns.length > 0 && (
                <button
                  onClick={copySelectedColumns}
                  className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                    copySuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {copySuccess ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copySuccess ? 'Скопировано!' : 'Копировать выбранные'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Список столбцов для выбора */}
          {showColumnSelector && (
            <div className="mt-4 p-4 bg-dark-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-300">Выберите столбцы для копирования:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAllColumns}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    Выбрать все
                  </button>
                  <button
                    onClick={clearColumnSelection}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    Очистить
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                {getAvailableColumns().map((column) => {
                  const isSelected = selectedColumns.includes(column);
                  const displayName = column === 'topic' ? 'Topic' :
                                    column === 'subtopic' ? 'Subtopic' :
                                    column === 'ratio' ? 'Ratio (%)' :
                                    column === 'total' ? 'Total' : column;
                  
                  return (
                    <button
                      key={column}
                      onClick={() => toggleColumnSelection(column)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-dark-600 text-gray-300 hover:bg-dark-500'
                      }`}
                    >
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      <span>{displayName}</span>
                    </button>
                  );
                })}
              </div>
              
              {selectedColumns.length > 0 && (
                <div className="mt-3 p-3 bg-dark-600 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">
                    Данные будут скопированы в формате разделённом табуляцией (TSV), 
                    который можно вставить в Excel или другие программы.
                  </p>
                  <p className="text-xs text-blue-400">
                    Выбранные столбцы: {selectedColumns.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Data table - скрываем если это subtopics_daily и топик не выбран */}
      {!(activeMetric === 'subtopics_daily' && !selectedTopic) && (
        <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
        <div className="p-4 border-b border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {activeMetric === 'topics' ? 'Topics Data' : 
                 activeMetric === 'subtopics_daily' ? `Subtopics Data for "${selectedTopic}"` : 
                 'Topic and Subtopic Data'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Showing {filteredTableData.length} of {tableData.length} unique {
                  activeMetric === 'topics' ? 'topics' : 
                  activeMetric === 'subtopics_daily' ? 'subtopics' : 
                  'topic/subtopic combinations'
                }
                {searchQuery && ` (search filter applied)`}
              </p>
            </div>
            {sortConfig.direction && (
              <div className="flex items-center space-x-2 text-sm text-blue-400">
                <span>Sorting:</span>
                <span className="font-medium">{
                  sortConfig.field === 'topic' ? 'Topic' :
                  sortConfig.field === 'subtopic' ? 'Subtopic' :
                  sortConfig.field === 'total' ? 'Total' :
                  sortConfig.field === 'ratio' ? 'Ratio (%)' :
                  sortConfig.field
                }</span>
                {sortConfig.direction === 'asc' ? 
                  <ChevronUp className="w-4 h-4" /> : 
                  <ChevronDown className="w-4 h-4" />
                }
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider sticky left-0 bg-dark-700 z-10">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center space-x-1 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort(activeMetric === 'subtopics_daily' ? 'subtopic' : 'topic')}
                    >
                      <span>{activeMetric === 'subtopics_daily' ? 'Subtopic' : 'Topic'}</span>
                      {getSortIcon(activeMetric === 'subtopics_daily' ? 'subtopic' : 'topic')}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyColumnData(activeMetric === 'subtopics_daily' ? 'subtopic' : 'topic');
                      }}
                      className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                      title={`Копировать столбец ${activeMetric === 'subtopics_daily' ? 'Subtopic' : 'Topic'}`}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </th>
                {activeMetric === 'topics' ? (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider sticky left-24 bg-dark-700 z-10">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-1 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('ratio')}
                      >
                        <span>Ratio (%)</span>
                        {getSortIcon('ratio')}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyColumnData('ratio');
                        }}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Копировать столбец Ratio"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </th>
                ) : activeMetric === 'subtopics_daily' ? null : (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider sticky left-24 bg-dark-700 z-10">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-1 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('subtopic')}
                      >
                        <span>Subtopic</span>
                        {getSortIcon('subtopic')}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyColumnData('subtopic');
                        }}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Копировать столбец Subtopic"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </th>
                )}
                {uniqueDates.map((date) => (
                  <th key={date} className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-1 cursor-pointer hover:text-white transition-colors flex-1"
                        onClick={() => handleSort(date)}
                      >
                        <span>{date}</span>
                        {getSortIcon(date)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyColumnData(date);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title={`Копировать столбец ${date}`}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center space-x-1 cursor-pointer hover:text-white transition-colors flex-1"
                      onClick={() => handleSort('total')}
                    >
                      <span>Total</span>
                      {getSortIcon('total')}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyColumnData('total');
                      }}
                      className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                      title="Копировать столбец Total"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {sortTableData(filteredTableData).map((row, index) => (
                <tr key={index} className="hover:bg-dark-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white sticky left-0 bg-dark-800 z-10">
                    {activeMetric === 'subtopics_daily' ? (row.subtopic || '—') : row.topic}
                  </td>
                  {activeMetric === 'topics' ? (
                    <td className="px-4 py-3 text-sm text-center text-primary-400 sticky left-24 bg-dark-800 z-10">
                      {row.ratio ? `${row.ratio.toFixed(1)}%` : '0.0%'}
                    </td>
                  ) : activeMetric === 'subtopics_daily' ? null : (
                    <td className="px-4 py-3 text-sm text-gray-300 sticky left-24 bg-dark-800 z-10">
                      {row.subtopic || '—'}
                    </td>
                  )}
                  {uniqueDates.map((date) => (
                    <td key={date} className="px-4 py-3 text-sm text-center text-gray-300">
                      {row[date] || 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-center font-semibold text-primary-400">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Summary row */}
      <div className="mt-4 bg-dark-800 p-4 rounded-lg border border-dark-700">
        <div className="flex justify-between items-center">
          <span className="text-white font-semibold">
            Total for period: {summary.totalEntries.toLocaleString()} records
          </span>
          <span className="text-gray-400 text-sm">
            Data updated: {new Date().toLocaleString('en-US')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClassifiersView; 