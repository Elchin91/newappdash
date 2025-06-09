import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

// Интерфейс для данных дневной статистики
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

// Интерфейсы для месячных данных
interface MonthlyCallData {
  day: number;
  total_calls: number;
  avg_call_duration: string;
  sl: number;
  total_abandoned: number;
  distinct_agents: number;
}

interface MonthlyChatData {
  day: number;
  total_chats: number;
  avg_chat_frt: string;
  resolution_time_avg: string;
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

// Интерфейс для данных классификаторов
interface ClassifierData {
  report_date: string;
  topic: string;
  subtopic: string;
  total: number;
}

// Интерфейс для данных топиков
interface TopicData {
  report_date: string;
  topic: string;
  total: number;
  ratio: number;
}

// Стили для ячеек
const headerStyle = {
  font: {
    name: "Calibri",
    sz: 11,
    bold: true,
    color: { rgb: "000000" }
  },
  alignment: {
    horizontal: "center",
    vertical: "center"
  },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  },
  fill: {
    fgColor: { rgb: "D3D3D3" }
  }
};

const dataStyle = {
  font: {
    name: "Calibri",
    sz: 11,
    color: { rgb: "000000" }
  },
  alignment: {
    horizontal: "center",
    vertical: "center"
  },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  }
};

// Функция для применения стилей к worksheet
const applyStylesToWorksheet = (worksheet: XLSX.WorkSheet, hasHeaderRow = true, hasHeaderColumn = false) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "", t: "s" };
      }
      
      // Определяем, является ли ячейка заголовком
      const isHeaderRow = hasHeaderRow && row === 0;
      const isHeaderColumn = hasHeaderColumn && col === 0;
      const isHeader = isHeaderRow || isHeaderColumn;
      
      // Применяем соответствующий стиль
      worksheet[cellAddress].s = isHeader ? headerStyle : dataStyle;
    }
  }
};

// Экспорт данных конкретной метрики
export const exportMetricToExcel = (
  tableData: DailyData[], 
  activeMetric: string,
  queueName: string,
  startDate: string,
  endDate: string
) => {
  if (!tableData || tableData.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  // Форматируем дату для имени файла
  const formatDateForFilename = (dateStr: string) => {
    return dateStr.replace(/\//g, '-');
  };

  const dates = tableData.map(row => {
    const date = new Date(row.date);
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  });

  let metricData: any[][] = [];
  let fileName = '';
  let sheetName = '';

  switch (activeMetric) {
    case 'calls':
      metricData = [
        ['Metric / 2025', ...dates],
        ['Calls', ...tableData.map(row => row.total_calls)]
      ];
      fileName = `Calls_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'Calls Data';
      break;

    case 'aht':
      metricData = [
        ['Metric / 2025', ...dates],
        ['AHT (min)', ...tableData.map(row => row.avg_call_duration)]
      ];
      fileName = `AHT_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'AHT Data';
      break;

    case 'sl':
      metricData = [
        ['Metric / 2025', ...dates],
        ['SL (%)', ...tableData.map(row => `${row.sl.toFixed(1)}%`)]
      ];
      fileName = `SL_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'SL Data';
      break;

    case 'chats':
      metricData = [
        ['Metric / 2025', ...dates],
        ['Chats', ...tableData.map(row => row.total_chats)]
      ];
      fileName = `Chats_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'Chats Data';
      break;

    case 'frt':
      metricData = [
        ['Metric / 2025', ...dates],
        ['FRT (min)', ...tableData.map(row => row.avg_chat_frt)]
      ];
      fileName = `FRT_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'FRT Data';
      break;

    case 'rt':
      metricData = [
        ['Metric / 2025', ...dates],
        ['RT (min)', ...tableData.map(row => row.resolution_time_avg)]
      ];
      fileName = `RT_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'RT Data';
      break;

    case 'abandoned':
      metricData = [
        ['Metric / 2025', ...dates],
        ['Abandoned', ...tableData.map(row => row.total_abandoned)]
      ];
      fileName = `Abandoned_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'Abandoned Data';
      break;

    case 'total':
      metricData = [
        ['Metric / 2025', ...dates],
        ['Calls', ...tableData.map(row => row.total_calls)],
        ['Chats', ...tableData.map(row => row.total_chats)],
        ['Total', ...tableData.map(row => row.total_calls + row.total_chats)],
        ['Agents', ...tableData.map(row => row.distinct_agents)]
      ];
      fileName = `Total_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'Total Data';
      break;

    default:
      metricData = [
        ['Metric / 2025', ...dates],
        ['Calls', ...tableData.map(row => row.total_calls)]
      ];
      fileName = `Data_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
      sheetName = 'Data';
  }

  // Создаем workbook и worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(metricData);

  // Применяем стили (первая строка и первая колонка - заголовки)
  applyStylesToWorksheet(worksheet, true, true);

  // Устанавливаем ширину колонок
  const columnWidths = [
    { wch: 15 }, // Первая колонка для названий метрик
    ...dates.map(() => ({ wch: 12 })) // Колонки с датами
  ];
  worksheet['!cols'] = columnWidths;

  // Добавляем worksheet в workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Генерируем Excel файл и сохраняем
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true 
  });
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(data, fileName);
};

// Экспорт полных данных всех метрик
export const exportAllDataToExcel = (
  tableData: DailyData[],
  queueName: string,
  startDate: string,
  endDate: string
) => {
  if (!tableData || tableData.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  const formatDateForFilename = (dateStr: string) => {
    return dateStr.replace(/\//g, '-');
  };

  // Подготавливаем данные
  const allMetricsData = [
    ['Date', 'Calls', 'AHT (min)', 'SL (%)', 'Abandoned', 'Chats', 'FRT (min)', 'RT (min)', 'Agents'],
    ...tableData.map(row => [
      new Date(row.date).toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }),
      row.total_calls,
      row.avg_call_duration,
      `${row.sl.toFixed(1)}%`,
      row.total_abandoned,
      row.total_chats,
      row.avg_chat_frt,
      row.resolution_time_avg,
      row.distinct_agents
    ])
  ];

  const fileName = `All_Metrics_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
  
  // Создаем workbook и worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(allMetricsData);

  // Применяем стили (только первая строка - заголовок)
  applyStylesToWorksheet(worksheet, true, false);

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 8 },  // Calls
    { wch: 15 }, // AHT
    { wch: 10 }, // SL
    { wch: 12 }, // Abandoned
    { wch: 8 },  // Chats
    { wch: 15 }, // FRT
    { wch: 15 }, // RT
    { wch: 8 }   // Agents
  ];

  // Добавляем worksheet в workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'All Metrics');

  // Генерируем Excel файл и сохраняем
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true 
  });
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(data, fileName);
};

// Экспорт месячных данных в Excel
export const exportMonthlyDataToExcel = (
  callData: MonthlyCallData[],
  chatData: MonthlyChatData[],
  queueName: string,
  selectedMonth: string
) => {
  if ((!callData || callData.length === 0) && (!chatData || chatData.length === 0)) {
    alert('Нет данных для экспорта');
    return;
  }

  const year = parseInt(selectedMonth.split('-')[0]);
  const month = parseInt(selectedMonth.split('-')[1]);
  
  // Получаем количество дней в месяце
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };
  
  const daysInMonth = getDaysInMonth(year, month);
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

  // Получаем название месяца
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const monthName = monthNames[month - 1];

  // Форматируем даты в формате DD.MM.YYYY
  const formatDateForColumn = (day: number) => {
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    return `${dayStr}.${monthStr}.${year}`;
  };

  // Создаем данные для таблицы
  const tableData = [
    ['Date', ...allDays.map(day => formatDateForColumn(day))],
    [
      'Calls',
      ...allDays.map(day => {
        const dayData = callDataMap.get(day);
        return dayData ? dayData.total_calls : 0;
      })
    ],
    [
      'AHT (min)',
      ...allDays.map(day => {
        const dayData = callDataMap.get(day);
        return dayData ? dayData.avg_call_duration : '00:00:00';
      })
    ],
    [
      'SL (%)',
      ...allDays.map(day => {
        const dayData = callDataMap.get(day);
        return dayData ? `${dayData.sl.toFixed(1)}%` : '0.0%';
      })
    ],
    [
      'Abandoned',
      ...allDays.map(day => {
        const dayData = callDataMap.get(day);
        return dayData ? dayData.total_abandoned : 0;
      })
    ],
    [
      'Chats',
      ...allDays.map(day => {
        const dayData = chatDataMap.get(day);
        return dayData ? dayData.total_chats : 0;
      })
    ],
    [
      'FRT (min)',
      ...allDays.map(day => {
        const dayData = chatDataMap.get(day);
        return dayData ? dayData.avg_chat_frt : '00:00:00';
      })
    ],
    [
      'RT (min)',
      ...allDays.map(day => {
        const dayData = chatDataMap.get(day);
        return dayData ? dayData.resolution_time_avg : '00:00:00';
      })
    ],
    [
      'Agents',
      ...allDays.map(day => {
        const dayData = callDataMap.get(day);
        return dayData ? dayData.distinct_agents : 0;
      })
    ]
  ];

  // Создаем workbook и worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(tableData);

  // Применяем стили (первая строка и первая колонка - заголовки)
  applyStylesToWorksheet(worksheet, true, true);

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 15 }, // Первая колонка
    ...allDays.map(() => ({ wch: 11 })) // Колонки с датами
  ];

  // Добавляем worksheet в workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, `${monthName} ${year}`);

  // Создаем Summary лист
  const summaryData = calculateMonthlySummary(callData, chatData);
  const summaryTableData = [
    ['Metric', 'Total/Average'],
    ['Calls', summaryData.totalCalls.toLocaleString()],
    ['AHT (Min)', summaryData.avgAht],
    ['SL (%)', `${summaryData.avgSl.toFixed(1)}%`],
    ['Abandoned', summaryData.totalAbandoned.toLocaleString()],
    ['Abandoned (%)', `${summaryData.abandonedPercent.toFixed(1)}%`],
    ['Chats', summaryData.totalChats.toLocaleString()],
    ['FRT (min)', summaryData.avgFrt],
    ['RT (min)', summaryData.avgRt],
    ['Total', summaryData.totalInquiries.toLocaleString()]
  ];

  // Создаем Summary worksheet
  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryTableData);
  
  // Применяем стили к summary листу
  applyStylesToWorksheet(summaryWorksheet, true, false);

  // Устанавливаем ширину колонок для summary
  summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
  
  // Применяем левое выравнивание для первой колонки summary (кроме заголовка)
  const summaryRange = XLSX.utils.decode_range(summaryWorksheet['!ref'] || 'A1');
  for (let row = 1; row <= summaryRange.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (summaryWorksheet[cellAddress] && summaryWorksheet[cellAddress].s) {
      summaryWorksheet[cellAddress].s = {
        ...summaryWorksheet[cellAddress].s,
        alignment: {
          horizontal: "left",
          vertical: "center"
        }
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

  // Генерируем имя файла
  const fileName = `Monthly_Report_${queueName}_${monthName}_${year}.xlsx`;

  // Генерируем Excel файл и сохраняем
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true,
    sheetStubs: false
  });
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(data, fileName);
};

// Вспомогательная функция для расчета итоговых значений
const calculateMonthlySummary = (callData: MonthlyCallData[], chatData: MonthlyChatData[]) => {
  const totalCalls = callData.reduce((sum, item) => sum + item.total_calls, 0);
  const totalAbandoned = callData.reduce((sum, item) => sum + item.total_abandoned, 0);
  const totalChats = chatData.reduce((sum, item) => sum + item.total_chats, 0);
  
  // Конвертация времени в секунды
  const timeToSeconds = (time: string) => {
    if (!time) return 0;
    const parts = time.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  };

  // Форматирование секунд в HH:MM:SS
  const formatSecondsToTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Средние значения
  const avgAht = callData.length > 0 ? 
    callData.reduce((sum, item, _, arr) => sum + timeToSeconds(item.avg_call_duration) / arr.length, 0) : 0;

  const avgSl = callData.length > 0 ? 
    callData.reduce((sum, item, _, arr) => sum + item.sl / arr.length, 0) : 0;

  const avgFrt = chatData.length > 0 ? 
    chatData.reduce((sum, item, _, arr) => sum + timeToSeconds(item.avg_chat_frt) / arr.length, 0) : 0;

  const avgRt = chatData.length > 0 ? 
    chatData.reduce((sum, item, _, arr) => sum + timeToSeconds(item.resolution_time_avg) / arr.length, 0) : 0;

  return {
    totalCalls,
    totalAbandoned,
    totalChats,
    totalInquiries: totalCalls + totalChats,
    abandonedPercent: totalCalls > 0 ? (totalAbandoned / totalCalls) * 100 : 0,
    avgAht: formatSecondsToTime(avgAht),
    avgSl,
    avgFrt: formatSecondsToTime(avgFrt),
    avgRt: formatSecondsToTime(avgRt)
  };
};

// Экспорт обычных почасовых данных для Hourly View
export const exportHourlyToExcel = (
  hourlyData: any[],
  activeMetric: string,
  queueName: string,
  startDate: string,
  endDate: string
) => {
  if (!hourlyData || hourlyData.length === 0) {
    alert('Нет почасовых данных для экспорта');
    return;
  }

  // Форматируем дату для имени файла
  const formatDateForFilename = (dateStr: string) => {
    return dateStr.replace(/\//g, '-');
  };

  // Создаем массив часов для заголовков
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  // Готовим данные для таблицы
  const tableData: (string | number)[][] = [];
  
  // Заголовок таблицы
  tableData.push(['Date', ...hours]);
  
  // Добавляем данные по дням
  hourlyData.forEach(row => {
    const rowData = [
      new Date(row.date).toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      })
    ];
    
    // Добавляем данные по часам
    for (let i = 0; i < 24; i++) {
      const hourKey = `hour_${i}`;
      const value = row[hourKey] || 0;
      rowData.push(value);
    }
    
    tableData.push(rowData);
  });

  // Создаем workbook и worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(tableData);

  // Применяем стили
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "", t: "s" };
      }
      
      // Применяем стили
      const isHeader = row === 0;
      const isDateColumn = col === 0;
      
      if (isHeader) {
        worksheet[cellAddress].s = headerStyle;
      } else if (isDateColumn) {
        worksheet[cellAddress].s = {
          ...headerStyle,
          alignment: {
            horizontal: "left",
            vertical: "center"
          }
        };
      } else {
        worksheet[cellAddress].s = dataStyle;
      }
    }
  }

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 12 }, // Колонка с датой
    ...hours.map(() => ({ wch: 6 })) // Колонки с часами
  ];

  // Добавляем worksheet в workbook
  const metricName = activeMetric.toUpperCase();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${metricName} Hourly`);

  // Генерируем имя файла
  const fileName = `Hourly_${metricName}_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;

  // Генерируем Excel файл и сохраняем
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true,
    sheetStubs: false
  });
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(data, fileName);
};

// Экспорт почасовых данных (Detailed daily)
export const exportHourlyDetailedToExcel = (
  hourlyData: HourlyDetailedData[],
  queueName: string,
  startDate: string,
  endDate: string
) => {
  if (!hourlyData || hourlyData.length === 0) {
    alert('Нет почасовых данных для экспорта');
    return;
  }

  // Форматируем дату для имени файла
  const formatDateForFilename = (dateStr: string) => {
    return dateStr.replace(/\//g, '-');
  };

  // Создаем массив часов для заголовков
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  // Группируем данные по дням
  const groupedByDate = hourlyData.reduce((acc, row) => {
    if (!acc[row.date]) {
      acc[row.date] = [];
    }
    acc[row.date].push(row);
    return acc;
  }, {} as Record<string, HourlyDetailedData[]>);

    // Создаем workbook
  const workbook = XLSX.utils.book_new();

  // Создаем единый лист со всеми данными подряд
  const allTableData: (string | number)[][] = [];
  
  // Сортируем даты для правильного порядка
  const sortedDates = Object.keys(groupedByDate).sort();
  
  sortedDates.forEach((date, dateIndex) => {
    const dayData = groupedByDate[date];
    
    // Добавляем заголовок с датой
    allTableData.push([date, ...hours]);
    
    // Добавляем данные для всех метрик этого дня
    dayData.forEach(row => {
      allTableData.push([
        row.metric,
        String(row.hour_0 || '0'), String(row.hour_1 || '0'), String(row.hour_2 || '0'), 
        String(row.hour_3 || '0'), String(row.hour_4 || '0'), String(row.hour_5 || '0'),
        String(row.hour_6 || '0'), String(row.hour_7 || '0'), String(row.hour_8 || '0'), 
        String(row.hour_9 || '0'), String(row.hour_10 || '0'), String(row.hour_11 || '0'),
        String(row.hour_12 || '0'), String(row.hour_13 || '0'), String(row.hour_14 || '0'), 
        String(row.hour_15 || '0'), String(row.hour_16 || '0'), String(row.hour_17 || '0'),
        String(row.hour_18 || '0'), String(row.hour_19 || '0'), String(row.hour_20 || '0'), 
        String(row.hour_21 || '0'), String(row.hour_22 || '0'), String(row.hour_23 || '0')
      ]);
    });
    
    // Добавляем пустую строку между днями (кроме последнего)
    if (dateIndex < sortedDates.length - 1) {
      allTableData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    }
  });

  // Создаем worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allTableData);

  // Применяем стили с учетом заголовков дат
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "", t: "s" };
      }
      
      // Определяем тип ячейки
      const cellValue = worksheet[cellAddress].v;
      const isDateRow = cellValue && typeof cellValue === 'string' && cellValue.match(/^\d{4}-\d{2}-\d{2}$/);
      const isMetricCell = col === 0 && !isDateRow && cellValue && cellValue !== '';
      const isHeaderHour = isDateRow && col > 0;
      
      // Применяем соответствующий стиль
      if (isDateRow || isHeaderHour) {
        // Заголовки дат и часов
        worksheet[cellAddress].s = headerStyle;
      } else if (isMetricCell) {
        // Названия метрик в первой колонке
        worksheet[cellAddress].s = {
          ...headerStyle,
          alignment: {
            horizontal: "left",
            vertical: "center"
          }
        };
      } else {
        // Обычные данные
        worksheet[cellAddress].s = dataStyle;
      }
    }
  }

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 15 }, // Первая колонка (Дата/Метрика)
    ...hours.map(() => ({ wch: 6 })) // Колонки с часами
  ];

  // Добавляем worksheet в workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hourly Data');

  // Генерируем имя файла
  const fileName = `Hourly_Detailed_${queueName}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;

  // Генерируем Excel файл и сохраняем
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true,
    sheetStubs: false
  });
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(data, fileName);
};

// Экспорт данных классификаторов в Excel
export const exportClassifiersToExcel = (
  classifierData: ClassifierData[] | TopicData[],
  activeMetric: string,
  queueName: string,
  startDate: string,
  endDate: string,
  searchQuery?: string
) => {
  if (!classifierData || classifierData.length === 0) {
    alert('No data to export');
    return;
  }

  // Если это метрика Topics, используем специальную функцию
  if (activeMetric === 'topics') {
    return exportTopicsToExcel(classifierData as TopicData[], queueName, startDate, endDate, searchQuery);
  }

  const formatDateForFilename = (dateStr: string) => {
    return dateStr.replace(/\//g, '-');
  };

  // Приводим к типу ClassifierData, так как здесь мы работаем только с классификаторами
  const classifiersData = classifierData as ClassifierData[];

  // Group data by dates for table display
  const uniqueDates = [...new Set(classifiersData.map(item => item.report_date))].sort();
  
  // Get unique topic/subtopic combinations
  const topicSubtopicPairs = [...new Set(classifiersData.map(item => `${item.topic}|${item.subtopic}`))]
    .map(pair => {
      const [topic, subtopic] = pair.split('|');
      return { topic, subtopic };
    });

  // Apply search filter if provided
  let filteredPairs = topicSubtopicPairs;
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filteredPairs = topicSubtopicPairs.filter(pair => 
      pair.topic.toLowerCase().includes(query) ||
      (pair.subtopic && pair.subtopic.toLowerCase().includes(query))
    );
  }

  // Create table data
  const tableData = filteredPairs.map(({ topic, subtopic }) => {
    const row: any = { topic, subtopic };
    let totalSum = 0;
    
    uniqueDates.forEach(date => {
      const entry = classifiersData.find(item => 
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

  // Prepare data for Excel with separate Topic and Subtopic columns like frontend
  const excelData = [
    ['Topic', 'Subtopic', ...uniqueDates, 'Total'],
    ...tableData.map(row => [
      row.topic,
      row.subtopic || '—',
      ...uniqueDates.map(date => row[date] || 0),
      row.total
    ])
  ];

  // Add summary row
  const totalRow = ['TOTAL', ''];
  uniqueDates.forEach(date => {
    const dateTotal = tableData.reduce((sum, row) => sum + (row[date] || 0), 0);
    totalRow.push(dateTotal);
  });
  const grandTotal = tableData.reduce((sum, row) => sum + row.total, 0);
  totalRow.push(grandTotal);
  excelData.push(totalRow);

  // Generate filename and sheet name
  const metricName = activeMetric === 'call' ? 'Calls' : activeMetric === 'chat' ? 'Chats' : activeMetric === 'topics' ? 'Topics' : 'Overall';
  const queueDisplay = queueName === 'all' ? 'All' : queueName === 'm10' ? 'M10' : queueName === 'aml' ? 'AML' : queueName;
  const fileName = `Classifiers_${metricName}_${queueDisplay}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
  const sheetName = `${metricName} Classifiers`;

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Apply styles (only first row is header, no header column)
  applyStylesToWorksheet(worksheet, true, false);

  // Set column widths
  const columnWidths = [
    { wch: 25 }, // Topic column
    { wch: 25 }, // Subtopic column
    ...uniqueDates.map(() => ({ wch: 12 })), // Date columns
    { wch: 12 } // Total column
  ];
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate Excel file and save
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true 
  });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(blob, fileName);
};

// Экспорт данных топиков в Excel (специальная функция для Topics метрики)
export const exportTopicsToExcel = (
  topicData: TopicData[],
  queueName: string,
  startDate: string,
  endDate: string,
  searchQuery?: string
) => {
  if (!topicData || topicData.length === 0) {
    alert('No data to export');
    return;
  }

  const formatDateForFilename = (dateStr: string) => {
    return dateStr.replace(/\//g, '-');
  };

  // Group data by dates for table display
  const uniqueDates = [...new Set(topicData.map(item => item.report_date))].sort();
  
  // Get unique topics
  const topicList = [...new Set(topicData.map(item => item.topic))];

  // Apply search filter if provided
  let filteredTopics = topicList;
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filteredTopics = topicList.filter(topic => 
      topic.toLowerCase().includes(query)
    );
  }

  // Create table data for Topics
  const tableData = filteredTopics.map(topic => {
    const row: any = { topic };
    let totalSum = 0;
    let ratioSum = 0;
    let dateCount = 0;
    
    uniqueDates.forEach(date => {
      const entry = topicData.find(item => 
        item.report_date === date && 
        item.topic === topic
      );
      const value = entry ? entry.total : 0;
      row[date] = value;
      totalSum += value;
      
      // Суммируем ratio для подсчета среднего
      if (entry && entry.ratio) {
        ratioSum += entry.ratio;
        dateCount++;
      }
    });
    
    row.total = totalSum;
    // Подсчитываем средний процент по всем датам для топика
    row.ratio = dateCount > 0 ? (ratioSum / dateCount) : 0;
    return row;
  });

  // Prepare data for Excel with Topic, Ratio (%), dates and Total columns
  const excelData = [
    ['Topic', 'Ratio (%)', ...uniqueDates, 'Total'],
    ...tableData.map(row => [
      row.topic,
      `${row.ratio.toFixed(1)}%`,
      ...uniqueDates.map(date => row[date] || 0),
      row.total
    ])
  ];

  // Add summary row
  const totalRow = ['TOTAL', ''];
  uniqueDates.forEach(date => {
    const dateTotal = tableData.reduce((sum, row) => sum + (row[date] || 0), 0);
    totalRow.push(dateTotal);
  });
  const grandTotal = tableData.reduce((sum, row) => sum + row.total, 0);
  totalRow.push(grandTotal);
  excelData.push(totalRow);

  // Generate filename and sheet name
  const queueDisplay = queueName === 'all' ? 'All' : queueName === 'm10' ? 'M10' : queueName === 'aml' ? 'AML' : queueName;
  const fileName = `Classifiers_Topics_${queueDisplay}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`;
  const sheetName = 'Topics Classifiers';

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Apply styles (only first row is header, no header column)
  applyStylesToWorksheet(worksheet, true, false);

  // Set column widths
  const columnWidths = [
    { wch: 25 }, // Topic column
    { wch: 12 }, // Ratio (%) column
    ...uniqueDates.map(() => ({ wch: 12 })), // Date columns
    { wch: 12 } // Total column
  ];
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate Excel file and save
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    cellStyles: true 
  });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  saveAs(blob, fileName);
}; 