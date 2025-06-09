# Исправление проблемы бесконечной загрузки в Subtopics (Daily)

## Проблема
При использовании метрики "Subtopics (Daily)" возникали следующие проблемы:
1. Загрузка топиков начиналась сразу при выборе метрики (до Apply)
2. После второго нажатия Apply возникала бесконечная загрузка
3. Логика useEffect была неправильной и вызывала циклы

## Исправления

### 1. Исправлена логика useEffect

**Было:**
```typescript
// Load available topics when switching to subtopics_daily metric
useEffect(() => {
  if (activeMetric === 'subtopics_daily' && startDate && endDate) {
    loadAvailableTopics();
    setSelectedTopic(''); // Сбрасываем выбранный топик
  }
}, [activeMetric, startDate, endDate, queueName]);

// Load data when parameters or queue change
useEffect(() => {
  if (shouldLoadData && activeMetric && startDate && endDate) {
    if (activeMetric === 'subtopics_daily' && !selectedTopic) {
      // Для subtopics_daily не загружаем данные без выбранного топика
      setData([]);
      setSummary({...});
      onDataLoaded();
      return;
    }
    loadData();
  }
}, [shouldLoadData, activeMetric, startDate, endDate, queueName, selectedTopic]);
```

**Стало:**
```typescript
// Load available topics when switching to subtopics_daily metric
useEffect(() => {
  if (activeMetric === 'subtopics_daily' && shouldLoadData && startDate && endDate) {
    loadAvailableTopics();
    setSelectedTopic(''); // Сбрасываем выбранный топик
  }
}, [activeMetric, shouldLoadData, startDate, endDate, queueName]);

// Load data when parameters or queue change
useEffect(() => {
  if (shouldLoadData && activeMetric && startDate && endDate) {
    if (activeMetric === 'subtopics_daily') {
      if (!selectedTopic) {
        // Для subtopics_daily не загружаем данные без выбранного топика
        setData([]);
        setSummary({...});
        onDataLoaded();
        return;
      }
      // Если топик выбран, загружаем данные
      loadData();
    } else {
      // Для других метрик загружаем как обычно
      loadData();
    }
  }
}, [shouldLoadData, activeMetric, startDate, endDate, queueName]);

// Отдельный useEffect для загрузки данных при выборе топика
useEffect(() => {
  if (activeMetric === 'subtopics_daily' && selectedTopic && shouldLoadData && startDate && endDate) {
    loadData();
  }
}, [selectedTopic]);
```

### 2. Ключевые изменения

1. **Добавлен shouldLoadData в зависимости** для загрузки топиков
   - Теперь топики загружаются только после нажатия Apply

2. **Убран selectedTopic из основного useEffect**
   - Это предотвращает бесконечные циклы перезагрузки

3. **Создан отдельный useEffect для selectedTopic**
   - Загрузка данных происходит только при изменении выбранного топика

4. **Улучшена обработка ошибок**
   - Добавлено логирование для отладки
   - Улучшенная обработка случая, когда топик не выбран

### 3. Добавлено логирование для отладки

```typescript
console.log('Начинаем загрузку доступных топиков...', { startDate, endDate, queueName });
console.log('Начинаем загрузку данных...', { 
  activeMetric, 
  startDate, 
  endDate, 
  queueName, 
  selectedTopic: activeMetric === 'subtopics_daily' ? selectedTopic : 'N/A' 
});
```

## Ожидаемое поведение после исправлений

1. **Выбор метрики "Subtopics (Daily)"** - никакой загрузки не происходит
2. **Установка периода и нажатие Apply** - загружаются доступные топики
3. **Выбор топика из списка** - автоматически загружаются субтопики
4. **Повторное нажатие Apply** - корректная перезагрузка данных

## Результат
Проблема бесконечной загрузки устранена. Логика работы стала более предсказуемой и производительной. 