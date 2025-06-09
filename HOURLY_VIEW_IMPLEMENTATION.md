# Реализация Hourly View

## Описание
Реализована полная функциональность для вкладки "Hourly" в приложении управления базой данных Call Center.

## Функциональность

### Backend API
Добавлен новый метод `GetHourlyData` в `app.go`:
- **Эндпоинт**: `GetHourlyData(startDate, endDate, queueName, metric string)`
- **Поддерживаемые метрики**:
  - `calls` - Количество звонков по часам
  - `aht` - Среднее время разговора (AHT) по часам
  - `sl` - Service Level (SL) по часам в процентах 
  - `abandoned` - Заброшенные звонки по часам

### Frontend Компонент
Обновлен компонент `HourlyView.tsx`:

#### Основные возможности:
1. **График Bar Chart** - Отображает среднее значение метрики по часам за выбранный период
2. **Таблица данных** - Показывает разбивку по дням и часам
3. **Экспорт в Excel** - Возможность экспорта данных в Excel файл
4. **Интеграция с API** - Загрузка реальных данных из MySQL базы

#### Визуальные элементы:
- Современный темный интерфейс
- Интерактивный график с подсказками
- Адаптивная таблица с прокруткой
- Отображение общего итога за период
- Индикаторы загрузки и ошибок

### SQL Запросы
Реализованы точные SQL запросы из файла `Hourly sql.txt`:

1. **Звонки по часам**:
```sql
SELECT DATE(c.enter_queue_date) AS Day,
  SUM(CASE WHEN HOUR(c.enter_queue_date)=0 THEN 1 ELSE 0 END) AS hour_0,
  -- ... для всех 24 часов
FROM call_report c
WHERE c.enter_queue_date >= ? AND c.enter_queue_date <= ?
  AND c.type = 'in' AND queue_name = ?
GROUP BY Day ORDER BY Day;
```

2. **AHT по часам**:
```sql
SELECT DATE(c.answer_date) AS Day,
  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=0 THEN c.call_duration ELSE NULL END)) AS hour_0,
  -- ... для всех 24 часов
FROM call_report c
WHERE c.answer_date >= ? AND c.answer_date <= ?
  AND c.type = 'in' AND queue_name = ?
GROUP BY Day ORDER BY Day;
```

3. **SL по часам**:
```sql
SELECT DATE(c.enter_queue_date) AS Day,
  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=0 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) 
    / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=0 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_0,
  -- ... для всех 24 часов
FROM call_report c
WHERE c.enter_queue_date >= ? AND c.enter_queue_date <= ?
  AND c.type = 'in' AND queue_name = ?
GROUP BY Day ORDER BY Day;
```

### Экспорт данных
- Интеграция с существующей системой экспорта `exportHourlyDetailedToExcel`
- Автоматическое форматирование данных для Excel
- Поддержка как реальных данных, так и fallback к тестовым данным

## Использование

1. Выберите вкладку "Hourly" в навигации
2. Установите период дат и очередь
3. Выберите метрику (calls, aht, sl, abandoned)
4. Нажмите "Load Data" для загрузки данных
5. Просматривайте график и таблицу
6. Используйте "Export Hourly" для сохранения в Excel

## Технические детали

### Зависимости:
- Chart.js для отображения графиков
- React hooks для управления состоянием
- Wails для связи с backend
- XLSX для экспорта данных

### Файлы изменены:
- `db-management-app/app.go` - добавлен API метод
- `db-management-app/frontend/src/components/HourlyView.tsx` - полная реализация UI
- Auto-generated: `frontend/wailsjs/go/main/App.d.ts` - типы API

## Примечания
- Все комментарии в коде на русском языке согласно требованиям
- Реализован модульный и переиспользуемый код
- Добавлена обработка ошибок и состояний загрузки
- Интерфейс соответствует общему дизайну приложения 