package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// App структура приложения
type App struct {
	ctx       context.Context
	dbService *DatabaseService
}

// NewApp создает новый экземпляр приложения
func NewApp() *App {
	return &App{
		dbService: NewDatabaseService(),
	}
}

// OnStartup вызывается при запуске, здесь можно инициализировать соединения
func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx

	// Инициализация подключений к базам данных
	if err := a.dbService.ConnectMySQL(); err != nil {
		log.Printf("Не удалось подключиться к MySQL: %v", err)
	}

	if err := a.dbService.ConnectMongoDB(); err != nil {
		log.Printf("Не удалось подключиться к MongoDB: %v", err)
	}
}

// OnDomReady вызывается после загрузки DOM
func (a *App) OnDomReady(ctx context.Context) {
	// Можно добавить логику после загрузки DOM
}

// OnShutdown вызывается при завершении работы
func (a *App) OnShutdown(ctx context.Context) {
	// Закрытие соединений с базами данных
	a.dbService.Close()
}

// Greet возвращает приветствие с именем
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Привет %s, CC Dashboard готов к работе!", name)
}

// TestMySQLConnection проверяет соединение с MySQL
func (a *App) TestMySQLConnection() string {
	db := a.dbService.GetMySQLDB()
	if db == nil {
		return "MySQL соединение не установлено"
	}

	if err := db.Ping(); err != nil {
		return fmt.Sprintf("Ошибка соединения с MySQL: %v", err)
	}

	return "MySQL соединение активно"
}

// TestMongoDBConnection проверяет соединение с MongoDB
func (a *App) TestMongoDBConnection() string {
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB == nil {
		return "MongoDB соединение не установлено"
	}

	// Проверяем соединение через простой запрос
	ctx := context.Background()
	err := mongoDB.Client().Ping(ctx, nil)
	if err != nil {
		return fmt.Sprintf("Ошибка соединения с MongoDB: %v", err)
	}

	return "MongoDB соединение активно"
}

// TestMongoDBConnectionDetailed проверяет соединение с MongoDB с подробной диагностикой
func (a *App) TestMongoDBConnectionDetailed() map[string]interface{} {
	result := make(map[string]interface{})

	// Проверяем существующее соединение
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB != nil {
		ctx := context.Background()
		if err := mongoDB.Client().Ping(ctx, nil); err == nil {
			result["existing_connection"] = "Работает"
		} else {
			result["existing_connection"] = fmt.Sprintf("Ошибка: %v", err)
		}
	} else {
		result["existing_connection"] = "Не установлено"
	}

	// Тестируем прямое подключение с готовой URI
	testURI := "mongodb://readonly:q1w2e3r4%21%40%23@192.168.46.4:27017/request"
	result["test_direct_uri"] = a.testDirectMongoConnection(testURI)

	// Тестируем с authSource=admin
	testURIAdmin := "mongodb://readonly:q1w2e3r4%21%40%23@192.168.46.4:27017/request?authSource=admin"
	result["test_admin_auth"] = a.testDirectMongoConnection(testURIAdmin)

	return result
}

// testDirectMongoConnection тестирует прямое подключение с заданной URI
func (a *App) testDirectMongoConnection(uri string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return fmt.Sprintf("Ошибка подключения: %v", err)
	}
	defer client.Disconnect(ctx)

	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Sprintf("Ошибка пинга: %v", err)
	}

	// Проверим доступ к коллекциям
	db := client.Database("request")
	collections, err := db.ListCollectionNames(ctx, map[string]interface{}{})
	if err != nil {
		return fmt.Sprintf("Подключение успешно, но ошибка получения коллекций: %v", err)
	}

	return fmt.Sprintf("Успешно! Коллекции: %v", collections)
}

// GetDatabaseStats возвращает статистику подключенных баз данных
func (a *App) GetDatabaseStats() map[string]interface{} {
	stats := make(map[string]interface{})

	// Статистика MySQL
	mysqlStatus := "Не подключено"
	if db := a.dbService.GetMySQLDB(); db != nil {
		if err := db.Ping(); err == nil {
			mysqlStatus = "Подключено"
		}
	}
	stats["mysql"] = mysqlStatus

	// Статистика MongoDB
	mongoStatus := "Не подключено"
	if mongoDB := a.dbService.GetMongoDB(); mongoDB != nil {
		ctx := context.Background()
		if err := mongoDB.Client().Ping(ctx, nil); err == nil {
			mongoStatus = "Подключено"
		}
	}
	stats["mongodb"] = mongoStatus

	return stats
}

// isAMLQueue проверяет является ли очередь AML (регистронезависимо)
func isAMLQueue(queueName string) bool {
	return queueName == "AML" || queueName == "aml"
}

// GetDailyData получает ежедневные данные для указанного периода и очереди
func (a *App) GetDailyData(startDate, endDate, queueName string) (map[string]interface{}, error) {
	db := a.dbService.GetMySQLDB()
	if db == nil {
		return nil, fmt.Errorf("MySQL соединение не установлено")
	}

	// Отладочная информация
	fmt.Printf("=== GetDailyData ===\n")
	fmt.Printf("startDate: %s\n", startDate)
	fmt.Printf("endDate: %s\n", endDate)
	fmt.Printf("queueName: %s\n", queueName)
	fmt.Printf("=====================\n")

	result := make(map[string]interface{})

	// Параметры для очереди
	var queueCondition string
	var queueParams []interface{}

	if queueName == "all" {
		// All queues - обе очереди
		queueCondition = "(queue_name = ? OR queue_name = ?)"
		queueParams = []interface{}{"m10", "m10-shikayet"}
	} else if queueName == "m10" {
		// m10 - только основная очередь
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{"m10"}
	} else if isAMLQueue(queueName) {
		// AML - только очередь жалоб
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{"m10-shikayet"}
	} else {
		// Fallback - используем как есть
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{queueName}
	}

	// Запрос для звонков
	callsQuery := fmt.Sprintf(`
		SELECT 
		  DATE(enter_queue_date) AS report_date,
		  COUNT(*) AS total_calls
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND type IN ('in', 'abandon')
		  AND %s
		GROUP BY report_date
		ORDER BY report_date
	`, queueCondition)

	queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	queryParams = append(queryParams, queueParams...)
	rows, err := db.Query(callsQuery, queryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса звонков: %v", err)
	}
	defer rows.Close()

	calls := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date string
		var totalCalls int
		if err := rows.Scan(&date, &totalCalls); err != nil {
			continue
		}
		calls = append(calls, map[string]interface{}{
			"date":        date,
			"total_calls": totalCalls,
		})
		// Отладка каждой записи
		fmt.Printf("Found call data: date=%s, calls=%d\n", date, totalCalls)
	}
	result["calls"] = calls

	// Отладка итогового результата
	fmt.Printf("Total call records found: %d\n", len(calls))

	// Запрос для AHT
	ahtQuery := fmt.Sprintf(`
		SELECT
		  DATE(enter_queue_date) AS report_date,
		  SEC_TO_TIME(ROUND(AVG(call_duration))) AS avg_call_duration
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND type = 'in'
		  AND %s
		GROUP BY report_date
		ORDER BY report_date
	`, queueCondition)

	queryParams = []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	queryParams = append(queryParams, queueParams...)
	rows, err = db.Query(ahtQuery, queryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса AHT: %v", err)
	}
	defer rows.Close()

	aht := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date, avgDuration string
		if err := rows.Scan(&date, &avgDuration); err != nil {
			continue
		}
		aht = append(aht, map[string]interface{}{
			"date":              date,
			"avg_call_duration": avgDuration,
		})
	}
	result["aht"] = aht

	// Запрос для SL
	slQuery := fmt.Sprintf(`
		SELECT DATE(enter_queue_date) AS report_date,
		       ROUND(SUM(CASE WHEN queue_wait_time <= 20 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS sl
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND type = 'in'
		  AND %s
		GROUP BY report_date
		ORDER BY report_date
	`, queueCondition)

	queryParams = []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	queryParams = append(queryParams, queueParams...)
	rows, err = db.Query(slQuery, queryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса SL: %v", err)
	}
	defer rows.Close()

	sl := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date string
		var slValue float64
		if err := rows.Scan(&date, &slValue); err != nil {
			continue
		}
		sl = append(sl, map[string]interface{}{
			"date": date,
			"sl":   slValue,
		})
	}
	result["sl"] = sl

	// Запрос для заброшенных звонков
	abandonedQuery := fmt.Sprintf(`
		SELECT DATE(enter_queue_date) AS report_date, COUNT(*) AS total_abandoned
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND type = 'abandon'
		  AND %s
		GROUP BY report_date
		ORDER BY report_date
	`, queueCondition)

	queryParams = []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	queryParams = append(queryParams, queueParams...)
	rows, err = db.Query(abandonedQuery, queryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса заброшенных звонков: %v", err)
	}
	defer rows.Close()

	abandoned := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date string
		var totalAbandoned int
		if err := rows.Scan(&date, &totalAbandoned); err != nil {
			continue
		}
		abandoned = append(abandoned, map[string]interface{}{
			"date":            date,
			"total_abandoned": totalAbandoned,
		})
	}
	result["abandoned"] = abandoned

	// Запрос для чатов
	chatsQuery := `
		SELECT
		  DATE(assign_date) AS report_date,
		  COUNT(*) AS total_chats
		FROM chat_report
		WHERE type = 'in'
		  AND assign_date BETWEEN ? AND ?
		GROUP BY report_date
		ORDER BY report_date
	`

	rows, err = db.Query(chatsQuery, startDate+" 00:00:00", endDate+" 23:59:59")
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса чатов: %v", err)
	}
	defer rows.Close()

	chats := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date string
		var totalChats int
		if err := rows.Scan(&date, &totalChats); err != nil {
			continue
		}
		chats = append(chats, map[string]interface{}{
			"date":        date,
			"total_chats": totalChats,
		})
	}
	result["chats"] = chats

	// Запрос для FRT
	frtQuery := `
		SELECT
		  DATE(assign_date) AS report_date,
		  SEC_TO_TIME(ROUND(AVG(chat_frt))) AS avg_chat_frt
		FROM chat_report
		WHERE assign_date BETWEEN ? AND ?
		  AND type = 'in'
		GROUP BY report_date
		ORDER BY report_date
	`

	rows, err = db.Query(frtQuery, startDate+" 00:00:00", endDate+" 23:59:59")
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса FRT: %v", err)
	}
	defer rows.Close()

	frt := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date, avgFRT string
		if err := rows.Scan(&date, &avgFRT); err != nil {
			continue
		}
		frt = append(frt, map[string]interface{}{
			"date":         date,
			"avg_chat_frt": avgFRT,
		})
	}
	result["frt"] = frt

	// Запрос для RT
	rtQuery := `
		SELECT
		  DATE(assign_date) AS report_date,
		  SEC_TO_TIME(ROUND(AVG(resolution_time_total))) AS resolution_time_avg
		FROM chat_report
		WHERE assign_date BETWEEN ? AND ?
		  AND type = 'in'
		GROUP BY report_date
		ORDER BY report_date
	`

	rows, err = db.Query(rtQuery, startDate+" 00:00:00", endDate+" 23:59:59")
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса RT: %v", err)
	}
	defer rows.Close()

	rt := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date, avgRT string
		if err := rows.Scan(&date, &avgRT); err != nil {
			continue
		}
		rt = append(rt, map[string]interface{}{
			"date":                date,
			"resolution_time_avg": avgRT,
		})
	}
	result["rt"] = rt

	// Запрос для агентов
	agentsQuery := fmt.Sprintf(`
		SELECT
		  report_date,
		  COUNT(DISTINCT user_id) AS distinct_agents
		FROM (
		  SELECT
		    DATE(answer_date) AS report_date,
		    user_id
		  FROM call_report
		  WHERE answer_date BETWEEN ? AND ?
		    AND type = 'in'
		    AND %s
		  UNION
		  SELECT
		    DATE(assign_date) AS report_date,
		    user_id
		  FROM chat_report
		  WHERE assign_date BETWEEN ? AND ?
		    AND agent_frt > 0
		) t
		GROUP BY report_date
		ORDER BY report_date
	`, queueCondition)

	agentQueryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	agentQueryParams = append(agentQueryParams, queueParams...)
	agentQueryParams = append(agentQueryParams, startDate+" 00:00:00", endDate+" 23:59:59")
	rows, err = db.Query(agentsQuery, agentQueryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса агентов: %v", err)
	}
	defer rows.Close()

	agents := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date string
		var distinctAgents int
		if err := rows.Scan(&date, &distinctAgents); err != nil {
			continue
		}
		agents = append(agents, map[string]interface{}{
			"date":            date,
			"distinct_agents": distinctAgents,
		})
	}
	result["agents"] = agents

	return result, nil
}

// GetMonthlyData получает месячные данные для указанного периода и очереди
func (a *App) GetMonthlyData(startDate, endDate, queueName string) (map[string]interface{}, error) {
	db := a.dbService.GetMySQLDB()
	if db == nil {
		return nil, fmt.Errorf("MySQL соединение не установлено")
	}

	// Отладочная информация
	fmt.Printf("=== GetMonthlyData ===\n")
	fmt.Printf("startDate: %s\n", startDate)
	fmt.Printf("endDate: %s\n", endDate)
	fmt.Printf("queueName: %s\n", queueName)
	fmt.Printf("=====================\n")

	result := make(map[string]interface{})

	// Параметры для очереди
	var queueCondition string
	var queueParams []interface{}

	if queueName == "all" {
		// All queues - обе очереди
		queueCondition = "(queue_name = ? OR queue_name = ?)"
		queueParams = []interface{}{"m10", "m10-shikayet"}
	} else if queueName == "m10" {
		// m10 - только основная очередь
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{"m10"}
	} else if isAMLQueue(queueName) {
		// AML - только очередь жалоб
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{"m10-shikayet"}
	} else {
		// Fallback - используем как есть
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{queueName}
	}

	// Запрос для звонков по месяцам
	callsQuery := fmt.Sprintf(`
		SELECT DATE_FORMAT(enter_queue_date, '%%Y-%%m') AS month,
		       DAY(enter_queue_date) AS day,
		       COUNT(*) AS total_calls,
		       SEC_TO_TIME(ROUND(AVG(CASE WHEN type = 'in' THEN call_duration ELSE NULL END))) AS avg_call_duration,
		       ROUND(SUM(CASE WHEN type = 'in' AND queue_wait_time <= 20 THEN 1 ELSE 0 END) / 
		             NULLIF(SUM(CASE WHEN type = 'in' THEN 1 ELSE 0 END), 0) * 100, 2) AS sl
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND type IN ('in', 'abandon')
		  AND %s
		GROUP BY month, day
		ORDER BY day
	`, queueCondition)

	queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	queryParams = append(queryParams, queueParams...)
	rows, err := db.Query(callsQuery, queryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса звонков: %v", err)
	}
	defer rows.Close()

	callsData := make([]map[string]interface{}, 0)
	for rows.Next() {
		var month string
		var day int
		var totalCalls int
		var avgDuration string
		var sl float64
		if err := rows.Scan(&month, &day, &totalCalls, &avgDuration, &sl); err != nil {
			continue
		}
		callsData = append(callsData, map[string]interface{}{
			"month":             month,
			"day":               day,
			"total_calls":       totalCalls,
			"avg_call_duration": avgDuration,
			"sl":                sl,
		})
	}

	// Запрос для заброшенных звонков
	abandonedQuery := fmt.Sprintf(`
		SELECT DAY(enter_queue_date) AS day,
		       COUNT(*) AS total_abandoned
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND type = 'abandon'
		  AND %s
		GROUP BY day
		ORDER BY day
	`, queueCondition)

	queryParams = []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	queryParams = append(queryParams, queueParams...)
	rows, err = db.Query(abandonedQuery, queryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса заброшенных звонков: %v", err)
	}
	defer rows.Close()

	abandonedMap := make(map[int]int)
	for rows.Next() {
		var day, totalAbandoned int
		if err := rows.Scan(&day, &totalAbandoned); err != nil {
			continue
		}
		abandonedMap[day] = totalAbandoned
	}

	// Запрос для агентов
	agentsQuery := fmt.Sprintf(`
		SELECT day, COUNT(DISTINCT user_id) AS distinct_agents FROM (
		    SELECT DAY(answer_date) AS day, user_id
		    FROM call_report
		    WHERE answer_date BETWEEN ? AND ?
		      AND type = 'in'
		      AND %s
		    UNION
		    SELECT DAY(assign_date) AS day, user_id
		    FROM chat_report
		    WHERE assign_date BETWEEN ? AND ?
		      AND agent_frt > 0
		) t
		GROUP BY day
		ORDER BY day
	`, queueCondition)

	agentQueryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
	agentQueryParams = append(agentQueryParams, queueParams...)
	agentQueryParams = append(agentQueryParams, startDate+" 00:00:00", endDate+" 23:59:59")
	rows, err = db.Query(agentsQuery, agentQueryParams...)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса агентов: %v", err)
	}
	defer rows.Close()

	agentsMap := make(map[int]int)
	for rows.Next() {
		var day, distinctAgents int
		if err := rows.Scan(&day, &distinctAgents); err != nil {
			continue
		}
		agentsMap[day] = distinctAgents
	}

	// Объединяем данные звонков с заброшенными и агентами
	for i, call := range callsData {
		day := call["day"].(int)
		callsData[i]["total_abandoned"] = abandonedMap[day]
		callsData[i]["distinct_agents"] = agentsMap[day]
	}

	result["calls"] = callsData

	// Запрос для чатов по месяцам
	chatsQuery := `
		SELECT DATE_FORMAT(assign_date, '%Y-%m') AS month,
		       DAY(assign_date) AS day,
		       COUNT(*) AS total_chats,
		       SEC_TO_TIME(ROUND(AVG(chat_frt))) AS avg_chat_frt,
		       SEC_TO_TIME(ROUND(AVG(resolution_time_total))) AS resolution_time_avg
		FROM chat_report
		WHERE type = 'in'
		  AND assign_date BETWEEN ? AND ?
		GROUP BY month, day
		ORDER BY day
	`

	rows, err = db.Query(chatsQuery, startDate+" 00:00:00", endDate+" 23:59:59")
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса чатов: %v", err)
	}
	defer rows.Close()

	chatsData := make([]map[string]interface{}, 0)
	for rows.Next() {
		var month string
		var day int
		var totalChats int
		var avgFrt, resolutionTime string
		if err := rows.Scan(&month, &day, &totalChats, &avgFrt, &resolutionTime); err != nil {
			continue
		}
		chatsData = append(chatsData, map[string]interface{}{
			"month":               month,
			"day":                 day,
			"total_chats":         totalChats,
			"avg_chat_frt":        avgFrt,
			"resolution_time_avg": resolutionTime,
		})
	}

	result["chats"] = chatsData

	return result, nil
}

// GetQueueStats возвращает статистику по очередям для отладки
func (a *App) GetQueueStats(startDate, endDate string) (map[string]interface{}, error) {
	db := a.dbService.GetMySQLDB()
	if db == nil {
		return nil, fmt.Errorf("MySQL соединение не установлено")
	}

	result := make(map[string]interface{})

	// Проверяем все уникальные queue_name в указанном периоде
	queueQuery := `
		SELECT DISTINCT queue_name, COUNT(*) as count
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		GROUP BY queue_name
		ORDER BY count DESC
	`

	rows, err := db.Query(queueQuery, startDate+" 00:00:00", endDate+" 23:59:59")
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса очередей: %v", err)
	}
	defer rows.Close()

	queues := make([]map[string]interface{}, 0)
	for rows.Next() {
		var queueName string
		var count int
		if err := rows.Scan(&queueName, &count); err != nil {
			continue
		}
		queues = append(queues, map[string]interface{}{
			"queue_name": queueName,
			"count":      count,
		})
	}
	result["queues"] = queues

	// Проверяем конкретно данные для m10-shikayet
	amlQuery := `
		SELECT 
			DATE(enter_queue_date) as date,
			COUNT(*) as total_calls,
			SUM(CASE WHEN type = 'in' THEN 1 ELSE 0 END) as incoming_calls,
			SUM(CASE WHEN type = 'abandon' THEN 1 ELSE 0 END) as abandoned_calls
		FROM call_report
		WHERE enter_queue_date BETWEEN ? AND ?
		  AND queue_name = 'm10-shikayet'
		GROUP BY DATE(enter_queue_date)
		ORDER BY date
	`

	rows, err = db.Query(amlQuery, startDate+" 00:00:00", endDate+" 23:59:59")
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения запроса AML: %v", err)
	}
	defer rows.Close()

	amlData := make([]map[string]interface{}, 0)
	for rows.Next() {
		var date string
		var totalCalls, incomingCalls, abandonedCalls int
		if err := rows.Scan(&date, &totalCalls, &incomingCalls, &abandonedCalls); err != nil {
			continue
		}
		amlData = append(amlData, map[string]interface{}{
			"date":            date,
			"total_calls":     totalCalls,
			"incoming_calls":  incomingCalls,
			"abandoned_calls": abandonedCalls,
		})
	}
	result["aml_data"] = amlData

	return result, nil
}

// GetHourlyData получает почасовые данные для указанного периода и очереди
func (a *App) GetHourlyData(startDate, endDate, queueName, metric string) (map[string]interface{}, error) {
	db := a.dbService.GetMySQLDB()
	if db == nil {
		return nil, fmt.Errorf("MySQL соединение не установлено")
	}

	// Отладочная информация
	fmt.Printf("=== GetHourlyData ===\n")
	fmt.Printf("startDate: %s\n", startDate)
	fmt.Printf("endDate: %s\n", endDate)
	fmt.Printf("queueName: %s\n", queueName)
	fmt.Printf("metric: %s\n", metric)
	fmt.Printf("=====================\n")

	result := make(map[string]interface{})

	// Параметры для очереди
	var queueCondition string
	var queueParams []interface{}

	if queueName == "all" {
		queueCondition = "(queue_name = ? OR queue_name = ?)"
		queueParams = []interface{}{"m10", "m10-shikayet"}
	} else if queueName == "m10" {
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{"m10"}
	} else if isAMLQueue(queueName) {
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{"m10-shikayet"}
	} else {
		queueCondition = "queue_name = ?"
		queueParams = []interface{}{queueName}
	}

	switch metric {
	case "calls":
		// Запрос для звонков по часам
		query := fmt.Sprintf(`
			SELECT
			  DATE(c.enter_queue_date) AS Day,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=0  THEN 1 ELSE 0 END) AS hour_0,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=1  THEN 1 ELSE 0 END) AS hour_1,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=2  THEN 1 ELSE 0 END) AS hour_2,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=3  THEN 1 ELSE 0 END) AS hour_3,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=4  THEN 1 ELSE 0 END) AS hour_4,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=5  THEN 1 ELSE 0 END) AS hour_5,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=6  THEN 1 ELSE 0 END) AS hour_6,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=7  THEN 1 ELSE 0 END) AS hour_7,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=8  THEN 1 ELSE 0 END) AS hour_8,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=9  THEN 1 ELSE 0 END) AS hour_9,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=10 THEN 1 ELSE 0 END) AS hour_10,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=11 THEN 1 ELSE 0 END) AS hour_11,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=12 THEN 1 ELSE 0 END) AS hour_12,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=13 THEN 1 ELSE 0 END) AS hour_13,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=14 THEN 1 ELSE 0 END) AS hour_14,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=15 THEN 1 ELSE 0 END) AS hour_15,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=16 THEN 1 ELSE 0 END) AS hour_16,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=17 THEN 1 ELSE 0 END) AS hour_17,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=18 THEN 1 ELSE 0 END) AS hour_18,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=19 THEN 1 ELSE 0 END) AS hour_19,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=20 THEN 1 ELSE 0 END) AS hour_20,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=21 THEN 1 ELSE 0 END) AS hour_21,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=22 THEN 1 ELSE 0 END) AS hour_22,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=23 THEN 1 ELSE 0 END) AS hour_23
			FROM call_report c
			WHERE c.enter_queue_date >= ? AND c.enter_queue_date <= ?
			  AND c.type = 'in'
			  AND %s
			GROUP BY Day
			ORDER BY Day
		`, queueCondition)

		queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
		queryParams = append(queryParams, queueParams...)

		rows, err := db.Query(query, queryParams...)
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса звонков по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]int
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				row[fmt.Sprintf("hour_%d", i)] = hours[i]
			}
			data = append(data, row)
		}
		result["data"] = data

	case "aht":
		// Запрос для AHT по часам
		query := fmt.Sprintf(`
			SELECT
			  DATE(c.answer_date) AS Day,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=0  THEN c.call_duration ELSE NULL END)) AS hour_0,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=1  THEN c.call_duration ELSE NULL END)) AS hour_1,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=2  THEN c.call_duration ELSE NULL END)) AS hour_2,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=3  THEN c.call_duration ELSE NULL END)) AS hour_3,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=4  THEN c.call_duration ELSE NULL END)) AS hour_4,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=5  THEN c.call_duration ELSE NULL END)) AS hour_5,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=6  THEN c.call_duration ELSE NULL END)) AS hour_6,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=7  THEN c.call_duration ELSE NULL END)) AS hour_7,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=8  THEN c.call_duration ELSE NULL END)) AS hour_8,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=9  THEN c.call_duration ELSE NULL END)) AS hour_9,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=10 THEN c.call_duration ELSE NULL END)) AS hour_10,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=11 THEN c.call_duration ELSE NULL END)) AS hour_11,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=12 THEN c.call_duration ELSE NULL END)) AS hour_12,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=13 THEN c.call_duration ELSE NULL END)) AS hour_13,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=14 THEN c.call_duration ELSE NULL END)) AS hour_14,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=15 THEN c.call_duration ELSE NULL END)) AS hour_15,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=16 THEN c.call_duration ELSE NULL END)) AS hour_16,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=17 THEN c.call_duration ELSE NULL END)) AS hour_17,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=18 THEN c.call_duration ELSE NULL END)) AS hour_18,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=19 THEN c.call_duration ELSE NULL END)) AS hour_19,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=20 THEN c.call_duration ELSE NULL END)) AS hour_20,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=21 THEN c.call_duration ELSE NULL END)) AS hour_21,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=22 THEN c.call_duration ELSE NULL END)) AS hour_22,
			  ROUND(AVG(CASE WHEN HOUR(c.answer_date)=23 THEN c.call_duration ELSE NULL END)) AS hour_23
			FROM call_report c
			WHERE c.answer_date >= ? AND c.answer_date <= ?
			  AND c.type = 'in'
			  AND %s
			GROUP BY Day
			ORDER BY Day
		`, queueCondition)

		queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
		queryParams = append(queryParams, queueParams...)

		rows, err := db.Query(query, queryParams...)
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса AHT по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]*float64
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				if hours[i] != nil {
					row[fmt.Sprintf("hour_%d", i)] = *hours[i]
				} else {
					row[fmt.Sprintf("hour_%d", i)] = 0
				}
			}
			data = append(data, row)
		}
		result["data"] = data

	case "sl":
		// Запрос для SL по часам
		query := fmt.Sprintf(`
			SELECT
			  DATE(c.enter_queue_date) AS Day,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=0  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=0  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_0,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=1  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=1  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_1,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=2  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=2  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_2,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=3  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=3  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_3,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=4  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=4  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_4,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=5  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=5  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_5,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=6  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=6  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_6,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=7  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=7  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_7,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=8  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=8  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_8,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=9  AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=9  THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_9,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=10 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=10 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_10,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=11 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=11 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_11,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=12 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=12 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_12,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=13 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=13 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_13,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=14 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=14 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_14,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=15 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=15 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_15,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=16 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=16 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_16,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=17 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=17 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_17,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=18 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=18 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_18,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=19 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=19 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_19,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=20 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=20 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_20,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=21 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=21 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_21,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=22 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=22 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_22,
			  ROUND(SUM(CASE WHEN HOUR(c.enter_queue_date)=23 AND c.queue_wait_time <= 20 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN HOUR(c.enter_queue_date)=23 THEN 1 ELSE 0 END), 0) * 100, 2) AS hour_23
			FROM call_report c
			WHERE c.enter_queue_date >= ? AND c.enter_queue_date <= ?
			  AND c.type = 'in'
			  AND %s
			GROUP BY Day
			ORDER BY Day
		`, queueCondition)

		queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
		queryParams = append(queryParams, queueParams...)

		rows, err := db.Query(query, queryParams...)
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса SL по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]*float64
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				if hours[i] != nil {
					row[fmt.Sprintf("hour_%d", i)] = *hours[i]
				} else {
					row[fmt.Sprintf("hour_%d", i)] = 0
				}
			}
			data = append(data, row)
		}
		result["data"] = data

	case "abandoned":
		// Запрос для заброшенных звонков по часам
		query := fmt.Sprintf(`
			SELECT
			  DATE(c.enter_queue_date) AS Day,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=0  THEN 1 ELSE 0 END) AS hour_0,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=1  THEN 1 ELSE 0 END) AS hour_1,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=2  THEN 1 ELSE 0 END) AS hour_2,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=3  THEN 1 ELSE 0 END) AS hour_3,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=4  THEN 1 ELSE 0 END) AS hour_4,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=5  THEN 1 ELSE 0 END) AS hour_5,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=6  THEN 1 ELSE 0 END) AS hour_6,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=7  THEN 1 ELSE 0 END) AS hour_7,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=8  THEN 1 ELSE 0 END) AS hour_8,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=9  THEN 1 ELSE 0 END) AS hour_9,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=10 THEN 1 ELSE 0 END) AS hour_10,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=11 THEN 1 ELSE 0 END) AS hour_11,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=12 THEN 1 ELSE 0 END) AS hour_12,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=13 THEN 1 ELSE 0 END) AS hour_13,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=14 THEN 1 ELSE 0 END) AS hour_14,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=15 THEN 1 ELSE 0 END) AS hour_15,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=16 THEN 1 ELSE 0 END) AS hour_16,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=17 THEN 1 ELSE 0 END) AS hour_17,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=18 THEN 1 ELSE 0 END) AS hour_18,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=19 THEN 1 ELSE 0 END) AS hour_19,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=20 THEN 1 ELSE 0 END) AS hour_20,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=21 THEN 1 ELSE 0 END) AS hour_21,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=22 THEN 1 ELSE 0 END) AS hour_22,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=23 THEN 1 ELSE 0 END) AS hour_23
			FROM call_report c
			WHERE c.enter_queue_date >= ? AND c.enter_queue_date <= ?
			  AND c.type = 'abandon'
			  AND %s
			GROUP BY Day
			ORDER BY Day
		`, queueCondition)

		queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
		queryParams = append(queryParams, queueParams...)

		rows, err := db.Query(query, queryParams...)
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса заброшенных звонков по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]int
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				row[fmt.Sprintf("hour_%d", i)] = hours[i]
			}
			data = append(data, row)
		}
		result["data"] = data

	case "chats":
		// Запрос для чатов по часам
		query := `
			SELECT
			  DATE(c.created_date) AS Day,
			  SUM(CASE WHEN HOUR(c.created_date)=0  THEN 1 ELSE 0 END) AS hour_0,
			  SUM(CASE WHEN HOUR(c.created_date)=1  THEN 1 ELSE 0 END) AS hour_1,
			  SUM(CASE WHEN HOUR(c.created_date)=2  THEN 1 ELSE 0 END) AS hour_2,
			  SUM(CASE WHEN HOUR(c.created_date)=3  THEN 1 ELSE 0 END) AS hour_3,
			  SUM(CASE WHEN HOUR(c.created_date)=4  THEN 1 ELSE 0 END) AS hour_4,
			  SUM(CASE WHEN HOUR(c.created_date)=5  THEN 1 ELSE 0 END) AS hour_5,
			  SUM(CASE WHEN HOUR(c.created_date)=6  THEN 1 ELSE 0 END) AS hour_6,
			  SUM(CASE WHEN HOUR(c.created_date)=7  THEN 1 ELSE 0 END) AS hour_7,
			  SUM(CASE WHEN HOUR(c.created_date)=8  THEN 1 ELSE 0 END) AS hour_8,
			  SUM(CASE WHEN HOUR(c.created_date)=9  THEN 1 ELSE 0 END) AS hour_9,
			  SUM(CASE WHEN HOUR(c.created_date)=10 THEN 1 ELSE 0 END) AS hour_10,
			  SUM(CASE WHEN HOUR(c.created_date)=11 THEN 1 ELSE 0 END) AS hour_11,
			  SUM(CASE WHEN HOUR(c.created_date)=12 THEN 1 ELSE 0 END) AS hour_12,
			  SUM(CASE WHEN HOUR(c.created_date)=13 THEN 1 ELSE 0 END) AS hour_13,
			  SUM(CASE WHEN HOUR(c.created_date)=14 THEN 1 ELSE 0 END) AS hour_14,
			  SUM(CASE WHEN HOUR(c.created_date)=15 THEN 1 ELSE 0 END) AS hour_15,
			  SUM(CASE WHEN HOUR(c.created_date)=16 THEN 1 ELSE 0 END) AS hour_16,
			  SUM(CASE WHEN HOUR(c.created_date)=17 THEN 1 ELSE 0 END) AS hour_17,
			  SUM(CASE WHEN HOUR(c.created_date)=18 THEN 1 ELSE 0 END) AS hour_18,
			  SUM(CASE WHEN HOUR(c.created_date)=19 THEN 1 ELSE 0 END) AS hour_19,
			  SUM(CASE WHEN HOUR(c.created_date)=20 THEN 1 ELSE 0 END) AS hour_20,
			  SUM(CASE WHEN HOUR(c.created_date)=21 THEN 1 ELSE 0 END) AS hour_21,
			  SUM(CASE WHEN HOUR(c.created_date)=22 THEN 1 ELSE 0 END) AS hour_22,
			  SUM(CASE WHEN HOUR(c.created_date)=23 THEN 1 ELSE 0 END) AS hour_23
			FROM chat_report c
			WHERE c.type = 'in'
			  AND c.created_date >= ? AND c.created_date <= ?
			GROUP BY Day
			ORDER BY Day
		`

		rows, err := db.Query(query, startDate+" 00:00:00", endDate+" 23:59:59")
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса чатов по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]int
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				row[fmt.Sprintf("hour_%d", i)] = hours[i]
			}
			data = append(data, row)
		}
		result["data"] = data

	case "frt":
		// Запрос для FRT по часам
		query := `
			SELECT
			  DATE(c.assign_date) AS Day,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=0  THEN c.chat_frt ELSE NULL END)) AS hour_0,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=1  THEN c.chat_frt ELSE NULL END)) AS hour_1,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=2  THEN c.chat_frt ELSE NULL END)) AS hour_2,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=3  THEN c.chat_frt ELSE NULL END)) AS hour_3,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=4  THEN c.chat_frt ELSE NULL END)) AS hour_4,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=5  THEN c.chat_frt ELSE NULL END)) AS hour_5,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=6  THEN c.chat_frt ELSE NULL END)) AS hour_6,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=7  THEN c.chat_frt ELSE NULL END)) AS hour_7,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=8  THEN c.chat_frt ELSE NULL END)) AS hour_8,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=9  THEN c.chat_frt ELSE NULL END)) AS hour_9,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=10 THEN c.chat_frt ELSE NULL END)) AS hour_10,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=11 THEN c.chat_frt ELSE NULL END)) AS hour_11,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=12 THEN c.chat_frt ELSE NULL END)) AS hour_12,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=13 THEN c.chat_frt ELSE NULL END)) AS hour_13,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=14 THEN c.chat_frt ELSE NULL END)) AS hour_14,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=15 THEN c.chat_frt ELSE NULL END)) AS hour_15,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=16 THEN c.chat_frt ELSE NULL END)) AS hour_16,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=17 THEN c.chat_frt ELSE NULL END)) AS hour_17,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=18 THEN c.chat_frt ELSE NULL END)) AS hour_18,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=19 THEN c.chat_frt ELSE NULL END)) AS hour_19,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=20 THEN c.chat_frt ELSE NULL END)) AS hour_20,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=21 THEN c.chat_frt ELSE NULL END)) AS hour_21,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=22 THEN c.chat_frt ELSE NULL END)) AS hour_22,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=23 THEN c.chat_frt ELSE NULL END)) AS hour_23
			FROM chat_report c
			WHERE c.assign_date >= ? AND c.assign_date <= ?
			  AND c.type = 'in'
			GROUP BY Day
			ORDER BY Day
		`

		rows, err := db.Query(query, startDate+" 00:00:00", endDate+" 23:59:59")
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса FRT по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]*float64
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				if hours[i] != nil {
					row[fmt.Sprintf("hour_%d", i)] = *hours[i]
				} else {
					row[fmt.Sprintf("hour_%d", i)] = 0
				}
			}
			data = append(data, row)
		}
		result["data"] = data

	case "rt":
		// Запрос для RT по часам
		query := `
			SELECT
			  DATE(c.assign_date) AS Day,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=0  THEN c.resolution_time_total ELSE NULL END)) AS hour_0,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=1  THEN c.resolution_time_total ELSE NULL END)) AS hour_1,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=2  THEN c.resolution_time_total ELSE NULL END)) AS hour_2,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=3  THEN c.resolution_time_total ELSE NULL END)) AS hour_3,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=4  THEN c.resolution_time_total ELSE NULL END)) AS hour_4,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=5  THEN c.resolution_time_total ELSE NULL END)) AS hour_5,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=6  THEN c.resolution_time_total ELSE NULL END)) AS hour_6,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=7  THEN c.resolution_time_total ELSE NULL END)) AS hour_7,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=8  THEN c.resolution_time_total ELSE NULL END)) AS hour_8,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=9  THEN c.resolution_time_total ELSE NULL END)) AS hour_9,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=10 THEN c.resolution_time_total ELSE NULL END)) AS hour_10,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=11 THEN c.resolution_time_total ELSE NULL END)) AS hour_11,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=12 THEN c.resolution_time_total ELSE NULL END)) AS hour_12,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=13 THEN c.resolution_time_total ELSE NULL END)) AS hour_13,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=14 THEN c.resolution_time_total ELSE NULL END)) AS hour_14,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=15 THEN c.resolution_time_total ELSE NULL END)) AS hour_15,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=16 THEN c.resolution_time_total ELSE NULL END)) AS hour_16,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=17 THEN c.resolution_time_total ELSE NULL END)) AS hour_17,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=18 THEN c.resolution_time_total ELSE NULL END)) AS hour_18,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=19 THEN c.resolution_time_total ELSE NULL END)) AS hour_19,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=20 THEN c.resolution_time_total ELSE NULL END)) AS hour_20,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=21 THEN c.resolution_time_total ELSE NULL END)) AS hour_21,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=22 THEN c.resolution_time_total ELSE NULL END)) AS hour_22,
			  ROUND(AVG(CASE WHEN HOUR(c.assign_date)=23 THEN c.resolution_time_total ELSE NULL END)) AS hour_23
			FROM chat_report c
			WHERE c.assign_date >= ? AND c.assign_date <= ?
			  AND c.type = 'in'
			GROUP BY Day
			ORDER BY Day
		`

		rows, err := db.Query(query, startDate+" 00:00:00", endDate+" 23:59:59")
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса RT по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]*float64
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				if hours[i] != nil {
					row[fmt.Sprintf("hour_%d", i)] = *hours[i]
				} else {
					row[fmt.Sprintf("hour_%d", i)] = 0
				}
			}
			data = append(data, row)
		}
		result["data"] = data

	case "agents":
		// Запрос для количества агентов по часам
		query := fmt.Sprintf(`
			SELECT
			  t.Day,
			  COUNT(DISTINCT CASE WHEN t.Hour = 0  THEN t.user_id ELSE NULL END) AS hour_0,
			  COUNT(DISTINCT CASE WHEN t.Hour = 1  THEN t.user_id ELSE NULL END) AS hour_1,
			  COUNT(DISTINCT CASE WHEN t.Hour = 2  THEN t.user_id ELSE NULL END) AS hour_2,
			  COUNT(DISTINCT CASE WHEN t.Hour = 3  THEN t.user_id ELSE NULL END) AS hour_3,
			  COUNT(DISTINCT CASE WHEN t.Hour = 4  THEN t.user_id ELSE NULL END) AS hour_4,
			  COUNT(DISTINCT CASE WHEN t.Hour = 5  THEN t.user_id ELSE NULL END) AS hour_5,
			  COUNT(DISTINCT CASE WHEN t.Hour = 6  THEN t.user_id ELSE NULL END) AS hour_6,
			  COUNT(DISTINCT CASE WHEN t.Hour = 7  THEN t.user_id ELSE NULL END) AS hour_7,
			  COUNT(DISTINCT CASE WHEN t.Hour = 8  THEN t.user_id ELSE NULL END) AS hour_8,
			  COUNT(DISTINCT CASE WHEN t.Hour = 9  THEN t.user_id ELSE NULL END) AS hour_9,
			  COUNT(DISTINCT CASE WHEN t.Hour = 10 THEN t.user_id ELSE NULL END) AS hour_10,
			  COUNT(DISTINCT CASE WHEN t.Hour = 11 THEN t.user_id ELSE NULL END) AS hour_11,
			  COUNT(DISTINCT CASE WHEN t.Hour = 12 THEN t.user_id ELSE NULL END) AS hour_12,
			  COUNT(DISTINCT CASE WHEN t.Hour = 13 THEN t.user_id ELSE NULL END) AS hour_13,
			  COUNT(DISTINCT CASE WHEN t.Hour = 14 THEN t.user_id ELSE NULL END) AS hour_14,
			  COUNT(DISTINCT CASE WHEN t.Hour = 15 THEN t.user_id ELSE NULL END) AS hour_15,
			  COUNT(DISTINCT CASE WHEN t.Hour = 16 THEN t.user_id ELSE NULL END) AS hour_16,
			  COUNT(DISTINCT CASE WHEN t.Hour = 17 THEN t.user_id ELSE NULL END) AS hour_17,
			  COUNT(DISTINCT CASE WHEN t.Hour = 18 THEN t.user_id ELSE NULL END) AS hour_18,
			  COUNT(DISTINCT CASE WHEN t.Hour = 19 THEN t.user_id ELSE NULL END) AS hour_19,
			  COUNT(DISTINCT CASE WHEN t.Hour = 20 THEN t.user_id ELSE NULL END) AS hour_20,
			  COUNT(DISTINCT CASE WHEN t.Hour = 21 THEN t.user_id ELSE NULL END) AS hour_21,
			  COUNT(DISTINCT CASE WHEN t.Hour = 22 THEN t.user_id ELSE NULL END) AS hour_22,
			  COUNT(DISTINCT CASE WHEN t.Hour = 23 THEN t.user_id ELSE NULL END) AS hour_23
			FROM (
			  SELECT
			    DATE(answer_date) AS Day,
			    HOUR(answer_date) AS Hour,
			    user_id
			  FROM call_report
			  WHERE answer_date >= ? AND answer_date <= ?
			    AND type = 'in'
			    AND %s
			  UNION
			  SELECT
			    DATE(assign_date) AS Day,
			    HOUR(assign_date) AS Hour,
			    user_id
			  FROM chat_report
			  WHERE assign_date >= ? AND assign_date <= ?
			    AND agent_frt > 0
			) AS t
			GROUP BY t.Day
			ORDER BY t.Day
		`, queueCondition)

		queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
		queryParams = append(queryParams, queueParams...)
		queryParams = append(queryParams, startDate+" 00:00:00", endDate+" 23:59:59")

		rows, err := db.Query(query, queryParams...)
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса агентов по часам: %v", err)
		}
		defer rows.Close()

		data := make([]map[string]interface{}, 0)
		for rows.Next() {
			var day string
			var hours [24]int
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}

			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				row[fmt.Sprintf("hour_%d", i)] = hours[i]
			}
			data = append(data, row)
		}
		result["data"] = data

	case "total":
		// Для total показываем комбинированные данные (calls + chats)
		// Сначала получаем звонки
		callsQuery := fmt.Sprintf(`
			SELECT
			  DATE(c.enter_queue_date) AS Day,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=0  THEN 1 ELSE 0 END) AS hour_0,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=1  THEN 1 ELSE 0 END) AS hour_1,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=2  THEN 1 ELSE 0 END) AS hour_2,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=3  THEN 1 ELSE 0 END) AS hour_3,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=4  THEN 1 ELSE 0 END) AS hour_4,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=5  THEN 1 ELSE 0 END) AS hour_5,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=6  THEN 1 ELSE 0 END) AS hour_6,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=7  THEN 1 ELSE 0 END) AS hour_7,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=8  THEN 1 ELSE 0 END) AS hour_8,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=9  THEN 1 ELSE 0 END) AS hour_9,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=10 THEN 1 ELSE 0 END) AS hour_10,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=11 THEN 1 ELSE 0 END) AS hour_11,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=12 THEN 1 ELSE 0 END) AS hour_12,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=13 THEN 1 ELSE 0 END) AS hour_13,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=14 THEN 1 ELSE 0 END) AS hour_14,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=15 THEN 1 ELSE 0 END) AS hour_15,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=16 THEN 1 ELSE 0 END) AS hour_16,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=17 THEN 1 ELSE 0 END) AS hour_17,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=18 THEN 1 ELSE 0 END) AS hour_18,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=19 THEN 1 ELSE 0 END) AS hour_19,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=20 THEN 1 ELSE 0 END) AS hour_20,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=21 THEN 1 ELSE 0 END) AS hour_21,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=22 THEN 1 ELSE 0 END) AS hour_22,
			  SUM(CASE WHEN HOUR(c.enter_queue_date)=23 THEN 1 ELSE 0 END) AS hour_23
			FROM call_report c
			WHERE c.enter_queue_date >= ? AND c.enter_queue_date <= ?
			  AND c.type = 'in'
			  AND %s
			GROUP BY Day
			ORDER BY Day
		`, queueCondition)

		queryParams := []interface{}{startDate + " 00:00:00", endDate + " 23:59:59"}
		queryParams = append(queryParams, queueParams...)

		rows, err := db.Query(callsQuery, queryParams...)
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса звонков для total по часам: %v", err)
		}
		defer rows.Close()

		callsData := make(map[string][24]int)
		for rows.Next() {
			var day string
			var hours [24]int
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}
			callsData[day] = hours
		}

		// Теперь получаем чаты
		chatsQuery := `
			SELECT
			  DATE(c.created_date) AS Day,
			  SUM(CASE WHEN HOUR(c.created_date)=0  THEN 1 ELSE 0 END) AS hour_0,
			  SUM(CASE WHEN HOUR(c.created_date)=1  THEN 1 ELSE 0 END) AS hour_1,
			  SUM(CASE WHEN HOUR(c.created_date)=2  THEN 1 ELSE 0 END) AS hour_2,
			  SUM(CASE WHEN HOUR(c.created_date)=3  THEN 1 ELSE 0 END) AS hour_3,
			  SUM(CASE WHEN HOUR(c.created_date)=4  THEN 1 ELSE 0 END) AS hour_4,
			  SUM(CASE WHEN HOUR(c.created_date)=5  THEN 1 ELSE 0 END) AS hour_5,
			  SUM(CASE WHEN HOUR(c.created_date)=6  THEN 1 ELSE 0 END) AS hour_6,
			  SUM(CASE WHEN HOUR(c.created_date)=7  THEN 1 ELSE 0 END) AS hour_7,
			  SUM(CASE WHEN HOUR(c.created_date)=8  THEN 1 ELSE 0 END) AS hour_8,
			  SUM(CASE WHEN HOUR(c.created_date)=9  THEN 1 ELSE 0 END) AS hour_9,
			  SUM(CASE WHEN HOUR(c.created_date)=10 THEN 1 ELSE 0 END) AS hour_10,
			  SUM(CASE WHEN HOUR(c.created_date)=11 THEN 1 ELSE 0 END) AS hour_11,
			  SUM(CASE WHEN HOUR(c.created_date)=12 THEN 1 ELSE 0 END) AS hour_12,
			  SUM(CASE WHEN HOUR(c.created_date)=13 THEN 1 ELSE 0 END) AS hour_13,
			  SUM(CASE WHEN HOUR(c.created_date)=14 THEN 1 ELSE 0 END) AS hour_14,
			  SUM(CASE WHEN HOUR(c.created_date)=15 THEN 1 ELSE 0 END) AS hour_15,
			  SUM(CASE WHEN HOUR(c.created_date)=16 THEN 1 ELSE 0 END) AS hour_16,
			  SUM(CASE WHEN HOUR(c.created_date)=17 THEN 1 ELSE 0 END) AS hour_17,
			  SUM(CASE WHEN HOUR(c.created_date)=18 THEN 1 ELSE 0 END) AS hour_18,
			  SUM(CASE WHEN HOUR(c.created_date)=19 THEN 1 ELSE 0 END) AS hour_19,
			  SUM(CASE WHEN HOUR(c.created_date)=20 THEN 1 ELSE 0 END) AS hour_20,
			  SUM(CASE WHEN HOUR(c.created_date)=21 THEN 1 ELSE 0 END) AS hour_21,
			  SUM(CASE WHEN HOUR(c.created_date)=22 THEN 1 ELSE 0 END) AS hour_22,
			  SUM(CASE WHEN HOUR(c.created_date)=23 THEN 1 ELSE 0 END) AS hour_23
			FROM chat_report c
			WHERE c.type = 'in'
			  AND c.created_date >= ? AND c.created_date <= ?
			GROUP BY Day
			ORDER BY Day
		`

		rows, err = db.Query(chatsQuery, startDate+" 00:00:00", endDate+" 23:59:59")
		if err != nil {
			return nil, fmt.Errorf("ошибка выполнения запроса чатов для total по часам: %v", err)
		}
		defer rows.Close()

		chatsData := make(map[string][24]int)
		for rows.Next() {
			var day string
			var hours [24]int
			if err := rows.Scan(&day, &hours[0], &hours[1], &hours[2], &hours[3], &hours[4], &hours[5],
				&hours[6], &hours[7], &hours[8], &hours[9], &hours[10], &hours[11], &hours[12],
				&hours[13], &hours[14], &hours[15], &hours[16], &hours[17], &hours[18],
				&hours[19], &hours[20], &hours[21], &hours[22], &hours[23]); err != nil {
				continue
			}
			chatsData[day] = hours
		}

		// Объединяем данные
		allDays := make(map[string]bool)
		for day := range callsData {
			allDays[day] = true
		}
		for day := range chatsData {
			allDays[day] = true
		}

		data := make([]map[string]interface{}, 0)
		for day := range allDays {
			row := map[string]interface{}{"date": day}
			for i := 0; i < 24; i++ {
				calls := 0
				chats := 0
				if callsHours, exists := callsData[day]; exists {
					calls = callsHours[i]
				}
				if chatsHours, exists := chatsData[day]; exists {
					chats = chatsHours[i]
				}
				row[fmt.Sprintf("hour_%d", i)] = calls + chats
			}
			data = append(data, row)
		}
		result["data"] = data

	default:
		return nil, fmt.Errorf("неподдерживаемая метрика: %s", metric)
	}

	return result, nil
}

// ClassifierResult структура для результатов классификаторов
type ClassifierResult struct {
	ReportDate string `json:"report_date" bson:"report_date"`
	Topic      string `json:"topic" bson:"topic"`
	Subtopic   string `json:"subtopic" bson:"subtopic"`
	Total      int    `json:"total" bson:"total"`
}

// GetCallClassifiers получает данные классификаторов для звонков
func (a *App) GetCallClassifiers(startDate, endDate, queueName string) (map[string]interface{}, error) {
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB соединение не установлено")
	}

	log.Printf("Получение данных классификаторов звонков с %s по %s для очереди %s", startDate, endDate, queueName)

	collection := mongoDB.Collection("request")
	ctx := context.Background()

	// Определяем очереди для запроса в зависимости от параметра queueName
	var queueCondition interface{}
	if queueName == "all" {
		// Для "all" - только очередь m10 (звонки)
		queueCondition = "m10"
	} else if queueName == "m10" {
		// Для "m10" - только основная очередь
		queueCondition = "m10"
	} else if queueName == "aml" {
		// Для "aml" - очередь жалоб
		queueCondition = "m10-shikayet"
	} else {
		// Fallback - используем как есть
		queueCondition = queueName
	}

	// Агрегационный запрос для звонков
	pipeline := []map[string]interface{}{
		{
			"$unwind": "$classifiers",
		},
		{
			"$addFields": map[string]interface{}{
				"report_date": map[string]interface{}{
					"$dateToString": map[string]interface{}{
						"format":   "%Y-%m-%d",
						"date":     "$createdDate",
						"timezone": "Asia/Baku",
					},
				},
			},
		},
		{
			"$match": map[string]interface{}{
				"type":      "in",
				"queueName": queueCondition,
				"report_date": map[string]interface{}{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"queueName":   1,
				"pieces":      map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}},
				"len":         map[string]interface{}{"$size": map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}}},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"queueName":   1,
				"Topic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
						map[string]interface{}{
							"$cond": []interface{}{
								map[string]interface{}{"$eq": []interface{}{"$len", 2}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 0}}}},
							},
						},
					},
				},
				"Subtopic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{
							"$trim": map[string]interface{}{
								"input": map[string]interface{}{
									"$reduce": map[string]interface{}{
										"input":        map[string]interface{}{"$slice": []interface{}{"$pieces", 2, map[string]interface{}{"$subtract": []interface{}{"$len", 2}}}},
										"initialValue": "",
										"in": map[string]interface{}{
											"$cond": []interface{}{
												map[string]interface{}{"$eq": []interface{}{"$$value", ""}},
												"$$this",
												map[string]interface{}{"$concat": []interface{}{"$$value", "/", "$$this"}},
											},
										},
									},
								},
							},
						},
						"",
					},
				},
			},
		},
		{
			"$group": map[string]interface{}{
				"_id": map[string]interface{}{
					"report_date": "$report_date",
					"topic":       "$Topic",
					"subtopic":    "$Subtopic",
				},
				"total": map[string]interface{}{"$sum": 1},
			},
		},
		{
			"$project": map[string]interface{}{
				"_id":         0,
				"report_date": "$_id.report_date",
				"topic":       "$_id.topic",
				"subtopic":    "$_id.subtopic",
				"total":       1,
			},
		},
		{
			"$sort": map[string]interface{}{
				"report_date": 1,
				"topic":       1,
				"subtopic":    1,
			},
		},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения агрегации для звонков: %v", err)
	}
	defer cursor.Close(ctx)

	var results []ClassifierResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("ошибка получения результатов для звонков: %v", err)
	}

	log.Printf("Найдено %d записей классификаторов звонков", len(results))

	return map[string]interface{}{
		"data": results,
		"type": "call_classifiers",
	}, nil
}

// GetChatClassifiers получает данные классификаторов для чатов
func (a *App) GetChatClassifiers(startDate, endDate, queueName string) (map[string]interface{}, error) {
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB соединение не установлено")
	}

	log.Printf("Получение данных классификаторов чатов с %s по %s для очереди %s", startDate, endDate, queueName)

	collection := mongoDB.Collection("request")
	ctx := context.Background()

	// Определяем очереди для чатов в зависимости от параметра queueName
	var queueCondition interface{}
	if queueName == "all" {
		// Для "all" - все очереди чатов
		queueCondition = map[string]interface{}{
			"$in": []string{"m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "m10" {
		// Для "m10" - только основные чаты
		queueCondition = map[string]interface{}{
			"$in": []string{"m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "aml" {
		// Для "aml" - возвращаем пустой результат, так как AML для звонков
		return map[string]interface{}{
			"data": []ClassifierResult{},
			"type": "chat_classifiers",
		}, nil
	} else {
		// Для конкретной очереди
		queueCondition = queueName
	}

	// Агрегационный запрос для чатов
	pipeline := []map[string]interface{}{
		{
			"$unwind": "$classifiers",
		},
		{
			"$addFields": map[string]interface{}{
				"report_date": map[string]interface{}{
					"$dateToString": map[string]interface{}{
						"format":   "%Y-%m-%d",
						"date":     "$createdDate",
						"timezone": "Asia/Baku",
					},
				},
			},
		},
		{
			"$match": map[string]interface{}{
				"type":      "in",
				"queueName": queueCondition,
				"report_date": map[string]interface{}{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"queueName":   1,
				"pieces":      map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}},
				"len":         map[string]interface{}{"$size": map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}}},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"queueName":   1,
				"Topic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
						map[string]interface{}{
							"$cond": []interface{}{
								map[string]interface{}{"$eq": []interface{}{"$len", 2}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 0}}}},
							},
						},
					},
				},
				"Subtopic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{
							"$trim": map[string]interface{}{
								"input": map[string]interface{}{
									"$reduce": map[string]interface{}{
										"input":        map[string]interface{}{"$slice": []interface{}{"$pieces", 2, map[string]interface{}{"$subtract": []interface{}{"$len", 2}}}},
										"initialValue": "",
										"in": map[string]interface{}{
											"$cond": []interface{}{
												map[string]interface{}{"$eq": []interface{}{"$$value", ""}},
												"$$this",
												map[string]interface{}{"$concat": []interface{}{"$$value", "/", "$$this"}},
											},
										},
									},
								},
							},
						},
						"",
					},
				},
			},
		},
		{
			"$group": map[string]interface{}{
				"_id": map[string]interface{}{
					"report_date": "$report_date",
					"topic":       "$Topic",
					"subtopic":    "$Subtopic",
				},
				"total": map[string]interface{}{"$sum": 1},
			},
		},
		{
			"$project": map[string]interface{}{
				"_id":         0,
				"report_date": "$_id.report_date",
				"topic":       "$_id.topic",
				"subtopic":    "$_id.subtopic",
				"total":       1,
			},
		},
		{
			"$sort": map[string]interface{}{
				"report_date": 1,
				"topic":       1,
				"subtopic":    1,
			},
		},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения агрегации для чатов: %v", err)
	}
	defer cursor.Close(ctx)

	var results []ClassifierResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("ошибка получения результатов для чатов: %v", err)
	}

	log.Printf("Найдено %d записей классификаторов чатов", len(results))

	return map[string]interface{}{
		"data": results,
		"type": "chat_classifiers",
	}, nil
}

// GetOverallClassifiers получает данные классификаторов для звонков и чатов вместе
func (a *App) GetOverallClassifiers(startDate, endDate, queueName string) (map[string]interface{}, error) {
	log.Printf("Получение данных общих классификаторов с %s по %s для очереди %s", startDate, endDate, queueName)

	// Получаем данные звонков
	callData, err := a.GetCallClassifiers(startDate, endDate, queueName)
	if err != nil {
		return nil, fmt.Errorf("ошибка получения данных звонков: %v", err)
	}

	// Получаем данные чатов
	chatData, err := a.GetChatClassifiers(startDate, endDate, queueName)
	if err != nil {
		return nil, fmt.Errorf("ошибка получения данных чатов: %v", err)
	}

	// Объединяем данные
	callResults := callData["data"].([]ClassifierResult)
	chatResults := chatData["data"].([]ClassifierResult)

	// Создаем карту для объединения данных по ключу date+topic+subtopic
	combinedMap := make(map[string]*ClassifierResult)

	// Добавляем данные звонков
	for _, result := range callResults {
		key := fmt.Sprintf("%s|%s|%s", result.ReportDate, result.Topic, result.Subtopic)
		combinedMap[key] = &ClassifierResult{
			ReportDate: result.ReportDate,
			Topic:      result.Topic,
			Subtopic:   result.Subtopic,
			Total:      result.Total,
		}
	}

	// Добавляем данные чатов
	for _, result := range chatResults {
		key := fmt.Sprintf("%s|%s|%s", result.ReportDate, result.Topic, result.Subtopic)
		if existing, exists := combinedMap[key]; exists {
			existing.Total += result.Total
		} else {
			combinedMap[key] = &ClassifierResult{
				ReportDate: result.ReportDate,
				Topic:      result.Topic,
				Subtopic:   result.Subtopic,
				Total:      result.Total,
			}
		}
	}

	// Преобразуем карту обратно в массив
	var combinedResults []ClassifierResult
	for _, result := range combinedMap {
		combinedResults = append(combinedResults, *result)
	}

	log.Printf("Объединено %d записей общих классификаторов", len(combinedResults))

	return map[string]interface{}{
		"data": combinedResults,
		"type": "overall_classifiers",
	}, nil
}

// TopicResult структура для результатов метрики Topics
type TopicResult struct {
	ReportDate string  `json:"report_date" bson:"report_date"`
	Topic      string  `json:"topic" bson:"topic"`
	Total      int     `json:"total" bson:"total"`
	Ratio      float64 `json:"ratio" bson:"ratio"`
}

// GetTopics получает агрегированные данные только по топикам (без субтопиков) с процентным соотношением
func (a *App) GetTopics(startDate, endDate, queueName string) (map[string]interface{}, error) {
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB соединение не установлено")
	}

	log.Printf("Получение данных топиков с %s по %s для очереди %s", startDate, endDate, queueName)

	collection := mongoDB.Collection("request")
	ctx := context.Background()

	// Определяем очереди для запроса в зависимости от параметра queueName
	var queueCondition interface{}
	if queueName == "all" {
		// Для "all" - все очереди (звонки и чаты)
		queueCondition = map[string]interface{}{
			"$in": []string{"m10", "m10-shikayet", "m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "m10" {
		// Для "m10" - основные очереди (звонки и чаты)
		queueCondition = map[string]interface{}{
			"$in": []string{"m10", "m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "aml" {
		// Для "aml" - очередь жалоб
		queueCondition = "m10-shikayet"
	} else {
		// Fallback - используем как есть
		queueCondition = queueName
	}

	// Агрегационный запрос для получения данных только по топикам
	pipeline := []map[string]interface{}{
		{
			"$unwind": "$classifiers",
		},
		{
			"$addFields": map[string]interface{}{
				"report_date": map[string]interface{}{
					"$dateToString": map[string]interface{}{
						"format":   "%Y-%m-%d",
						"date":     "$createdDate",
						"timezone": "Asia/Baku",
					},
				},
			},
		},
		{
			"$match": map[string]interface{}{
				"type":      "in",
				"queueName": queueCondition,
				"report_date": map[string]interface{}{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"pieces":      map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}},
				"len":         map[string]interface{}{"$size": map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}}},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"Topic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
						map[string]interface{}{
							"$cond": []interface{}{
								map[string]interface{}{"$eq": []interface{}{"$len", 2}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 0}}}},
							},
						},
					},
				},
			},
		},
		{
			"$group": map[string]interface{}{
				"_id": map[string]interface{}{
					"report_date": "$report_date",
					"topic":       "$Topic",
				},
				"total": map[string]interface{}{"$sum": 1},
			},
		},
		{
			"$group": map[string]interface{}{
				"_id": "$_id.report_date",
				"topics": map[string]interface{}{
					"$push": map[string]interface{}{
						"topic": "$_id.topic",
						"total": "$total",
					},
				},
				"grandTotal": map[string]interface{}{"$sum": "$total"},
			},
		},
		{
			"$unwind": "$topics",
		},
		{
			"$project": map[string]interface{}{
				"_id":         0,
				"report_date": "$_id",
				"topic":       "$topics.topic",
				"total":       "$topics.total",
				"ratio": map[string]interface{}{
					"$multiply": []interface{}{
						map[string]interface{}{"$divide": []interface{}{"$topics.total", "$grandTotal"}},
						100,
					},
				},
			},
		},
		{
			"$sort": map[string]interface{}{
				"report_date": 1,
				"total":       -1, // Сортируем по количеству по убыванию
			},
		},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения агрегации для топиков: %v", err)
	}
	defer cursor.Close(ctx)

	var results []TopicResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("ошибка получения результатов для топиков: %v", err)
	}

	log.Printf("Найдено %d записей топиков", len(results))

	return map[string]interface{}{
		"data": results,
		"type": "topics",
	}, nil
}

// GetAvailableTopics получает список доступных топиков для выпадающего списка
func (a *App) GetAvailableTopics(startDate, endDate, queueName string) (map[string]interface{}, error) {
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB соединение не установлено")
	}

	log.Printf("Получение списка доступных топиков с %s по %s для очереди %s", startDate, endDate, queueName)

	collection := mongoDB.Collection("request")
	ctx := context.Background()

	// Определяем очереди для запроса в зависимости от параметра queueName
	var queueCondition interface{}
	if queueName == "all" {
		// Для "all" - все очереди (звонки и чаты)
		queueCondition = map[string]interface{}{
			"$in": []string{"m10", "m10-shikayet", "m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "m10" {
		// Для "m10" - основные очереди (звонки и чаты)
		queueCondition = map[string]interface{}{
			"$in": []string{"m10", "m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "aml" {
		// Для "aml" - очередь жалоб
		queueCondition = "m10-shikayet"
	} else {
		// Fallback - используем как есть
		queueCondition = queueName
	}

	// Агрегационный запрос для получения уникальных топиков
	pipeline := []map[string]interface{}{
		{
			"$unwind": "$classifiers",
		},
		{
			"$addFields": map[string]interface{}{
				"report_date": map[string]interface{}{
					"$dateToString": map[string]interface{}{
						"format":   "%Y-%m-%d",
						"date":     "$createdDate",
						"timezone": "Asia/Baku",
					},
				},
			},
		},
		{
			"$match": map[string]interface{}{
				"type":      "in",
				"queueName": queueCondition,
				"report_date": map[string]interface{}{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		{
			"$project": map[string]interface{}{
				"pieces": map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}},
				"len":    map[string]interface{}{"$size": map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}}},
			},
		},
		{
			"$project": map[string]interface{}{
				"Topic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
						map[string]interface{}{
							"$cond": []interface{}{
								map[string]interface{}{"$eq": []interface{}{"$len", 2}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 0}}}},
							},
						},
					},
				},
			},
		},
		{
			"$group": map[string]interface{}{
				"_id": "$Topic",
			},
		},
		{
			"$project": map[string]interface{}{
				"_id":   0,
				"topic": "$_id",
			},
		},
		{
			"$sort": map[string]interface{}{
				"topic": 1,
			},
		},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения агрегации для списка топиков: %v", err)
	}
	defer cursor.Close(ctx)

	var results []map[string]interface{}
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("ошибка получения результатов для списка топиков: %v", err)
	}

	log.Printf("Найдено %d уникальных топиков", len(results))

	return map[string]interface{}{
		"data": results,
		"type": "available_topics",
	}, nil
}

// GetSubtopicsDaily получает данные субтопиков для выбранного топика по дням
func (a *App) GetSubtopicsDaily(startDate, endDate, queueName, selectedTopic string) (map[string]interface{}, error) {
	mongoDB := a.dbService.GetMongoDB()
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB соединение не установлено")
	}

	log.Printf("Получение данных субтопиков для топика '%s' с %s по %s для очереди %s", selectedTopic, startDate, endDate, queueName)

	collection := mongoDB.Collection("request")
	ctx := context.Background()

	// Определяем очереди для запроса в зависимости от параметра queueName
	var queueCondition interface{}
	if queueName == "all" {
		// Для "all" - все очереди (звонки и чаты)
		queueCondition = map[string]interface{}{
			"$in": []string{"m10", "m10-shikayet", "m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "m10" {
		// Для "m10" - основные очереди (звонки и чаты)
		queueCondition = map[string]interface{}{
			"$in": []string{"m10", "m10 Facebook", "WHATSAPP", "m10 Instagram", "telegram"},
		}
	} else if queueName == "aml" {
		// Для "aml" - очередь жалоб
		queueCondition = "m10-shikayet"
	} else {
		// Fallback - используем как есть
		queueCondition = queueName
	}

	// Агрегационный запрос для получения субтопиков выбранного топика
	pipeline := []map[string]interface{}{
		{
			"$unwind": "$classifiers",
		},
		{
			"$addFields": map[string]interface{}{
				"report_date": map[string]interface{}{
					"$dateToString": map[string]interface{}{
						"format":   "%Y-%m-%d",
						"date":     "$createdDate",
						"timezone": "Asia/Baku",
					},
				},
			},
		},
		{
			"$match": map[string]interface{}{
				"type":      "in",
				"queueName": queueCondition,
				"report_date": map[string]interface{}{
					"$gte": startDate,
					"$lte": endDate,
				},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"queueName":   1,
				"pieces":      map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}},
				"len":         map[string]interface{}{"$size": map[string]interface{}{"$split": []interface{}{"$classifiers.path", "/"}}},
			},
		},
		{
			"$project": map[string]interface{}{
				"report_date": 1,
				"queueName":   1,
				"Topic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
						map[string]interface{}{
							"$cond": []interface{}{
								map[string]interface{}{"$eq": []interface{}{"$len", 2}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 1}}}},
								map[string]interface{}{"$trim": map[string]interface{}{"input": map[string]interface{}{"$arrayElemAt": []interface{}{"$pieces", 0}}}},
							},
						},
					},
				},
				"Subtopic": map[string]interface{}{
					"$cond": []interface{}{
						map[string]interface{}{"$gte": []interface{}{"$len", 3}},
						map[string]interface{}{
							"$trim": map[string]interface{}{
								"input": map[string]interface{}{
									"$reduce": map[string]interface{}{
										"input":        map[string]interface{}{"$slice": []interface{}{"$pieces", 2, map[string]interface{}{"$subtract": []interface{}{"$len", 2}}}},
										"initialValue": "",
										"in": map[string]interface{}{
											"$cond": []interface{}{
												map[string]interface{}{"$eq": []interface{}{"$$value", ""}},
												"$$this",
												map[string]interface{}{"$concat": []interface{}{"$$value", "/", "$$this"}},
											},
										},
									},
								},
							},
						},
						"",
					},
				},
			},
		},
		{
			"$match": map[string]interface{}{
				"Topic": selectedTopic,
			},
		},
		{
			"$group": map[string]interface{}{
				"_id": map[string]interface{}{
					"report_date": "$report_date",
					"topic":       "$Topic",
					"subtopic":    "$Subtopic",
				},
				"total": map[string]interface{}{"$sum": 1},
			},
		},
		{
			"$project": map[string]interface{}{
				"_id":         0,
				"report_date": "$_id.report_date",
				"topic":       "$_id.topic",
				"subtopic":    "$_id.subtopic",
				"total":       1,
			},
		},
		{
			"$sort": map[string]interface{}{
				"report_date": 1,
				"topic":       1,
				"subtopic":    1,
			},
		},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("ошибка выполнения агрегации для субтопиков: %v", err)
	}
	defer cursor.Close(ctx)

	var results []ClassifierResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("ошибка получения результатов для субтопиков: %v", err)
	}

	log.Printf("Найдено %d записей субтопиков для топика '%s'", len(results), selectedTopic)

	return map[string]interface{}{
		"data": results,
		"type": "subtopics_daily",
	}, nil
}
