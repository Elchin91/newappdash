package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/url"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Конфигурация базы данных
type DatabaseConfig struct {
	MySQL   MySQLConfig   `json:"mysql"`
	MongoDB MongoDBConfig `json:"mongodb"`
}

// Конфигурация MySQL
type MySQLConfig struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	Database string `json:"database"`
}

// Конфигурация MongoDB
type MongoDBConfig struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	Database string `json:"database"`
}

// Сервис для работы с базами данных
type DatabaseService struct {
	mysqlDB *sql.DB
	mongoDB *mongo.Database
	config  DatabaseConfig
}

// Создание нового сервиса баз данных
func NewDatabaseService() *DatabaseService {
	config := DatabaseConfig{
		MySQL: MySQLConfig{
			Host:     "192.168.46.4",
			Port:     "3306",
			User:     "pashapay",
			Password: "Q1w2e3r4!@#",
			Database: "report",
		},
		MongoDB: MongoDBConfig{
			Host:     "192.168.46.4",
			Port:     "27017",
			User:     "readonly",
			Password: "q1w2e3r4!@#",
			Database: "request",
		},
	}

	return &DatabaseService{
		config: config,
	}
}

// Подключение к MySQL
func (ds *DatabaseService) ConnectMySQL() error {
	dsn := ds.config.MySQL.User + ":" + ds.config.MySQL.Password + "@tcp(" +
		ds.config.MySQL.Host + ":" + ds.config.MySQL.Port + ")/" + ds.config.MySQL.Database + "?parseTime=true"

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Printf("Ошибка подключения к MySQL: %v", err)
		return err
	}

	// Настройка пула соединений
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Проверка соединения
	if err := db.Ping(); err != nil {
		log.Printf("Ошибка пинга MySQL: %v", err)
		return err
	}

	ds.mysqlDB = db
	log.Println("Успешное подключение к MySQL")
	return nil
}

// Подключение к MongoDB
func (ds *DatabaseService) ConnectMongoDB() error {
	// Список возможных источников аутентификации для пробы
	authSources := []string{"admin", ds.config.MongoDB.Database, ""}

	for i, authSource := range authSources {
		log.Printf("Попытка подключения к MongoDB #%d с authSource: %s", i+1, authSource)

		// Формируем URI с правильным URL-кодированием пароля
		uri := "mongodb://" + ds.config.MongoDB.User + ":" + url.QueryEscape(ds.config.MongoDB.Password) +
			"@" + ds.config.MongoDB.Host + ":" + ds.config.MongoDB.Port + "/" + ds.config.MongoDB.Database

		// Добавляем authSource если он указан
		if authSource != "" {
			uri += "?authSource=" + authSource + "&authMechanism=SCRAM-SHA-1"
		} else {
			uri += "?authMechanism=SCRAM-SHA-1"
		}

		log.Printf("URI: mongodb://%s:***@%s:%s/%s (authSource: %s)",
			ds.config.MongoDB.User, ds.config.MongoDB.Host, ds.config.MongoDB.Port, ds.config.MongoDB.Database, authSource)

		// Настройки клиента с таймаутами
		clientOptions := options.Client().ApplyURI(uri)
		clientOptions.SetConnectTimeout(10 * time.Second)
		clientOptions.SetServerSelectionTimeout(10 * time.Second)
		clientOptions.SetMaxPoolSize(10)

		client, err := mongo.Connect(context.Background(), clientOptions)
		if err != nil {
			log.Printf("Ошибка создания клиента MongoDB (попытка %d): %v", i+1, err)
			continue
		}

		// Проверка соединения
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)

		if err := client.Ping(ctx, nil); err != nil {
			log.Printf("Ошибка пинга MongoDB (попытка %d): %v", i+1, err)
			client.Disconnect(context.Background())
			cancel()
			continue
		}

		// Успешное подключение!
		ds.mongoDB = client.Database(ds.config.MongoDB.Database)
		log.Printf("Успешное подключение к MongoDB с authSource: %s", authSource)

		// Проверим доступность коллекций
		collections, err := ds.mongoDB.ListCollectionNames(ctx, map[string]interface{}{})
		if err != nil {
			log.Printf("Предупреждение: не удалось получить список коллекций: %v", err)
		} else {
			log.Printf("Доступные коллекции: %v", collections)
		}

		cancel()
		return nil
	}

	return fmt.Errorf("не удалось подключиться к MongoDB после %d попыток", len(authSources))
}

// Получение MySQL соединения
func (ds *DatabaseService) GetMySQLDB() *sql.DB {
	return ds.mysqlDB
}

// Получение MongoDB соединения
func (ds *DatabaseService) GetMongoDB() *mongo.Database {
	return ds.mongoDB
}

// Закрытие всех соединений
func (ds *DatabaseService) Close() {
	if ds.mysqlDB != nil {
		ds.mysqlDB.Close()
	}
	if ds.mongoDB != nil {
		ds.mongoDB.Client().Disconnect(context.Background())
	}
}
