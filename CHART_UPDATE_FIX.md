# Исправление обновления графика при смене метрики

## Проблема 🚫
График не обновлялся при смене активной метрики (например, переключение с Calls на AHT). 

**Причина:** Данные для графика (`chartData`) пересчитывались только при загрузке данных в `processData()`, но не при изменении `activeMetric`.

## Решение ✅

### 1. Разделили логику на два useEffect:

#### ❌ Было:
```typescript
// Один useEffect для всего - включая activeMetric
useEffect(() => {
  if (shouldLoadData && queueName === 'm10') {
    loadData();
  }
}, [shouldLoadData, activeMetric, queueName, startDate, endDate]);
```
**Проблема:** При смене метрики происходила полная перезагрузка данных

#### ✅ Стало:
```typescript
// useEffect для загрузки данных (без activeMetric)
useEffect(() => {
  if (shouldLoadData && queueName === 'm10') {
    loadData();
  }
}, [shouldLoadData, queueName, startDate, endDate]);

// Отдельный useEffect для обновления графика
useEffect(() => {
  if (tableData.length > 0) {
    updateChartData();
  }
}, [activeMetric, tableData]);
```

### 2. Создали отдельную функцию `updateChartData()`:

```typescript
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
    // ... остальные метрики
  }

  setChartData(chartRows);
};
```

### 3. Убрали дублированный код из `processData()`:

#### ❌ Было:
```typescript
const processData = (rawData: any) => {
  // ... обработка данных таблицы
  setTableData(processedData);

  // Дублированный код создания chartData
  let chartRows = [];
  switch (activeMetric) {
    // ... длинный switch
  }
  setChartData(chartRows);
};
```

#### ✅ Стало:
```typescript
const processData = (rawData: any) => {
  // ... обработка данных таблицы
  setTableData(processedData);
  // Всё! chartData обновится автоматически через useEffect
};
```

## Результат 🎯

### Теперь график работает корректно:
1. **При смене метрики** - график мгновенно обновляется без перезагрузки данных
2. **При смене дат** - загружаются новые данные и график обновляется  
3. **При смене очереди** - загружаются новые данные и график обновляется

### Логика работы:
```
Смена метрики → useEffect [activeMetric] → updateChartData() → setChartData() → prepareChartData() → Обновленный график
```

### Преимущества:
- ✅ **Быстрое переключение** - без лишних API вызовов
- ✅ **Чистый код** - разделение ответственности между функциями  
- ✅ **Отзывчивость** - мгновенная реакция на смену метрики
- ✅ **Надежность** - исключена возможность рассинхронизации

Теперь пользователь может легко переключаться между метриками и видеть актуальные данные на графике! 📊 