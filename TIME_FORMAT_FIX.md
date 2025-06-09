# Time Format Fix для Single Metric Export

## Проблема
При экспорте отдельных метрик AHT, FRT, RT данные конвертировались в минуты (десятичные числа), а нужен был исходный формат `hh:mm:ss`.

## Исправление

### AHT (Average Handle Time)
#### ❌ Было:
```typescript
['AHT (min)', ...tableData.map(row => row.avg_call_duration_minutes.toFixed(1))]
```
**Результат:** 2.2, 2.1, 4.0 (в минутах)

#### ✅ Стало:
```typescript
['AHT (min)', ...tableData.map(row => row.avg_call_duration)]
```
**Результат:** 00:02:13, 00:02:10, 00:03:57 (в формате hh:mm:ss)

---

### FRT (First Response Time)
#### ❌ Было:
```typescript
['FRT (min)', ...tableData.map(row => {
  const timeToMinutes = (timeStr: string): number => {
    // конвертация в минуты...
  };
  return timeToMinutes(row.avg_chat_frt).toFixed(1);
})]
```
**Результат:** 1.9, 0.4, 2.9 (в минутах)

#### ✅ Стало:
```typescript
['FRT (min)', ...tableData.map(row => row.avg_chat_frt)]
```
**Результат:** 00:01:55, 00:00:22, 00:02:54 (в формате hh:mm:ss)

---

### RT (Resolution Time)
#### ❌ Было:
```typescript
['RT (min)', ...tableData.map(row => {
  const timeToMinutes = (timeStr: string): number => {
    // конвертация в минуты...
  };
  return timeToMinutes(row.resolution_time_avg).toFixed(1);
})]
```
**Результат:** 33.6, 25.3, 28.6 (в минутах)

#### ✅ Стало:
```typescript
['RT (min)', ...tableData.map(row => row.resolution_time_avg)]
```
**Результат:** 00:33:39, 00:25:18, 00:28:34 (в формате hh:mm:ss)

## Результат экспорта

### Export Current для AHT:
```
| Metric / 2025 | 30.05.2025 | 31.05.2025 | 01.06.2025 | ... |
|---------------|------------|------------|------------|-----|
| AHT (min)     | 00:02:13   | 00:02:10   | 00:02:14   | ... |
```

### Преимущества:
- ✅ **Точность данных** - время отображается точно как в исходной БД
- ✅ **Единообразие** - одинаковый формат для Export Current и Export All  
- ✅ **Читаемость** - формат hh:mm:ss более понятен пользователям
- ✅ **Соответствие UI** - экспорт соответствует отображению в приложении

## Затронутые функции:
- `exportMetricToExcel()` - случаи 'aht', 'frt', 'rt'
- `exportAllDataToExcel()` - уже был в правильном формате

Теперь все экспортируемые временные данные показываются в едином формате `hh:mm:ss` независимо от типа экспорта! 