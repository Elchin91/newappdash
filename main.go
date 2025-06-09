package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// main - основная функция приложения
func main() {
	// Создание экземпляра приложения
	app := NewApp()

	// Настройка и запуск приложения Wails
	err := wails.Run(&options.App{
		Title:  "CC Dashboard",
		Width:  1400,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1}, // Темный фон
		OnStartup:        app.OnStartup,
		OnDomReady:       app.OnDomReady,
		OnShutdown:       app.OnShutdown,
		Bind: []interface{}{
			app,
		},
		MinWidth:          1200,
		MinHeight:         800,
		DisableResize:     false,
		AlwaysOnTop:       false,
		StartHidden:       false,
		HideWindowOnClose: false,
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			return false
		},
	})

	if err != nil {
		println("Ошибка запуска приложения:", err.Error())
	}
}
