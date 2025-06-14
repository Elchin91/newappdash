# Ежедневный вид данных (Daily View)

## Описание
Компонент DailyView предоставляет интерфейс для просмотра ежедневной статистики контакт-центра с красивыми графиками и детальными таблицами данных.

## Функциональность

### 1. Графическое отображение
- **Столбчатый график** с данными по выбранной метрике
- **Значения над столбцами** для лучшей читаемости
- **Интерактивные подсказки** при наведении
- **Цветовая кодировка** для разных типов метрик

### 2. Таблица данных
- **Полная детализация** всех метрик по дням
- **Сортировка по любому столбцу** (клик на заголовок)
- **Цветовая дифференциация** значений
- **Адаптивный дизайн** для разных экранов

### 3. Поддерживаемые метрики
- **Calls** - Количество звонков (простой график)
- **AHT** - Среднее время обработки в минутах (target: 3 мин.)
- **SL** - Уровень сервиса в процентах (target: 95%)
- **Abandoned** - Заброшенные звонки (простой график)
- **Chats** - Количество чатов (простой график)
- **FRT** - Время первого ответа (простой график)
- **RT** - Время решения (простой график)
- **Total** - Комбинированный график (Calls, Chats, Total, Agents)

## Использование

### Выбор очереди
1. В боковой панели выберите **"m10"** в разделе "Queues"
2. Только для очереди m10 доступны реальные данные из MySQL

### Выбор периода
1. Установите **начальную дату** в поле "Start Date"
2. Установите **конечную дату** в поле "End Date"
3. Данные будут загружены автоматически

### Выбор метрики
1. В разделе "Metrics" выберите нужную метрику
2. График автоматически обновится для отображения выбранной метрики

### Сортировка таблицы
1. Кликните на **заголовок любого столбца**
2. Повторный клик изменит направление сортировки
3. Стрелки показывают текущее направление сортировки

## Структура данных

### Стандартная таблица содержит столбцы:
- **Дата** - День отчетного периода
- **Звонки** - Общее количество входящих звонков
- **AHT** - Среднее время обработки (ЧЧ:ММ:СС)
- **SL (%)** - Уровень сервиса в процентах
- **Заброшенные** - Количество заброшенных звонков
- **Чаты** - Общее количество чатов
- **FRT** - Время первого ответа (ЧЧ:ММ:СС)
- **RT** - Время решения (ЧЧ:ММ:СС)

### Таблица "Total" содержит столбцы:
- **Date** - День отчетного периода
- **Agents** - Количество уникальных агентов
- **Calls** - Общее количество звонков
- **Chats** - Общее количество чатов
- **Total** - Общее количество обращений (звонки + чаты)

## Технические детали

### Backend API
Компонент использует метод `GetDailyData(startDate, endDate, queueName)` который:
- Выполняет 7 SQL запросов к MySQL базе данных
- Возвращает агрегированные данные по дням для всех метрик
- Включает данные о количестве уникальных агентов
- Конвертирует AHT из времени в минуты для графиков
- Обрабатывает все основные метрики контакт-центра

### Обработка ошибок
- **Индикатор загрузки** во время выполнения запросов
- **Сообщения об ошибках** при проблемах с подключением
- **Пустое состояние** когда данные отсутствуют

### Производительность
- **Кэширование данных** для избежания повторных запросов
- **Оптимизированные SQL запросы** с индексами
- **Ленивая загрузка** компонентов

## Цветовая схема

### Графики:
- **Calls** - Синий (#3B82F6)
- **AHT** - Фиолетовый (#8B5CF6)
- **SL** - Зеленый (#10B981)
- **Abandoned** - Красный (#EF4444)
- **Chats** - Голубой (#06B6D4)

### Total график:
- **Calls** - Синий (#3B82F6)
- **Chats** - Фиолетовый (#8B5CF6)
- **Total** - Зеленый (#10B981)
- **Agents** - Оранжевый (#F97316)

### Таблица:
- **Calls** - Синий (#3B82F6)
- **AHT** - Фиолетовый (#8B5CF6)
- **SL** - Зеленый (#10B981)
- **Abandoned** - Красный (#EF4444)
- **Chats** - Голубой (#06B6D4)
- **FRT** - Желтый (#EAB308)
- **RT** - Оранжевый (#F97316)
- **Agents** - Оранжевый (#F97316)

## Требования

### Системные требования:
- **MySQL** база данных с таблицами `call_report` и `chat_report`
- **Go** backend с Wails framework
- **React** frontend с TypeScript

### Зависимости:
- `recharts` - для создания графиков
- `lucide-react` - для иконок
- `clsx` - для условных CSS классов

## 🆕 Обновление v2.0 - Горизонтальные таблицы

### 🔄 Загрузка по требованию
- **Кнопка "Загрузить данные"** - убрана автоматическая загрузка
- **Ручное управление** - данные загружаются только после подтверждения
- **Контроль ресурсов** - предотвращение ненужных запросов

### 🗂️ Горизонтальные таблицы по метрикам
- **Формат: Метрика/Дата | Значения** - даты как колонки, метрика как строка
- **Отдельная таблица для каждой метрики** - специализированный вид
- **Компактное отображение** - максимум информации в минимуме места

### 📊 Метрика-специфичные таблицы
- **Calls**: `Calls/Date | Values` 
- **AHT**: `AHT(min)/Date | Values` - конвертация в минуты
- **SL**: `SL(%)/Date | Values` - отображение в процентах
- **Chats**: `Chats/Date | Values`
- **FRT**: `FRT(min)/Date | Values` - время первого ответа в минутах
- **RT**: `RT(min)/Date | Values` - время решения в минутах
- **Abandoned**: `Abandoned/Date | Values`
- **Total**: Многострочная таблица с Agents/Calls/Chats/Total

### 🎯 Target индикаторы
- **AHT target: 3 минуты** - показывается в заголовке графика
- **SL target: 95%** - показывается в заголовке графика

### 📈 Статистика периода
- **Total for period** - общая сумма за период (для Calls, Chats, Abandoned)
- **Average for period** - среднее значение за период (для AHT, SL, FRT, RT)
- **Детальная статистика** для Total метрики

### 👥 Данные об агентах
- **Количество уникальных агентов** по дням
- **Интеграция данных** из call_report и chat_report
- **Визуализация в Total графике**

### 🎨 Улучшенный UI
- **Кнопка загрузки** с анимацией и статусом
- **Цветовая кодировка** метрик в таблицах Total
- **Граничные линии** для лучшей читаемости таблиц

## Будущие улучшения
- Экспорт данных в Excel/CSV
- Фильтрация по агентам
- Сравнение периодов
- Настраиваемые метрики
- Уведомления о превышении порогов
- Почасовой вид данных (Hourly) 