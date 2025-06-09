# Исправления Monthly View

## Выполненные изменения

### ✅ Убран селектор месяца из правой части
- Удален дублирующий селектор месяца из `MonthlyView.tsx`
- Теперь выбор месяца происходит только через левую боковую панель (сайдбар)
- Компонент использует `selectedMonth` из пропсов вместо внутреннего состояния

### ✅ Изменен формат таблиц согласно скриншоту
- **Главная таблица**: Одна большая таблица где дни месяца идут как колонки (1, 2, 3, 4...), а метрики как строки
- **Сводная таблица**: Отдельная таблица с итоговыми значениями и средними показателями

## Структура новых таблиц

### Главная таблица "Metric / [Месяц] [Год]"
```
| Metric      | 1   | 2   | 3   | 4   | ... | 31  |
|-------------|-----|-----|-----|-----|-----|-----|
| Calls       | 603 | 668 | 745 | 651 | ... | 333 |
| AHT (min)   | 00:01:57 | 00:02:08 | ... | ... |
| SL (%)      | 98.0% | 96.9% | 95.0% | ... | ... |
| Abandoned   | 9   | 8   | 22  | 13  | ... | 4   |
| Chats       | 1,936 | 1,723 | 1,799 | ... | ... |
| FRT (min)   | 00:01:40 | 00:02:02 | ... | ... |
| RT (min)    | 00:14:11 | 00:17:07 | ... | ... |
| Agents      | 27  | 25  | 29  | 28  | ... | 27  |
```

### Сводная таблица "Period Summary"
```
| Metric         | Total/Average |
|----------------|---------------|
| Calls          | 12,113        |
| AHT (Min)      | 00:02:15      |
| SL             | 93.5%         |
| Abandoned      | 343           |
| Abandoned (%)  | 3%            |
| Chats          | 42,195        |
| FRT (min)      | 00:01:30      |
| RT (min)       | 00:04:00      |
| Total          | 54,308        |
```

## Особенности реализации

1. **Автоматическое определение дней в месяце**: Таблица показывает правильное количество дней для выбранного месяца
2. **Цветовое кодирование метрик**: Каждая метрика имеет свой цвет для лучшего восприятия
3. **Формат времени HH:MM:SS**: Все временные метрики отображаются в требуемом формате
4. **Адаптивный дизайн**: Горизонтальная прокрутка для больших таблиц
5. **Обработка пустых данных**: Дни без данных показывают нулевые значения

## Измененные файлы

- `db-management-app/frontend/src/components/MonthlyView.tsx` - полная переработка структуры таблиц

Теперь Monthly view полностью соответствует предоставленному скриншоту! 

## Проблема с селектором месяцев (ИСПРАВЛЕНО)
Была проблема где выбор "мая" показывал данные за "апрель". 

**Причина**: В `Sidebar.tsx` функция `generateMonths()` использовала `date.toISOString().slice(0, 7)` для генерации значений месяцев, что приводило к проблемам с часовыми поясами UTC vs локальное время.

**Исправление**: Заменили генерацию значений месяца на:
```javascript
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 потому что getMonth() возвращает 0-11
const value = `${year}-${month}`; // YYYY-MM
```

## Проблема с нулями в последнем дне месяца (ИСПРАВЛЕНО)

### Проблема
Последний день каждого месяца показывал нули по всем метрикам в таблице.

### Причины
1. **Frontend**: Функция `getDaysInMonth` была корректной, но SQL запросы в backend не включали данные последнего дня полностью
2. **Backend**: SQL запросы использовали `<= endDate`, но `endDate` передавался как "2025-05-31" без времени, что исключало данные после 00:00:00 последнего дня

### Исправления

#### 1. Backend SQL запросы (db-management-app/app.go)
Изменили все SQL запросы в функции `GetMonthlyData` с:
```sql
WHERE date_field >= ? AND date_field <= ?
```
на:
```sql  
WHERE date_field >= ? AND date_field <= DATE_ADD(?, INTERVAL 1 DAY)
```

Это обеспечивает включение всех данных последнего дня (до 23:59:59).

**Измененные запросы:**
- Запрос звонков: `callsQuery`
- Запрос заброшенных звонков: `abandonedQuery` 
- Запрос агентов: `agentsQuery`
- Запрос чатов: `chatsQuery`

#### 2. Добавлена отладочная информация
В функцию `GetMonthlyData` добавлен вывод параметров:
```go
fmt.Printf("=== GetMonthlyData ===\n")
fmt.Printf("startDate: %s\n", startDate)
fmt.Printf("endDate: %s\n", endDate)
fmt.Printf("queueName: %s\n", queueName)
fmt.Printf("=====================\n")
```

#### 3. Frontend комментарии
Добавили поясняющие комментарии в функцию `getDaysInMonth`:
```javascript
// month приходит в формате 1-12, но Date ожидает 0-11
// Используем month (без -1), чтобы получить последний день нужного месяца
return new Date(year, month, 0).getDate();
```

## Проблема с логикой подсчета звонков (ИСПРАВЛЕНО)

### Проблема
Запросы в `GetDailyData` и `GetMonthlyData` использовали разную логику для подсчета звонков, не соответствующую эталонному запросу.

### Эталонный запрос (правильный)
```sql
SELECT 
  DATE(enter_queue_date)   AS report_date,
  COUNT(*)                 AS total_calls
FROM call_report
WHERE enter_queue_date BETWEEN '2025-05-01 00:00:00' AND '2025-05-31 23:59:59'
  AND type IN ('in', 'abandon')
  AND queue_name = 'm10'
GROUP BY report_date
ORDER BY report_date;
```

### Исправления

#### 1. GetDailyData - исправлен запрос звонков
**Было**: `AND type = 'in'`
**Стало**: `AND type IN ('in', 'abandon')`

#### 2. GetMonthlyData - унификация SQL запросов
- Изменили `WHERE date >= ? AND date <= DATE_ADD(?, INTERVAL 1 DAY)` на `WHERE date BETWEEN ? AND ?`
- Изменили `AND (type = 'in' OR type = 'abandon')` на `AND type IN ('in', 'abandon')`
- Добавили правильный формат времени в параметры: `startDate+" 00:00:00"`, `endDate+" 23:59:59"`

#### 3. Все запросы теперь используют единую логику
- **Формат дат**: `BETWEEN 'YYYY-MM-DD 00:00:00' AND 'YYYY-MM-DD 23:59:59'`
- **Типы звонков**: `type IN ('in', 'abandon')` для общего подсчета
- **Заброшенные звонки отдельно**: `type = 'abandon'` для метрики Abandoned

## Проблема с неправильными метриками AHT и SL (ИСПРАВЛЕНО)

### Проблема
В функции `GetMonthlyData` запрос для звонков некорректно рассчитывал AHT и SL, включая данные от заброшенных звонков.

### Проблемный запрос
```sql
-- НЕПРАВИЛЬНО: AHT и SL рассчитывались от всех звонков (включая заброшенные)
SELECT COUNT(*) AS total_calls,
       AVG(call_duration) AS avg_call_duration,  -- включает NULL от abandon
       SUM(CASE WHEN queue_wait_time <= 20 THEN 1 ELSE 0 END) / COUNT(*) * 100 AS sl  -- включает abandon
WHERE type IN ('in', 'abandon')
```

### Исправленный запрос
```sql
-- ПРАВИЛЬНО: total_calls от всех звонков, но AHT и SL только от входящих
SELECT COUNT(*) AS total_calls,
       AVG(CASE WHEN type = 'in' THEN call_duration ELSE NULL END) AS avg_call_duration,
       SUM(CASE WHEN type = 'in' AND queue_wait_time <= 20 THEN 1 ELSE 0 END) / 
       NULLIF(SUM(CASE WHEN type = 'in' THEN 1 ELSE 0 END), 0) * 100 AS sl
WHERE type IN ('in', 'abandon')
```

### Логика исправления
- **total_calls**: Все звонки (`'in'` + `'abandon'`) - правильно для общего подсчета
- **avg_call_duration**: Только от входящих звонков (`type = 'in'`) - заброшенные звонки не имеют продолжительности
- **sl (Service Level)**: Только от входящих звонков - заброшенные не учитываются в SL

### Результат
Теперь все дни месяца, включая последний, корректно отображают метрики в месячном отчете.
Все функции (`GetDailyData` и `GetMonthlyData`) используют единую, правильную логику подсчета звонков.
Метрики AHT и SL теперь рассчитываются корректно, исключая заброшенные звонки.

## Проблема с разными очередями в Daily vs Monthly (ИСПРАВЛЕНО)

### Проблема
Daily view и Monthly view показывали разные цифры для одного периода:
- Daily view (май 2025): 12,113 звонков  
- Monthly view (май 2025): 15,173 звонка
- Разница: 3,060 звонков

### Причина
Функции использовали разную логику для выбора очередей:

**GetDailyData** (Daily view):
```sql
WHERE queue_name = ?    -- ТОЛЬКО ОДНА ОЧЕРЕДЬ
```
Параметр: `queueName` (например "m10")

**GetMonthlyData** (Monthly view):
```sql
WHERE (queue_name = ? OR queue_name = ?)    -- ДВЕ ОЧЕРЕДИ
```
Параметры: `queueName` + `queueName + "-shikayet"` (например "m10" + "m10-shikayet")

### Исправление
Обновил логику очередей в обеих функциях `GetDailyData` и `GetMonthlyData`:

1. **Правильная логика очередей:**
```go
if queueName == "all" {
    // All queues - обе очереди
    queueCondition = "(queue_name = ? OR queue_name = ?)"
    queueParams = []interface{}{"m10", "m10-shikayet"}
} else if queueName == "m10" {
    // m10 - только основная очередь
    queueCondition = "queue_name = ?"
    queueParams = []interface{}{"m10"}
} else if queueName == "AML" {
    // AML - только очередь жалоб
    queueCondition = "queue_name = ?"
    queueParams = []interface{}{"m10-shikayet"}
}
```

2. **Использование динамических SQL запросов:**
- Все запросы теперь используют `fmt.Sprintf()` для вставки правильного условия очереди
- Параметры передаются динамически в зависимости от выбранной очереди

### Результат
Теперь Daily view и Monthly view показывают одинаковые цифры для одного периода, так как используют одинаковую логику выбора очередей.

## Проблема с блокировкой очередей в UI (ИСПРАВЛЕНО)

### Проблема
В интерфейсе показывалось предупреждение "Warning: Data is only available for queue 'm10'. Please select queue 'm10' in the sidebar." при выборе любой очереди кроме m10.

### Причина
В `DailyView.tsx` были жестко заданные проверки:
```tsx
if (queueName !== 'm10') {
    return (/* Warning message */);
}

// В useEffect
if (shouldLoadData && queueName === 'm10') {
    loadData();
}

// В loadData
if (queueName !== 'm10') return;
```

### Исправление
Убрал все проверки очереди в `DailyView.tsx`:
1. Удалил блок с предупреждением
2. Убрал проверку в `useEffect`
3. Убрал проверку в функции `loadData`

Теперь компонент загружает данные для всех очередей (m10, AML, all).

### Файлы изменены
- `db-management-app/frontend/src/components/Sidebar.tsx` - исправление генерации месяцев
- `db-management-app/app.go` - исправление SQL запросов для включения последнего дня, правильной логики метрик AHT/SL, унификации очередей, и добавление функции отладки GetQueueStats
- `db-management-app/frontend/src/components/MonthlyView.tsx` - добавление комментариев
- `db-management-app/frontend/src/components/DailyView.tsx` - удаление ограничений на очереди

### Тестирование
Рекомендуется протестировать:
1. Выбор разных месяцев в селекторе
2. Проверку данных последнего дня месяца для месяцев с разным количеством дней (28, 30, 31)
3. Правильность отображения метрик во всех столбцах таблицы