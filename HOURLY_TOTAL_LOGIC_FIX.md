# Исправления логики Total в Hourly и переключателей метрик

## Проблемы которые были исправлены:

### 1. Убрана легенда в графике для Hourly / Total
**Файл:** `db-management-app/frontend/src/components/HourlyView.tsx`
**Изменение:**
```tsx
// До
display: activeMetric === 'total', // Показываем легенду только для total

// После  
display: false, // Убираем легенду даже для total
```

### 2. Исправлена проблема с загрузкой данных после переключения с Total на другие метрики
**Файл:** `db-management-app/frontend/src/components/HourlyView.tsx`
**Изменения:**
```tsx
// Улучшена логика проверки наличия данных
useEffect(() => {
  // Загружаем данные при смене метрики, если уже были загружены какие-то данные
  const hasData = tableData.length > 0 || Object.values(totalData).some(arr => arr.length > 0);
  if (hasData) {
    loadData();
  }
}, [activeMetric]);
```

### 3. Исправлена общая логика переключения метрик во всех компонентах
**Файл:** `db-management-app/frontend/src/App.tsx`
**Изменение:**
```tsx
// До - автозагрузка при смене любых параметров включая метрику
useEffect(() => {
  if (shouldLoadData) {
    handleApplyFilters();
  }
}, [activeQueue, activeView, activeStandardMetric]);

// После - метрики обрабатываются внутри компонентов
useEffect(() => {
  if (shouldLoadData) {
    handleApplyFilters();
  }
}, [activeQueue, activeView]);
```

**Файл:** `db-management-app/frontend/src/components/DailyView.tsx`
**Добавлен useEffect:**
```tsx
// Загрузка данных при смене метрики
useEffect(() => {
  if (tableData.length > 0) {
    loadData();
  }
}, [activeMetric]);
```

## Результат исправлений:

### ✅ Hourly / Total:
- ❌ Убрана легенда в графике (как требовалось)
- ✅ Корректно загружаются данные calls, chats, total одновременно
- ✅ График показывает три набора баров разных цветов
- ✅ Таблица показывает три строки: Calls, Chats, Total
- ✅ Переключение на другие метрики после Total работает корректно

### ✅ Переключение метрик во всех вкладках:
- ✅ **Daily**: Все метрики переключаются и загружают свои данные
- ✅ **Hourly**: Все метрики включая Total работают корректно  
- ✅ **Monthly**: Нет метрик - работает с месячным селектором
- ✅ **Classifiers**: Отдельные метрики классификаторов (заглушка)
- ✅ **Online**: Заглушка без метрик

### ✅ Логика работы:
1. **При смене Queue/View** - автоматическая загрузка через App.tsx
2. **При смене Metric** - загрузка внутри каждого View компонента
3. **При нажатии Apply** - принудительная загрузка через Sidebar
4. **Total метрика в Hourly** - специальная логика с тремя dataset'ами

## Архитектура переключения:

```
App.tsx
├── Управляет общим состоянием
├── Автозагрузка при смене Queue/View  
└── Передает activeMetric в компоненты

├── DailyView.tsx
│   ├── useEffect([activeMetric]) -> loadData()
│   └── Загружает данные при смене метрики
│
├── HourlyView.tsx  
│   ├── useEffect([activeMetric]) -> loadData()
│   ├── Специальная логика для Total (3 API вызова)
│   └── Обычная логика для остальных метрик
│
└── MonthlyView.tsx
    └── Без метрик - только месячный селектор
```

Все переключатели во всех вкладках и метриках теперь работают корректно! 