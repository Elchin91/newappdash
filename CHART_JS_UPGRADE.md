# Chart.js Upgrade & Excel Export

## Обновления

### 🎨 Замена графиков на Chart.js

Все графики в приложении заменены с **Recharts** на **Chart.js** для лучшего визуального опыта:

#### Преимущества Chart.js:
- **Более красивый дизайн** - современные градиенты и эффекты
- **Лучшая производительность** - Canvas-based рендеринг
- **Плавные анимации** - встроенные transitions и hover эффекты
- **Адаптивность** - автоматическое масштабирование под размер экрана

### 📊 Улучшения визуализации:
- Закругленные углы столбцов (border-radius)
- Улучшенные цвета и градиенты
- Плавные анимации при загрузке (750ms)
- Улучшенные tooltips с целыми числами
- Темная тема для всех элементов графика

---

### 📑 Экспорт в Excel

Добавлена полная поддержка экспорта данных в Excel файлы.

#### Доступные опции экспорта:

1. **Export Current** (зеленая кнопка)
   - Экспортирует данные только текущей активной метрики
   - Файл названия: `{Metric}_{Queue}_{StartDate}_to_{EndDate}.xlsx`
   - Пример: `Calls_m10_01-01_to_01-07.xlsx`

2. **Export All** (синяя кнопка)
   - Экспортирует все метрики в одном файле
   - Файл названия: `All_Metrics_{Queue}_{StartDate}_to_{EndDate}.xlsx`
   - Включает: Date, Calls, AHT, SL, Abandoned, Chats, FRT, RT, Agents

#### Местоположение кнопок экспорта:
- **Daily View**: справа от заголовка графика
- **Другие вкладки**: справа от заголовка (пока неактивны для заглушек)

#### Форматы данных в Excel:
- **Даты**: MM/DD формат
- **Числа**: целые значения (rounded)
- **Проценты**: с символом % (например: 85.2%)
- **Время**: в минутах с 1 знаком после запятой

---

### 🛠 Технические детали

#### Новые зависимости:
```json
{
  "chart.js": "^4.x.x",
  "react-chartjs-2": "^5.x.x", 
  "xlsx": "^0.18.x",
  "file-saver": "^2.x.x",
  "@types/file-saver": "^2.x.x"
}
```

#### Удаленные зависимости:
- `recharts` - заменен на Chart.js

#### Файлы изменений:
- `src/components/DailyView.tsx` - полная замена графиков
- `src/utils/excelExport.ts` - новый модуль экспорта
- `src/components/Dashboard.tsx` - добавлены кнопки экспорта в заглушки
- `src/components/Sidebar.tsx` - добавлены иконки Download и FileSpreadsheet
- `src/App.css` - удалены старые стили Recharts

---

### 🎯 Использование

1. **Просмотр графиков**:
   - Выберите очередь и метрику в Sidebar
   - Нажмите "Apply" для загрузки данных
   - График автоматически обновится с новым дизайном Chart.js

2. **Экспорт данных**:
   - После загрузки данных кнопки экспорта становятся активными
   - Нажмите "Export Current" для экспорта только текущей метрики
   - Нажмите "Export All" для экспорта всех метрик
   - Файл автоматически скачается в папку Downloads

3. **Взаимодействие с графиком**:
   - Наведение мыши показывает точные значения (rounded)
   - Легенда показывает/скрывает конкретные серии данных
   - Автоматическое масштабирование осей

---

### 📋 Поддерживаемые метрики для экспорта:

- **Calls** - общее количество звонков
- **AHT** - среднее время обработки (в минутах)
- **SL** - уровень сервиса (в процентах)
- **Chats** - количество чатов  
- **FRT** - время первого ответа (в минутах)
- **RT** - время решения (в минутах)
- **Abandoned** - брошенные звонки
- **Total** - все метрики в одном файле

---

### 🚀 Будущие улучшения

Планируется добавить экспорт для:
- Hourly View (почасовые данные)
- Monthly View (месячные отчеты)
- Classifiers (данные классификаторов)
- Online Monitoring (real-time экспорт) 