# Executor (Python)

MacOS操作を実行するPythonベースのエグゼキューター。

## 構造

```
executor/
├── main.py                 # コマンドディスパッチャー（メインエントリーポイント）
├── actions/                # アクション実装モジュール
│   ├── screenshot.py       # スクリーンショットとハイライト
│   ├── mouse_keyboard.py   # マウスとキーボード操作
│   ├── applescript.py      # AppleScript/OSA実行
│   ├── ui_elements.py      # UI要素の取得と操作
│   └── web_elements.py     # Web要素（ブラウザ内）の操作
├── utils/                  # ユーティリティモジュール
│   └── coordinate_helper.py # 座標変換とスケーリング
└── requirements.txt        # Python依存関係
```

## モジュール構成

### main.py
- TypeScript ControllerからのJSONコマンドを受信
- 適切なアクションハンドラーにディスパッチ
- 実行時間の計測とエラーハンドリング
- 約92行の薄いディスパッチャーレイヤー

### actions/screenshot.py
- スクリーンショット取得
- ハイライト描画（操作位置の可視化）
- 画面サイズ取得

### actions/mouse_keyboard.py
- マウス操作（クリック、移動、ドラッグ）
- キーボード操作（テキスト入力、キー押下、ホットキー）
- スクロール操作

### actions/applescript.py
- AppleScript (OSA) の実行
- MacOS固有の高レベル操作

### actions/ui_elements.py
- AppleScriptとJXAを使用したUI要素の取得
- UI要素の検索とクリック
- フォーカス制御とテキスト入力
- Note: テキスト入力機能は`mouse_keyboard.py`との循環依存を避けるため、内部に複製されています

### actions/web_elements.py
- ブラウザ内のWeb要素の取得
- AXWebArea配下の要素操作

### utils/coordinate_helper.py
- Retinaディスプレイ対応の座標スケーリング
- 論理座標と物理座標の変換

## 使用方法

main.pyは標準入出力を通じてJSONベースの通信を行います：

```json
// 入力
{"action": "click", "params": {"x": 500, "y": 500}}

// 出力
{"status": "success", "execution_time_ms": 120}
```

## 依存関係

- pyautogui: GUI自動化
- Pillow (PIL): 画像処理
- pyperclip: クリップボード操作

インストール:
```bash
pip install -r requirements.txt
```
